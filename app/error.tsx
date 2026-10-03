'use client'

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="relative z-10 min-h-screen flex items-center justify-center px-4 text-center text-white">
      <div className="paper p-8 max-w-md">
        <p className="eyebrow">Incident technique</p>
        <h1 className="font-heading text-3xl mt-3">Quelque chose a planté</h1>
        <p className="text-gray-400 mt-3 text-sm">Pas de panique : recharge la page ou réessaie.</p>
        <div className="flex flex-wrap justify-center gap-3 mt-6">
          <button type="button" onClick={reset} className="tag-dark px-6 py-3">Réessayer</button>
          <a href="/" className="tag-dark px-6 py-3">Accueil</a>
        </div>
      </div>
    </main>
  )
}
