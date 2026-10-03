import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="relative z-10 min-h-screen flex items-center justify-center px-4 text-center text-white">
      <div className="paper p-8 max-w-md">
        <p className="eyebrow">Erreur 404</p>
        <h1 className="font-heading text-3xl mt-3">Cette page n’existe pas</h1>
        <p className="text-gray-400 mt-3 text-sm">Le lien est peut-être périmé : le jeu a pu être retiré.</p>
        <Link href="/" className="tag-dark inline-block mt-6 px-6 py-3">Retour à l’accueil</Link>
      </div>
    </main>
  )
}
