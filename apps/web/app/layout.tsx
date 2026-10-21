import "./globals.css"
import { SongPlayerProvider } from "@/app/modules/song-player/components/SongPlayerProvider"
import { LyricsNavigationGuardProvider } from "@/app/modules/song-player/components/LyricsNavigationGuard"
import { ImportJobProvider } from "@/app/modules/song-import/components/ImportJobProvider"
import { ControllerProvider } from "@/app/modules/midi-connection/components/ControllerProvider"
import { OnScreenKeyboard } from "@/app/modules/onscreen-keyboard/components/OnScreenKeyboard"
import { AppShell } from "@/components/app-shell"
import { ThemeProvider } from "@/components/theme-provider"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="antialiased font-sans"
    >
      <body>
        <ThemeProvider>
          <SongPlayerProvider>
            <ImportJobProvider>
              <LyricsNavigationGuardProvider>
                <ControllerProvider>
                  <AppShell>{children}</AppShell>
                  <OnScreenKeyboard />
                </ControllerProvider>
              </LyricsNavigationGuardProvider>
            </ImportJobProvider>
          </SongPlayerProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
