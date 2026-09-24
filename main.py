"""Phase 1 entry point.

Prama CCTV camera(s) -> RTSP -> live frames -> YOLO face detection -> HUD.

Supports any number of cameras: define CAMERA_1_*, CAMERA_2_*, ... in .env
(or the legacy unprefixed CAMERA_* vars for a single camera -- see
app/config.py). Each camera gets its own capture thread, its own detection
process, and its own display window.

Run:
    python main.py
Quit:
    press 'q' or Esc in any video window, or Ctrl+C in the terminal.
"""
from __future__ import annotations

import logging
import sys
import time
from dataclasses import asdict, dataclass

from app.camera.rtsp_stream import RTSPStream
from app.config import AppConfig, CameraConfig, load_config
from app.processing.pipeline import FacePipeline
from app.ui.display import Display, draw_overlay, to_square

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)
logger = logging.getLogger("main")

# Anything a render-loop iteration takes above this is logged with a
# breakdown, so a recurring freeze can be pinned to poll() (result readback)
# vs draw_overlay() (box/HUD drawing) vs display.show() (cv2.imshow) instead
# of guessed at.
_STALL_THRESHOLD_MS = 100.0


@dataclass
class CameraSession:
    camera: CameraConfig
    stream: RTSPStream
    pipeline: FacePipeline
    display: Display


def _start_camera(camera: CameraConfig, config: AppConfig) -> CameraSession | None:
    try:
        rtsp_url = camera.rtsp_url
    except ValueError as exc:
        logger.error("[%s] %s", camera.name, exc)
        return None

    logger.info("[%s] RTSP URL: %s", camera.name, camera.rtsp_url_masked)

    stream = RTSPStream(
        rtsp_url=rtsp_url,
        transport=camera.transport,
        initial_reconnect_delay=config.reconnect.initial_delay,
        max_reconnect_delay=config.reconnect.max_delay,
        rtsp_url_masked=camera.rtsp_url_masked,
        name=camera.name,
    ).start()

    pipeline = FacePipeline(
        stream=stream,
        detector_kwargs=dict(
            backend=config.detection.backend,
            onnx_provider=config.detection.onnx_provider,
            det_size=config.detection.det_size,
            conf_threshold=config.detection.conf_threshold,
        ),
        detection_interval=config.detection.interval,
        max_process_fps=config.max_process_fps,
        save_crops=config.crops.enabled,
        crops_dir=config.crops.directory / camera.name.replace(" ", "_"),
        max_saved_crops=config.crops.max_saved,
        head_count_source=config.detection.head_count_source,
        person_conf_threshold=config.detection.person_conf_threshold,
        ocr_kwargs=asdict(config.ocr),
    )

    display = Display(window_name=f"CCTV Face Detection - {camera.name}")
    return CameraSession(camera=camera, stream=stream, pipeline=pipeline, display=display)


def main() -> int:
    config = load_config()

    if not config.cameras:
        logger.error(
            "No cameras configured. Set CAMERA_IP/CAMERA_RTSP_URL (single "
            "camera) or CAMERA_1_IP, CAMERA_2_IP, ... (multiple) in .env."
        )
        return 1

    logger.info(
        "Starting %d camera(s): %s",
        len(config.cameras),
        ", ".join(c.name for c in config.cameras),
    )
    logger.info(
        "Starting face detector process(es) (first run downloads the model, "
        "~a few hundred MB)..."
    )

    sessions = [
        session
        for session in (_start_camera(camera, config) for camera in config.cameras)
        if session is not None
    ]
    if not sessions:
        logger.error("No cameras could be started.")
        return 1

    logger.info("Waiting for first frame from camera(s)...")

    try:
        while True:
            should_quit = False
            for session in sessions:
                t0 = time.monotonic()
                result = session.pipeline.poll()
                t1 = time.monotonic()
                if result is not None:
                    frame = draw_overlay(
                        result,
                        camera_name=session.camera.name,
                        head_count_source=config.detection.head_count_source,
                    )
                    t2 = time.monotonic()
                    frame = to_square(frame, size=1080)
                    t2b = time.monotonic()
                    session.display.show(frame)
                    t3 = time.monotonic()

                    total_ms = (t3 - t0) * 1000
                    if total_ms > _STALL_THRESHOLD_MS:
                        logger.warning(
                            "[%s] Slow render iteration: %.0fms total "
                            "(poll=%.0fms draw_overlay=%.0fms to_square=%.0fms show=%.0fms)",
                            session.camera.name, total_ms,
                            (t1 - t0) * 1000, (t2 - t1) * 1000,
                            (t2b - t2) * 1000, (t3 - t2b) * 1000,
                        )

                    if result.ran_detection and result.tracked_faces:
                        for t in result.tracked_faces:
                            logger.debug(
                                "[%s] Face #%s confidence=%.2f bbox=%s",
                                session.camera.name, t.track_id,
                                t.face.confidence, t.face.bbox,
                            )

                if session.display.poll_quit():
                    should_quit = True

            if should_quit:
                break
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
    finally:
        for session in sessions:
            session.stream.stop()
            session.pipeline.close()
            session.display.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
