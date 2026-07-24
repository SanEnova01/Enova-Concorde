import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // Actualiza la app silenciosamente si hay una nueva versión
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'], // Archivos estáticos clave
      manifest: {
        name: 'Enova Concorde',
        short_name: 'Concorde',
        description: 'Panel de administración técnica y telemetría de tiendas.',
        theme_color: '#111111', // Color de la barra superior del celular
        background_color: '#f5f4f0', // Color de fondo mientras carga la app
        display: 'standalone', // Esto oculta la barra del navegador (parece app nativa)
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable' // Necesario para Android
          }
        ]
      }
    })
  ]
});