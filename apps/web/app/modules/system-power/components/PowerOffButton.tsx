"use client"

import { useMemo, useState } from "react"
import { Power } from "lucide-react"

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { createHttpSystemPowerAdapter } from "../adapters/http-system-power-adapter"

type Status = "idle" | "shutting-down" | "error"

export function PowerOffButton() {
  const port = useMemo(() => createHttpSystemPowerAdapter(), [])
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)

  const shuttingDown = status === "shutting-down"

  const confirm = async () => {
    setStatus("shutting-down")
    setError(null)
    const result = await port.powerOff()
    if (!result.ok) {
      setStatus("error")
      setError(result.error ?? "Could not turn off")
    }
    // On success the dialog stays on "Turning off…" until the screen goes dark.
  }

  const onOpenChange = (next: boolean) => {
    if (shuttingDown) return
    setOpen(next)
    if (next) {
      setStatus("idle")
      setError(null)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger
        render={
          <Button
            variant="outline"
            size="icon-lg"
            className="power-button size-11"
            aria-label="Turn off"
          />
        }
      >
        <Power className="size-5" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>
          {shuttingDown ? "Turning off…" : "Turn off KeyStack?"}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {shuttingDown
            ? "Wait for the screen to go dark before unplugging the power."
            : "The piano will stop playing and the Pi will shut down completely. To turn it back on, unplug and reconnect the power."}
        </AlertDialogDescription>
        {status === "error" && error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {!shuttingDown && (
          <div className="flex justify-end gap-2">
            <AlertDialogClose
              render={<Button variant="outline" className="h-11 px-4" />}
            >
              Cancel
            </AlertDialogClose>
            <Button
              className="h-11 bg-destructive px-4 text-background hover:bg-destructive/80"
              onClick={confirm}
            >
              Turn off
            </Button>
          </div>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
