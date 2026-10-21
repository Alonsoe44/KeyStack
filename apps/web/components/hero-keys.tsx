const whiteKeys = Array.from({ length: 7 }, (_, index) => index * 40)
// Black keys sit after C, D, F, G and A.
const blackKeys = [0, 1, 3, 4, 5].map((index) => index * 40 + 28)

/** A decorative one-octave keyboard drawn with the display tokens. */
export function HeroKeys({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="-8 -8 296 196"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect className="hero-keys-case" x="0" y="0" width="280" height="180" />
      {whiteKeys.map((x) => (
        <rect key={x} className="hero-keys-white" x={x} y="0" width="40" height="180" />
      ))}
      {blackKeys.map((x) => (
        <rect key={x} className="hero-keys-black" x={x} y="0" width="24" height="108" />
      ))}
    </svg>
  )
}
