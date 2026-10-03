import './globals.css'
import { ToastHost } from '@/lib/shared'

export const viewport = {
  themeColor: '#060d0d',
  width: 'device-width',
  initialScale: 1,
}

export const metadata = {
  title: { default: 'MakeItMeme — Le quotidien des jeux entre potes', template: '%s · MakeItMeme' },
  openGraph: {
    title: 'MakeItMeme',
    description: 'Des jeux entre potes, à jouer dans le navigateur : Caption Battle, Imposteur, Bomb Party.',
    locale: 'fr_FR',
    type: 'website',
  },
  description: 'Des jeux entre potes : légendes de memes, imposteur, bomb party. Édition du soir.',
}

// Emojis qui montent doucement derrière le contenu (décor discret)
const FLOATERS = [
  { e: '✦', left: '6%', size: '1.1rem', dur: 26, delay: 0, rot: 20 },
  { e: '◆', left: '18%', size: '0.8rem', dur: 32, delay: 11, rot: -25 },
  { e: '✦', left: '31%', size: '1.3rem', dur: 29, delay: 19, rot: 30 },
  { e: '◆', left: '44%', size: '0.9rem', dur: 35, delay: 5, rot: -20 },
  { e: '✦', left: '57%', size: '1.1rem', dur: 27, delay: 14, rot: 25 },
  { e: '◆', left: '69%', size: '1rem', dur: 33, delay: 23, rot: -30 },
  { e: '✦', left: '81%', size: '0.9rem', dur: 30, delay: 8, rot: 20 },
  { e: '◆', left: '92%', size: '1.2rem', dur: 28, delay: 17, rot: -18 },
]

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
          href="https://fonts.googleapis.com/css2?family=Unbounded:wght@600;700;800&family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600;700&family=Courier+Prime:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Fond animé décoratif, derrière tout le contenu */}
        <div className="bg-blobs" aria-hidden="true">
          {FLOATERS.map((f) => (
            <span
              key={`${f.left}`}
              className="float-emoji"
              style={
                {
                  left: f.left,
                  fontSize: f.size,
                  animationDuration: `${f.dur}s`,
                  animationDelay: `-${f.delay}s`,
                  '--float-rot': `${f.rot}deg`,
                } as React.CSSProperties
              }
            >
              {f.e}
            </span>
          ))}
        </div>
        {children}
        <ToastHost />
      </body>
    </html>
  )
}