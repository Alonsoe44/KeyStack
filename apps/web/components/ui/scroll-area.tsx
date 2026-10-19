"use client"

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area"

import { cn } from "@/lib/utils"

type Orientation = "vertical" | "horizontal" | "both"

/**
 * KeyStack's scroll container. Use it for every scrolling region instead of
 * `overflow: auto`: it replaces the native scrollbar with a thick, square,
 * touch-draggable one that fits the kiosk's 800×480 touch screen.
 *
 * - `className` styles the frame: size limits (max-height, flex), borders.
 * - `viewportClassName` styles the scrolling box itself: padding, flex/grid
 *   layout and gaps of the content.
 * - The root renders with role="presentation" (Base UI). Put accessible
 *   names and live regions on the viewport via `viewportProps`; pass `role`
 *   when rendering a landmark, e.g. `render={<main />} role="main"`.
 * - `viewportRef` reaches the element that actually scrolls (for scrollTo or
 *   scrollIntoView logic); `viewportProps` puts attributes such as
 *   `role="list"` on it, next to the content they describe.
 */
function ScrollArea({
  className,
  viewportClassName,
  viewportRef,
  viewportProps,
  orientation = "vertical",
  children,
  ...props
}: ScrollAreaPrimitive.Root.Props & {
  viewportClassName?: string
  viewportRef?: React.Ref<HTMLDivElement>
  viewportProps?: Omit<ScrollAreaPrimitive.Viewport.Props, "className" | "ref" | "children">
  orientation?: Orientation
}) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      data-scroll-orientation={orientation}
      className={cn("scroll-area", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        {...viewportProps}
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        className={cn("scroll-area-viewport", viewportClassName)}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      {orientation !== "horizontal" && <ScrollBar orientation="vertical" />}
      {orientation !== "vertical" && <ScrollBar orientation="horizontal" />}
      {orientation === "both" && <ScrollAreaPrimitive.Corner className="scroll-area-corner" />}
    </ScrollAreaPrimitive.Root>
  )
}

/** The thick bar and thumb. Rendered by ScrollArea; exported for custom layouts. */
function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn("scroll-area-scrollbar", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb data-slot="scroll-area-thumb" className="scroll-area-thumb" />
    </ScrollAreaPrimitive.Scrollbar>
  )
}

export { ScrollArea, ScrollBar }
