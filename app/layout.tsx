import './globals.css'

export const metadata = {
  title: 'Caption Battle',
  description: 'Le jeu de memes multijoueur',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}