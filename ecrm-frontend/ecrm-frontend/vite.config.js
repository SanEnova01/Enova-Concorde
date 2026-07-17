import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Cambia el camino largo anterior por solo 'dist'
    outDir: 'dist', 
  }
})