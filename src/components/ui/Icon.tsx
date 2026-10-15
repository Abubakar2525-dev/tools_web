import type { IconName } from "@/content/types";

/**
 * Custom icon set drawn for this project. 24px grid, 1.5px stroke,
 * round joins. Each glyph shares the "stacked layer" geometry of the mark.
 */
type ExtraIcon =
  | "arrow"
  | "plus"
  | "menu"
  | "close"
  | "chevron"
  | "external"
  | "braces"
  | "regex"
  | "table"
  | "token"
  | "api"
  | "markdown"
  | "binary"
  | "prompt"
  | "compass"
  | "checklist"
  | "calculator"
  | "sigma"
  | "percent"
  | "grade"
  | "calendar"
  | "deadline"
  | "timer"
  | "text"
  | "quote"
  | "practice"
  | "book"
  | "copy"
  | "reset"
  | "trash"
  | "download"
  | "info"
  | "alert"
  | "file"
  | "image"
  | "wave"
  | "globe"
  | "swap"
  | "coin"
  | "share"
  | "sun"
  | "car"
  | "briefcase"
  | "palette"
  | "folder"
  | "lock"
  | "qr"
  | "mic"
  | "scissors"
  | "ruler"
  | "hash"
  | "link"
  | "eye"
  | "pen"
  | "upload"
  | "play"
  | "pause"
  | "atom"
  | "bolt"
  | "heart"
  | "list"
  | "eraser"
  | "square"
  | "circle"
  | "align-left"
  | "align-center"
  | "align-right"
  | "signature";

const paths: Record<IconName | ExtraIcon, React.ReactNode> = {
  app: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9h17" />
      <path d="M8 13.5h4M8 16h7" />
    </>
  ),
  agent: (
    <>
      <circle cx="12" cy="7" r="2.75" />
      <path d="M12 9.75V13" />
      <path d="M5 19.5v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
      <path d="M4 7h3.25M16.75 7H20" />
    </>
  ),
  rag: (
    <>
      <path d="M5 5.5h9M5 9.5h6M5 13.5h4" />
      <circle cx="15.5" cy="14.5" r="3.5" />
      <path d="m18 17 2.5 2.5" />
    </>
  ),
  llm: (
    <>
      <path d="M4 8.5 12 4l8 4.5-8 4.5-8-4.5Z" />
      <path d="m4 12.5 8 4.5 8-4.5" />
      <path d="m4 16 8 4 8-4" opacity=".55" />
    </>
  ),
  workflow: (
    <>
      <rect x="3.5" y="4" width="6" height="5" rx="1.5" />
      <rect x="14.5" y="15" width="6" height="5" rx="1.5" />
      <path d="M9.5 6.5H14a3 3 0 0 1 3 3V15" />
      <path d="m15 13 2 2 2-2" />
    </>
  ),
  data: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="2.5" />
      <path d="M5 6v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6" />
      <path d="M5 12v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6" />
    </>
  ),
  code: (
    <>
      <path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4" />
      <path d="m13.25 5.5-2.5 13" />
    </>
  ),
  deploy: (
    <>
      <path d="M12 3.5v10" />
      <path d="m8 7.5 4-4 4 4" />
      <path d="M4.5 14.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 5 6v5.5c0 4.3 3 7.6 7 9 4-1.4 7-4.7 7-9V6l-7-2.5Z" />
      <path d="m9 12 2.25 2.25L15.5 10" />
    </>
  ),
  gauge: (
    <>
      <path d="M4.5 17a8 8 0 1 1 15 0" />
      <path d="m12 13 4-4" />
      <circle cx="12" cy="13.5" r="1.25" />
    </>
  ),
  layers: (
    <>
      <path d="M4 7.5 12 4l8 3.5-8 3.5-8-3.5Z" />
      <path d="m4 12 8 3.5 8-3.5" />
      <path d="m4 16.5 8 3.5 8-3.5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m15.5 15.5 4 4" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  spark: (
    <>
      <path d="M12 4v4M12 16v4M4 12h4M16 12h4" />
      <path
        d="m7 7 1.75 1.75M15.25 15.25 17 17M17 7l-1.75 1.75M8.75 15.25 7 17"
        opacity=".6"
      />
    </>
  ),
  braces: (
    <>
      <path d="M8.5 4.5H8a2 2 0 0 0-2 2v3a2.5 2.5 0 0 1-2.5 2.5A2.5 2.5 0 0 1 6 14.5v3a2 2 0 0 0 2 2h.5" />
      <path d="M15.5 4.5h.5a2 2 0 0 1 2 2v3a2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0-2.5 2.5v3a2 2 0 0 1-2 2h-.5" />
    </>
  ),
  regex: (
    <>
      <path d="M16.5 4v7M13.5 5.75l6 3.5M19.5 5.75l-6 3.5" />
      <rect x="4" y="15" width="4.5" height="4.5" rx="1" />
    </>
  ),
  table: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10" />
    </>
  ),
  token: (
    <>
      <rect x="3.5" y="7" width="5" height="10" rx="1.5" />
      <rect x="9.5" y="7" width="5" height="10" rx="1.5" />
      <rect x="15.5" y="7" width="5" height="10" rx="1.5" opacity=".5" />
    </>
  ),
  api: (
    <>
      <path d="M4 12h4l2-5 4 10 2-5h4" />
    </>
  ),
  markdown: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M6.5 15V9l2.5 3 2.5-3v6M15.5 9v6m-2-2 2 2 2-2" />
    </>
  ),
  binary: (
    <>
      <rect x="4.5" y="4.5" width="5" height="6" rx="2.5" />
      <path d="M16.5 4.5v6M14.5 6l2-1.5M7 13.5v6M5 15l2-1.5" />
      <rect x="14.5" y="13.5" width="5" height="6" rx="2.5" />
    </>
  ),
  prompt: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="m7.5 10 2.5 2-2.5 2M12 14.5h4.5" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15 9-1.75 4.25L9 15l1.75-4.25L15 9Z" />
    </>
  ),
  checklist: (
    <>
      <path d="m4 6.5 1.5 1.5L8 5.5M4 12.5 5.5 14 8 11.5M4 18.5 5.5 20 8 17.5" />
      <path d="M11 7h9M11 13h9M11 19h6" />
    </>
  ),
  calculator: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
      <path
        d="M8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"
        strokeWidth="2.2"
      />
    </>
  ),
  sigma: <path d="M17 5H7l5.5 7L7 19h10" />,
  percent: (
    <>
      <path d="M18.5 5.5 5.5 18.5" />
      <circle cx="7.5" cy="7.5" r="2.25" />
      <circle cx="16.5" cy="16.5" r="2.25" />
    </>
  ),
  grade: (
    <>
      <path d="M3 9.5 12 5l9 4.5-9 4.5-9-4.5Z" />
      <path d="M7 11.5v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4M21 9.5v5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  deadline: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M8 3v4M16 3v4M12 11v3.5l2 1.5" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 9.5V13l2.5 2M10 3h4" />
    </>
  ),
  text: <path d="M5 6.5V5h14v1.5M12 5v14M9.5 19h5" />,
  quote: (
    <>
      <path d="M5 17.5c2.5-1 3.5-3 3.5-6V7.5H5V12h3.5" />
      <path d="M14 17.5c2.5-1 3.5-3 3.5-6V7.5H14V12h3.5" />
    </>
  ),
  practice: (
    <>
      <path d="m8.5 8-4 4 4 4" />
      <path d="m13 14 2 2 4.5-5" />
    </>
  ),
  book: (
    <>
      <path d="M4.5 5.5A1.5 1.5 0 0 1 6 4h13.5v14H6a1.5 1.5 0 0 0-1.5 1.5v-14Z" />
      <path d="M4.5 19.5A1.5 1.5 0 0 0 6 21h13.5v-3" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
    </>
  ),
  reset: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4.5 4.5v4h4" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 7h15M9.5 7V5h5v2M6.5 7l1 12.5h9l1-12.5" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11m-4-4 4 4 4-4" />
      <path d="M5 19.5h14" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" strokeWidth="2" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4 3 19.5h18L12 4Z" />
      <path d="M12 10v4M12 17h.01" strokeWidth="2" />
    </>
  ),
  file: (
    <>
      <path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8L14 3.5Z" />
      <path d="M14 3.5V8h4.5M9 13h6M9 16.5h4" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.75" />
      <path d="m20.5 16-4.5-4.5L7 19.5" />
    </>
  ),
  wave: <path d="M3.5 12h2M7.5 8v8M11 5v14M14.5 9v6M18 7v10M20.5 12h0" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.5 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.5-3.5-8.5s1-5.9 3.5-8.5Z" />
    </>
  ),
  swap: (
    <path d="M5 8.5h13m-3.5-3.5L18 8.5 14.5 12M19 15.5H6m3.5-3.5L6 15.5 9.5 19" />
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.5 9.25c-.5-.9-1.4-1.25-2.5-1.25-1.4 0-2.5.75-2.5 1.9 0 2.85 5 1.4 5 4.2 0 1.2-1.1 1.9-2.5 1.9-1.2 0-2.1-.4-2.6-1.3M12 6.5v1.5M12 16v1.5" />
    </>
  ),
  share: (
    <>
      <circle cx="17.5" cy="6" r="2.5" />
      <circle cx="6.5" cy="12" r="2.5" />
      <circle cx="17.5" cy="18" r="2.5" />
      <path d="m8.7 10.8 6.6-3.6M8.7 13.2l6.6 3.6" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </>
  ),
  car: (
    <>
      <path d="M5 16.5V12l1.8-4.2A2 2 0 0 1 8.6 6.5h6.8a2 2 0 0 1 1.8 1.3L19 12v4.5" />
      <path d="M3.5 12h17v4.5h-17zM7 16.5V18.5M17 16.5V18.5" />
      <path d="M7.5 14.25h.01M16.5 14.25h.01" strokeWidth="2" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3.5" y="7.5" width="17" height="12" rx="2" />
      <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 12.5h17" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.1 0 1.75-.75 1.75-1.6 0-.5-.25-.9-.5-1.2-.3-.35-.5-.75-.5-1.2 0-.95.75-1.6 1.7-1.6h2a4.05 4.05 0 0 0 4.05-4.05C20.5 6.9 16.7 3.5 12 3.5Z" />
      <path
        d="M7.5 11h.01M9.5 7.5h.01M14 7h.01M16.75 10h.01"
        strokeWidth="2.2"
      />
    </>
  ),
  folder: (
    <path d="M3.5 7A1.5 1.5 0 0 1 5 5.5h4l2 2.5h8A1.5 1.5 0 0 1 20.5 9.5v8.5A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18V7Z" />
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2" />
    </>
  ),
  qr: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <path d="M14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM20 14v1M14 20h1" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3.5" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" />
    </>
  ),
  scissors: (
    <>
      <circle cx="6.5" cy="7" r="2.5" />
      <circle cx="6.5" cy="17" r="2.5" />
      <path d="M8.6 8.4 19 17.5M8.6 15.6 19 6.5" />
    </>
  ),
  ruler: (
    <>
      <path d="m3.5 15.5 12-12 5 5-12 12-5-5Z" />
      <path d="m7.5 11.5 2 2M10.5 8.5l1.5 1.5M13.5 5.5l2 2" />
    </>
  ),
  hash: <path d="M9.5 4 8 20M16 4l-1.5 16M4.5 9h15M4 15h15" />,
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.75" />
    </>
  ),
  pen: <path d="M15.5 4.5 19.5 8.5 8.5 19.5H4.5V15.5L15.5 4.5ZM13 7l4 4" />,
  eraser: (
    <>
      <path d="m14.5 4.5 5 5-9.5 9.5H5l-2-2 11.5-12.5Z" />
      <path d="m9.5 10 5 5M10 20h10" />
    </>
  ),
  square: <rect x="4" y="4" width="16" height="16" rx="1.5" />,
  circle: <circle cx="12" cy="12" r="8" />,
  "align-left": <path d="M4 6h16M4 10h11M4 14h16M4 18h9" />,
  "align-center": <path d="M4 6h16M6.5 10h11M4 14h16M7.5 18h9" />,
  "align-right": <path d="M4 6h16M9 10h11M4 14h16M11 18h9" />,
  signature: (
    <>
      <path d="M4 17c2.5-5 4-8 5.5-8 2 0-.5 7 .8 7 1 0 2.5-4 3.8-4 1.1 0-.2 3 .8 3 1.3 0 2.2-2 4.1-2" />
      <path d="M4 20h16" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15.5V4m-4 4 4-4 4 4" />
      <path d="M5 19.5h14" />
    </>
  ),
  play: <path d="M7.5 5v14l11-7-11-7Z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  atom: (
    <>
      <circle cx="12" cy="12" r="1.5" />
      <ellipse cx="12" cy="12" rx="9" ry="3.75" />
      <ellipse cx="12" cy="12" rx="9" ry="3.75" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3.75" transform="rotate(120 12 12)" />
    </>
  ),
  bolt: <path d="M13 3.5 5.5 13.5H12l-1 7 7.5-10H12l1-7Z" />,
  heart: (
    <path d="M12 19.5s-7.5-4.4-7.5-9.75A4.25 4.25 0 0 1 12 7.1a4.25 4.25 0 0 1 7.5 2.65C19.5 15.1 12 19.5 12 19.5Z" />
  ),
  list: (
    <path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" />
  ),
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  menu: <path d="M4 8h16M4 16h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  chevron: <path d="m7 10 5 5 5-5" />,
  external: (
    <path d="M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" />
  ),
};

export type AnyIcon = keyof typeof paths;

export function Icon({
  name,
  size = 20,
  className,
  strokeWidth = 1.5,
}: {
  name: AnyIcon;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}
