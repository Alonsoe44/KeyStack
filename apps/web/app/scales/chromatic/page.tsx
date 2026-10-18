import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { ChromaticPractice } from "@/components/chromatic-practice"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function Page() {
  return (
    <div className="route-page chromatic-page">
      <div className="route-topline">
        <Link href="/scales" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "back-link")}>
          <ArrowLeft aria-hidden="true" />
          Practice room
        </Link>
        <span className="route-number">CHROMATIC / 01</span>
      </div>
      <header className="practice-header">
        <div>
          <span className="eyebrow">TECHNIQUE BUILDER</span>
          <h1 className="display-heading practice-heading">CHROMATIC<br /><span>RUN.</span></h1>
        </div>
        <p className="practice-lede">One note at a time. Choose your range, follow the fingering, and keep the pulse moving.</p>
      </header>
      <ChromaticPractice />
    </div>
  )
}
