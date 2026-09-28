import './globals.css'

export const metadata = {
  title: 'Caption Battle',
  description: 'Le jeu de memes multijoueur',
}

// Emojis qui montent doucement derrière le contenu (décor discret)
const FLOATERS = [
  { e: '😂', left: '6%', size: '2rem', dur: 26, delay: 0, rot: 20 },
  { e: '🔥', left: '18%', size: '1.6rem', dur: 32, delay: 11, rot: -25 },
  { e: '🐸', left: '31%', size: '2.2rem', dur: 29, delay: 19, rot: 30 },
  { e: '💀', left: '44%', size: '1.8rem', dur: 35, delay: 5, rot: -20 },
  { e: '🍕', left: '57%', size: '2rem', dur: 27, delay: 14, rot: 25 },
  { e: '🤡', left: '69%', size: '2.4rem', dur: 33, delay: 23, rot: -30 },
  { e: '👀', left: '81%', size: '1.7rem', dur: 30, delay: 8, rot: 20 },
  { e: '🦄', left: '92%', size: '2rem', dur: 28, delay: 17, rot: -18 },
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
          href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Fond animé décoratif, derrière tout le contenu */}
        <div className="bg-blobs" aria-hidden="true">
          <span className="blob blob-1" />
          <span className="blob blob-2" />
          <span className="blob blob-3" />
          {FLOATERS.map((f) => (
            <span
              key={f.e}
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
      </body>
    </html>
  )
}