import { useRef } from 'react'
import Finder from './Finder'
import Library from './Library'
import { useLibrary } from './useLibrary'
import {
  BoltIcon,
  CameraIcon,
  DownloadIcon,
  ImagesIcon,
  PhoneIcon,
  ScanIcon,
  ShieldIcon,
  UploadIcon,
  UsersIcon,
} from './icons'
import './facefetch.css'

const STEPS = [
  { icon: ImagesIcon, title: 'Add your photos', text: 'Drop in as many photos as you like, or a whole folder. Every face in them is found and indexed.' },
  { icon: CameraIcon, title: 'Show a face', text: 'Take a selfie with your webcam or phone camera, or upload a clear photo of the person.' },
  { icon: ScanIcon, title: 'Get every match', text: 'See every photo that face appears in, best matches first. Download one or all of them.' },
]

const FEATURES = [
  { icon: PhoneIcon, title: 'Any device', text: 'Works in the browser on phones, tablets and laptops — front camera, back camera or webcam.' },
  { icon: UsersIcon, title: 'Finds you in group shots', text: 'Every face in a photo is indexed, so you show up even in the back row of a crowd.' },
  { icon: BoltIcon, title: 'Results in seconds', text: 'GPU face recognition searches thousands of photos faster than you can scroll.' },
  { icon: ShieldIcon, title: 'Stays in your browser', text: 'Your library lives in this browser only. The server analyzes each photo and keeps nothing.' },
  { icon: DownloadIcon, title: 'Download everything', text: 'Save single photos in full quality, or grab every match in one zip.' },
  { icon: ScanIcon, title: 'State-of-the-art AI', text: 'SCRFD face detection with AdaFace recognition — robust to angle, lighting and age.' },
]

const FAQ = [
  {
    q: 'Where are my photos stored?',
    a: "Only in this browser (its local storage), until you press Clear all. Each photo is sent once to the face engine to find the faces in it. The engine sends back the results and keeps no copy. The face photo you search with is never saved either.",
  },
  {
    q: 'Do I have to add my photos again next time?',
    a: 'No. The library stays in this browser, even after a restart. It is per browser and device, so another phone or browser starts with an empty library.',
  },
  {
    q: "The live camera doesn't open on my phone",
    a: 'Browsers only allow live camera access on secure (https) pages. Use "Phone camera app" instead — it opens your phone\'s own camera and works everywhere — or upload a photo you already have.',
  },
  {
    q: 'How do I get the best results?',
    a: 'Face the camera straight on in good, even light. Remove sunglasses and masks, and make sure your whole face is in the frame.',
  },
  {
    q: 'Why is someone missing from some photos?',
    a: 'Very small, blurry, or heavily turned faces carry too little detail to match confidently, so we leave them out rather than show you someone else.',
  },
]

function HeroVisual() {
  // Decorative: a face being scanned, with matched photos floating around it.
  return (
    <div className="ff-hero__visual" aria-hidden="true">
      <div className="ff-orbit ff-orbit--1" />
      <div className="ff-orbit ff-orbit--2" />
      <div className="ff-scanner">
        <svg viewBox="0 0 120 140" className="ff-scanner__face">
          <defs>
            <linearGradient id="ffFace" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="var(--ff-accent)" />
              <stop offset="1" stopColor="var(--ff-accent-2)" />
            </linearGradient>
          </defs>
          <path
            d="M60 12c22 0 38 17 38 42 0 30-18 58-38 58S22 84 22 54c0-25 16-42 38-42z"
            fill="none"
            stroke="url(#ffFace)"
            strokeWidth="2"
          />
          <g fill="url(#ffFace)">
            <circle cx="46" cy="55" r="3" />
            <circle cx="74" cy="55" r="3" />
            <circle cx="60" cy="72" r="2.4" />
            <circle cx="49" cy="88" r="2.4" />
            <circle cx="71" cy="88" r="2.4" />
          </g>
          <g stroke="url(#ffFace)" strokeWidth="0.8" opacity="0.55" fill="none">
            <path d="M46 55 74 55 60 72 46 55M60 72 49 88 71 88 60 72M46 55 49 88M74 55 71 88" />
          </g>
        </svg>
        <span className="ff-scanner__beam" />
        <span className="ff-scanner__corner ff-scanner__corner--tl" />
        <span className="ff-scanner__corner ff-scanner__corner--tr" />
        <span className="ff-scanner__corner ff-scanner__corner--bl" />
        <span className="ff-scanner__corner ff-scanner__corner--br" />
      </div>
      {[1, 2, 3, 4].map((n) => (
        <div key={n} className={`ff-float ff-float--${n}`}>
          <div className="ff-float__img">
            <span className="ff-float__face" />
          </div>
          <span className="ff-float__tick">✓</span>
        </div>
      ))}
    </div>
  )
}

// The original Genesis Hub tool, kept working at /lab: a photo library in the
// browser + real face search through the backend (/api/analyze, /api/query).
export default function LabApp() {
  const library = useLibrary()
  const { stats } = library
  const libraryRef = useRef(null)
  const finderRef = useRef(null)
  const workspaceRef = useRef(null)

  const addPhotos = () => {
    libraryRef.current?.openPicker()
    workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="ff">
      <header className="ff-nav">
        <a className="ff-logo" href="#top">
          <img src="/brand/genesis-hub-mark-light.webp" alt="" style={{ height: 30 }} />
          Genesis Hub
        </a>
        <nav className="ff-nav__links">
          <a href="/">← Genesis Hub home</a>
          <a href="#how">How it works</a>
          {/* <a href="#features">Features</a> */}
          <a href="#faq">FAQ</a>
        </nav>
        <a className="ff-btn ff-btn--primary ff-btn--sm" href="#find">
          Get started
        </a>
      </header>

      <main id="top">
        <section className="ff-hero">
          <div className="ff-hero__copy">
            <span className="ff-pill">
              <span className="ff-pill__dot" />
              {stats.pending > 0
                ? `Analyzing photos… ${stats.done + stats.failed}/${stats.total}`
                : stats.total
                  ? `${stats.total.toLocaleString()} photos in your library`
                  : 'Your photos stay in your browser'}
            </span>
            <h1>
              Find every photo <span className="ff-gradient-text">a face is in.</span>
            </h1>
            <p className="ff-hero__lead">
              Drop in your photos, then show a face with a selfie or a picture. Face recognition checks every face
              in every photo and brings back the ones that match, in seconds.
            </p>
            <div className="ff-hero__ctas">
              <button className="ff-btn ff-btn--primary ff-btn--lg" onClick={addPhotos}>
                <UploadIcon /> Add photos
              </button>
              <button
                className="ff-btn ff-btn--ghost ff-btn--lg"
                onClick={() => finderRef.current?.openCamera()}
                disabled={!stats.total}
                title={stats.total ? undefined : 'Add photos first'}
              >
                <CameraIcon /> Find a face
              </button>
            </div>
            <ul className="ff-hero__stats">
              <li>
                <strong>{stats.total.toLocaleString()}</strong>
                <span>photos</span>
              </li>
              <li>
                <strong>{stats.faces.toLocaleString()}</strong>
                <span>faces found</span>
              </li>
              <li>
                <strong>0</strong>
                <span>kept on the server</span>
              </li>
            </ul>
          </div>
          <HeroVisual />
        </section>

        <section className="ff-workspace" id="find" ref={workspaceRef}>
          <div className="ff-panel">
            <Library ref={libraryRef} library={library} />
          </div>
          <div className="ff-panel ff-panel--glow">
            <Finder ref={finderRef} library={library} />
          </div>
        </section>

        <section className="ff-section" id="how">
          <span className="ff-eyebrow">How it works</span>
          <h2 className="ff-section__title">Three steps. No sign-up.</h2>
          <ol className="ff-steps">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="ff-step">
                <span className="ff-step__num">{i + 1}</span>
                <span className="ff-step__icon">
                  <Icon size={26} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="ff-section" id="features">
          <span className="ff-eyebrow">Features</span>
          <h2 className="ff-section__title">Built to find you, and only you.</h2>
          <div className="ff-features">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="ff-feature">
                <span className="ff-feature__icon">
                  <Icon size={22} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="ff-section ff-section--narrow" id="faq">
          <span className="ff-eyebrow">FAQ</span>
          <h2 className="ff-section__title">Good questions.</h2>
          <div className="ff-faq">
            {FAQ.map(({ q, a }) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="ff-cta">
          <h2>Ready to find someone?</h2>
          <p>Add your photos and show a face. That's it.</p>
          <button className="ff-btn ff-btn--primary ff-btn--lg" onClick={addPhotos}>
            <UploadIcon /> Add photos
          </button>
        </section>
      </main>

      <footer className="ff-footer">
        <span className="ff-logo ff-logo--small">
          <img src="/brand/genesis-hub-mark-light.webp" alt="" style={{ height: 22 }} />
          Genesis Hub
        </span>
        <span>Your photos stay in your browser. Face search powered by SCRFD + AdaFace.</span>
      </footer>
    </div>
  )
}
