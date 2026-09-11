export function Shirt({label}: {label: string}) {
  return <svg viewBox="0 0 60 64" aria-hidden="true">
    <path d="M19 5 9 10 2 25 13 30 17 23 17 57 43 57 43 23 47 30 58 25 51 10 41 5 36 11 24 11Z" fill="#292929" stroke="#171717" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M18 25h24v17H18Z" fill="#f8f5e9"/>
    <path d="M21 6q9 13 18 0M3 24l10 5M47 29l10-5" fill="none" stroke="#f8f5e9" strokeWidth="2"/>
    <path d="M20 54h20" stroke="#55534d" strokeWidth="1"/>
    <text x="30" y="37" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#292929">{label}</text>
  </svg>;
}
