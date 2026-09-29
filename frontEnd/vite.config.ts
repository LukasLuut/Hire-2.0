import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // caminho base do site publicado (ex.: /Hire-2.0/ no GitHub Pages); local e produção comum: "/"
  base: process.env.VITE_BASE ?? "/",
  plugins: [react(),
     tailwindcss(),
  ],
})
