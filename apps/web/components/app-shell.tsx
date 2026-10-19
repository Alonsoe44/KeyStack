"use client"

import { useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Disc3, Download, LibraryBig, Music2, Settings } from "lucide-react"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useImportJob } from "@/app/modules/song-import/components/ImportJobProvider"
import { useLyricsNavigationGuard } from "@/app/modules/song-player/components/LyricsNavigationGuard"

const navigation = [
  // "/" renders the Voices screen, so the kiosk boots straight into it.
  { href: "/instruments", label: "Voices", icon: Music2, match: ["/", "/instruments"] },
  { href: "/scales", label: "Practice", icon: LibraryBig, match: ["/scales"] },
  { href: "/songs", label: "Songs", icon: Disc3, match: ["/songs"] },
  { href: "/import", label: "Import", icon: Download, match: ["/import"] },
  { href: "/settings", label: "Settings", icon: Settings, match: ["/settings"] },
]

function isActive(pathname: string, match: string[]) {
  const path = pathname.replace(/\/$/, "") || "/"
  return match.some((prefix) => (prefix === "/" ? path === "/" : path === prefix || path.startsWith(`${prefix}/`)))
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { active: importActive } = useImportJob()
  const { request: requestLyricsLeave } = useLyricsNavigationGuard()

  // A running import owns the kiosk until publishing succeeds or fails.
  useEffect(() => {
    if (importActive && pathname !== "/import") router.replace("/import")
  }, [importActive, pathname, router])

  return (
    <div className="keystack-app">
      <nav className="side-nav" aria-label="Primary navigation">
        {navigation.map(({ href, label, icon: Icon, match }) => {
          const active = isActive(pathname, match)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "side-nav-link",
                active && "side-nav-link-active",
                importActive && href !== "/import" && "side-nav-link-locked"
              )}
              aria-current={active ? "page" : undefined}
              aria-disabled={importActive && href !== "/import"}
              onClick={(event) => {
                if (importActive && href !== "/import") event.preventDefault()
                if (event.defaultPrevented) return
                if (requestLyricsLeave(() => router.push(href))) event.preventDefault()
              }}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
      <ScrollArea render={<main />} role="main" className="site-main">
        {children}
      </ScrollArea>
    </div>
  )
}
