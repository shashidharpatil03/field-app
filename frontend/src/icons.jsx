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
