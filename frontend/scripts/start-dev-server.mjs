#!/usr/bin/env node
/**
 * Start Next.js dev server and warm chunks before keeping the process alive for Tauri.
 */

import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.resolve(__dirname, '..')

const next = spawn('pnpm', ['exec', 'next', 'dev', '-p', '3118', '--webpack'], {
  cwd: frontendRoot,
  stdio: 'inherit',
  shell: true,
})

let shuttingDown = false

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  next.kill('SIGTERM')
  process.exit(code)
}

next.on('exit', (code) => {
  if (!shuttingDown) {
    process.exit(code ?? 1)
  }
})

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

async function warmWhenReady() {
  const waitScript = path.join(__dirname, 'wait-for-next.mjs')
  const warmer = spawn('node', [waitScript], {
    cwd: frontendRoot,
    stdio: 'inherit',
  })

  warmer.on('exit', (code) => {
    if (code !== 0) {
      console.warn('[start-dev-server] chunk warmup failed; app may retry on first load')
    } else {
      console.log('[start-dev-server] chunks ready — if UI shows stale content, reload the window (Cmd+R)')
    }
  })
}

// Give Next a moment to bind before polling
setTimeout(() => {
  warmWhenReady().catch((err) => {
    console.warn('[start-dev-server] warmup error:', err.message)
  })
}, 1000)
