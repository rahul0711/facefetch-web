// Small inline stroke icons (24x24, currentColor) -- no icon library needed.
const Svg = ({ children, size = 20, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...rest}
  >
    {children}
  </svg>
)

export const CameraIcon = (p) => (
  <Svg {...p}>
    <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </Svg>
)
export const UploadIcon = (p) => (
  <Svg {...p}>
    <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </Svg>
)
export const ScanIcon = (p) => (
  <Svg {...p}>
    <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
    <circle cx="12" cy="10.5" r="2.5" />
    <path d="M8 16.5c.8-1.6 2.3-2.5 4-2.5s3.2.9 4 2.5" />
  </Svg>
)
export const ImagesIcon = (p) => (
  <Svg {...p}>
    <rect x="3" y="6" width="14" height="14" rx="2" />
    <path d="M7 3h12a2 2 0 0 1 2 2v12" />
    <path d="m3 16 4-4 4 4 2-2 4 4" />
  </Svg>
)
export const ShieldIcon = (p) => (
  <Svg {...p}>
    <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
)
export const PhoneIcon = (p) => (
  <Svg {...p}>
    <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
    <path d="M11 18.5h2" />
  </Svg>
)
export const BoltIcon = (p) => (
  <Svg {...p}>
    <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3z" />
  </Svg>
)
export const UsersIcon = (p) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M16.5 14.6c2.3.3 4 2 4.5 4.9" />
  </Svg>
)
export const DownloadIcon = (p) => (
  <Svg {...p}>
    <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />
  </Svg>
)
export const SwitchIcon = (p) => (
  <Svg {...p}>
    <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
    <path d="M9.5 12.5a3 3 0 0 1 5-1.2l.5.7M14.5 15.5a3 3 0 0 1-5 1.2l-.5-.7M15 10v2h-2M9 18v-2h2" />
  </Svg>
)
export const CloseIcon = (p) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
)
export const ChevronIcon = ({ dir = 'right', ...p }) => (
  <Svg {...p}>
    <path d={dir === 'left' ? 'm15 5-7 7 7 7' : 'm9 5 7 7-7 7'} />
  </Svg>
)
export const RetryIcon = (p) => (
  <Svg {...p}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5M4 4v4.5h4.5" />
  </Svg>
)
export const LockIcon = (p) => (
  <Svg {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </Svg>
)
export const FolderIcon = (p) => (
  <Svg {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
  </Svg>
)
export const SearchIcon = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Svg>
)
