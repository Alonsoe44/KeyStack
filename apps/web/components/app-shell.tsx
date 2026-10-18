import Link from "next/link"
import { Gauge, LibraryBig, Music2 } from "lucide-react"

import { PowerOffButton } from "@/app/modules/system-power/components/PowerOffButton"

const navigation = [
  { href: "/", label: "Home", icon: Gauge },
  { href: "/instruments", label: "Voices", icon: Music2 },
  { href: "/scales", label: "Practice", icon: LibraryBig },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="keystack-app">
      <header className="site-header">
        <Link href="/" className="brand-lockup" aria-label="KeyStack home">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="brand-word">KEYSTACK</span>
        </Link>

        <nav className="site-nav" aria-label="Primary navigation">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="site-nav-link">
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <span className="device-badge">LOCAL PI</span>
          <PowerOffButton />
        </div>
      </header>
      <main className="site-main">{children}</main>
      <footer className="site-footer">
        <span>KEYSTACK / PIANO LAB</span>
        <span>PLAY THE NEXT NOTE</span>
      </footer>
    </div>
  )
}
