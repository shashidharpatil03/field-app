// Simple line icons drawn as SVG. They use the text colour (currentColor).

function Icon({ children }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width="44"
      height="44"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function FarmerIcon() {
  return (
    <Icon>
      <circle cx="18" cy="16" r="6" />
      <path d="M6 41c0-7 5-12 12-12s12 5 12 12" />
      <circle cx="35" cy="19" r="5" />
      <path d="M31 30c1.2-.7 2.5-1 4-1 5.5 0 9 4 9 10" />
    </Icon>
  );
}

export function PracticeIcon() {
  return (
    <Icon>
      <path d="M24 42V24" />
      <path d="M24 30c-8 0-13-5-13-13 8 0 13 5 13 13z" />
      <path d="M24 25c0-8 5-13 13-13 0 8-5 13-13 13z" />
      <path d="M14 42h20" />
    </Icon>
  );
}

export function CapacityIcon() {
  return (
    <Icon>
      <path d="M5 13c6-2 13-2 19 2 6-4 13-4 19-2v24c-6-2-13-2-19 2-6-4-13-4-19-2z" />
      <path d="M24 15v24" />
    </Icon>
  );
}

export function RirIcon() {
  return (
    <Icon>
      <rect x="8" y="26" width="8" height="14" rx="1.5" />
      <rect x="20" y="16" width="8" height="24" rx="1.5" />
      <rect x="32" y="7" width="8" height="33" rx="1.5" />
      <path d="M5 43h38" />
    </Icon>
  );
}

export function PuIcon() {
  return (
    <Icon>
      <circle cx="24" cy="10" r="5" />
      <circle cx="10" cy="38" r="5" />
      <circle cx="38" cy="38" r="5" />
      <path d="M24 15v9" />
      <path d="M10 33v-9h28v9" />
    </Icon>
  );
}

export function PhoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </svg>
  );
}

export function HomeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v10h13V10" />
      <path d="M10 20v-6h4v6" />
    </svg>
  );
}

// Three lines of shrinking length: the usual "filter" symbol.
export function FilterIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M3 5h18M6 12h12M10 19h4" />
    </svg>
  );
}

export function ChevronRightIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function SentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
    </svg>
  );
}

export function IncompleteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" />
      <path d="M14 3v6h6M9 14h6M9 17h3" />
    </svg>
  );
}

export function ReadyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 15v4a1 1 0 001 1h14a1 1 0 001-1v-4" />
    </svg>
  );
}
