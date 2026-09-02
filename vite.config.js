import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

// Bake the build id INTO the bundle.
//
// UpdateChecker used to learn "what am I running" by fetching version.json on
// its first poll. That is circular: a tab holding a stale cached index.html
// fetches the CURRENT version.json, adopts it as its own baseline, and can then
// never detect that it is out of date. Open tabs stayed on an old bundle
// forever and no update banner ever appeared.
//
// scripts/write_version.js runs immediately before vite build (see the "build"
// script), so public/version.json already holds this build's id when this file
// is evaluated. Reading it here compiles the id into the JS, giving the client
// a fixed, honest answer to "which build am I?".
let buildId = 'dev'
try {
  buildId = JSON.parse(readFileSync('./public/version.json', 'utf8')).buildId || 'dev'
} catch {
  // no version.json yet (plain `vite dev`) - stays 'dev', and the checker
  // disables itself rather than prompting on every hot reload.
}

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
})
