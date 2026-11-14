/** Brand mark: a spreadsheet page on a purple tile. Same art as app/icon.svg. */
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden
      className={`shrink-0 rounded-xl shadow-[3px_3px_0_0_#1B1340] ${className}`}
    >
      <rect
        x="1.5"
        y="1.5"
        width="61"
        height="61"
        rx="12"
        fill="#A78BFA"
        stroke="#1B1340"
        strokeWidth="3"
      />
      <path
        d="M16 12h24l9 9v31H16z"
        fill="#fff"
        stroke="#1B1340"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M40 12v9h9"
        fill="#FFC845"
        stroke="#1B1340"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M22 30h21M22 37h21M22 44h21M30 26v22"
        stroke="#1B1340"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
