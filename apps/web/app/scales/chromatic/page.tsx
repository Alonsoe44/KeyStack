import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { ChromaticPractice } from "@/components/chromatic-practice"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function Page() {
  return (
    <div className="route-page chromatic-page">
      <div className="panel-topline practice-topline">
        <div>
          <Link href="/scales" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "back-link")}>
            <ArrowLeft aria-hidden="true" />
            Practice
          </Link>
          <h1 className="panel-heading">Chromatic run.</h1>
        </div>
      </div>
      <ChromaticPractice />
    </div>
  )
}
