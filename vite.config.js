import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// `base` is "/" for Netlify, Vercel and any root deploy. For a GitHub Pages project site the
// workflow in .github/workflows/pages.yml sets VITE_BASE to "/<repo-name>/" at build time.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react(), tailwindcss()],
})
