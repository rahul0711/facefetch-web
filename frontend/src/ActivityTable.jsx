import { useEffect, useState } from 'react'
import { AuthError, fetchActivity } from './api'

const POLL_INTERVAL_MS = 5000

function formatDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function ActivityTable({ cameraId, onAuthError }) {
  const [rows, setRows] = useState([])

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const data = await fetchActivity(cameraId)
        if (!cancelled) {
          setRows([...data].sort((a, b) => b.track_id - a.track_id))
        }
      } catch (err) {
        if (cancelled) return
        if (err instanceof AuthError) onAuthError()
      }
    }

    poll()
    const timer = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [cameraId, onAuthError])

  return (
    <div className="activity">
      <div className="activity__title">Sitting / phone / computer time</div>
      {rows.length === 0 ? (
        <p className="activity__empty">No one tracked yet -- appears when a person is in frame.</p>
      ) : (
        <div className="activity__scroll">
          <table>
            <thead>
              <tr>
                <th>Track</th>
                <th title="Time spent since first appearing">Sitting</th>
                <th title="Time a phone was detected near them">Phone</th>
                <th title="Time a laptop/keyboard/mouse was detected near them">Computer</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.track_id}>
                  <td>#{row.track_id}</td>
                  <td>{formatDuration(row.sitting_seconds)}</td>
                  <td>{formatDuration(row.phone_seconds)}</td>
                  <td>{formatDuration(row.computer_seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
