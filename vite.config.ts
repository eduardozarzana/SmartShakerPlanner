import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/SmartShakerPlanner/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
