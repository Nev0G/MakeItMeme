// Affiché pendant le chargement d'une page : évite l'écran vide entre deux jeux
export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Chargement">
      <span className="w-10 h-10 rounded-full border-4 border-gray-800 border-t-purple-300 animate-spin" />
    </div>
  )
}
