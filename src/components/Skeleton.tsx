/** Placeholder block. Pulses only when the user hasn't asked for reduced motion. */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`rounded-control bg-border motion-safe:animate-pulse ${className}`}
    />
  )
}
