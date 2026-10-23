import './globals.css'
import { ToastHost } from '@/lib/shared'

export const viewport = {
  themeColor: '#08080d',
  width: 'device-width',
  initialScale: 1,
}

export const metadata = {
  title: { default: 'MakeItMeme — Le quotidien des jeux entre potes', template: '%s · MakeItMeme' },
  openGraph: {
    title: 'MakeItMeme',
    description: 'Des jeux entre potes, à jouer dans le navigateur : Caption Battle, Imposteur, Bomb Party, Pictionary.',
    locale: 'fr_FR',
    type: 'website',
  },
  description: 'Des jeux entre potes : légendes de memes, imposteur, bomb party. Édition du soir.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Rubik:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="aurora" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        {children}
        <ToastHost />
      </body>
    </html>
  )
}