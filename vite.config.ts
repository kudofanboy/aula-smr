import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The public edition always bundles the fictional demo course.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
  build: { outDir: 'dist', sourcemap: false },
})
