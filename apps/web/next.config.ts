import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // The LAN address the Pi's kiosk loads the dev server from; set by
  // `npm run pi:dev` (deploy/dev.sh).
  allowedDevOrigins: process.env.DEV_ORIGIN ? [process.env.DEV_ORIGIN] : [],
  output: "export",
}

export default nextConfig
