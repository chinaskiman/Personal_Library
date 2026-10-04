// Minimal Chrome DevTools Protocol driver.
//
// Uses the Chrome already installed on this machine over a raw WebSocket, so the
// theme can be exercised in a real browser without adding a testing dependency.
// Node 22+ ships a global WebSocket, so nothing is installed.
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME =
  process.env.CHROME_PATH ??
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

/** Launch headless Chrome and return a connected CDP session. */
export async function launch({ prefersDark = false } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'theme-cdp-'))
  const port = 9222 + Math.floor(Math.random() * 500)

  const args = [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--window-size=1280,900',
  ]
  // Emulate the OS colour scheme before any script runs, so the pre-paint
  // script and the hook both observe the same value.
  args.push(prefersDark ? '--force-dark-mode' : '--disable-features=WebContentsForceDark')

  const proc = spawn(CHROME, args, { stdio: 'ignore' })

  // Poll the debugging endpoint until Chrome is listening.
  let version = null
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`)
      version = await res.json()
      break
    } catch {
      await new Promise((r) => setTimeout(r, 100))
    }
  }
  if (!version) {
    proc.kill()
    throw new Error('Chrome did not expose a debugging port')
  }

  // A fresh tab, so the page starts with empty storage.
  const targetRes = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {
    method: 'PUT',
  })
  const target = await targetRes.json()

  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = () => reject(new Error('CDP socket failed'))
  })

  let nextId = 0
  const pending = new Map()
  const listeners = new Map()

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(JSON.stringify(msg.error)))
      else resolve(msg.result)
    } else if (msg.method) {
      for (const fn of listeners.get(msg.method) ?? []) fn(msg.params)
    }
  }

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = (nextId += 1)
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
    })

  const on = (method, fn) => {
    if (!listeners.has(method)) listeners.set(method, [])
    listeners.get(method).push(fn)
  }

  await send('Page.enable')
  await send('Runtime.enable')

  return {
    send,
    on,
    async goto(url) {
      const loaded = new Promise((resolve) => on('Page.loadEventFired', resolve))
      await send('Page.navigate', { url })
      await loaded
    },
    /** Evaluate an expression in the page and return its JSON value. */
    async eval(expression) {
      const result = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      })
      if (result.exceptionDetails) {
        throw new Error(
          `page threw: ${result.exceptionDetails.exception?.description ?? 'unknown'}`,
        )
      }
      return result.result.value
    },

    /**
     * Focus the first element matching `selector` and type into it.
     *
     * Uses CDP's `Input.insertText`, which produces the same input events a real
     * keystroke would. Setting `element.value` directly does not work against a
     * controlled React input — React tracks the previous value and ignores it.
     */
    async typeInto(selector, text) {
      const focused = await this.eval(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)})
        if (!el) return false
        el.focus()
        return document.activeElement === el
      })()`)
      if (!focused) throw new Error(`could not focus ${selector}`)
      await send('Input.insertText', { text })
    },
    /** Reload and wait for the document to finish loading. */
    async reload() {
      const loaded = new Promise((resolve) => on('Page.loadEventFired', resolve))
      await send('Page.reload', {})
      await loaded
    },
    async setEmulatedDark(dark) {
      await send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }],
      })
    },
    async close() {
      try {
        ws.close()
      } catch {
        /* already closing */
      }
      proc.kill()
      await new Promise((r) => setTimeout(r, 150))
      try {
        rmSync(profile, { recursive: true, force: true })
      } catch {
        /* best effort */
      }
    },
  }
}