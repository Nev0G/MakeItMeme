// Transition douce entre les pages (rejouée à chaque navigation)
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-fadein">{children}</div>
}
