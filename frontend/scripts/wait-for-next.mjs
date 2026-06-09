#!/usr/bin/env node
/**
 * Wait for Next.js dev server and pre-compile initial chunks before Tauri opens.
 * Used by scripts/start-dev-server.mjs (optional dev entrypoint).
 */

const DEV_URL = process.env.NEXT_DEV_URL || 'http://localhost:3118'
const MAX_WAIT_MS = 120_000
const POLL_MS = 500

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForServer() {
  const deadline = Date.now() + MAX_WAIT_MS
  while (Date.now() < deadline) {
    try {
      const res = await fetch(DEV_URL, { signal: AbortSignal.timeout(5000) })
      if (res.ok) return
    } catch {
      // Server not ready yet
    }
    await sleep(POLL_MS)
  }
  throw new Error(`Next.js dev server did not start within ${MAX_WAIT_MS / 1000}s`)
}

async function warmChunks() {
  const html = await fetch(DEV_URL, { signal: AbortSignal.timeout(30_000) }).then((r) => r.text())
  const scripts = [
    ...new Set(
      [...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+)"/g)].map((match) => match[1])
    ),
  ]

  for (const src of scripts) {
    const url = `${DEV_URL}${src}`
    const deadline = Date.now() + MAX_WAIT_MS
    while (Date.now() < deadline) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
        if (res.ok) {
          console.log(`[wait-for-next] warmed ${src}`)
          break
        }
      } catch {
        // Chunk still compiling
      }
      await sleep(POLL_MS)
    }
  }
}

async function main() {
  console.log('[wait-for-next] waiting for dev server…')
  await waitForServer()
  console.log('[wait-for-next] warming initial chunks…')
  await warmChunks()
  console.log('[wait-for-next] ready')
}

main().catch((err) => {
  console.error('[wait-for-next]', err.message)
  process.exit(1)
})
