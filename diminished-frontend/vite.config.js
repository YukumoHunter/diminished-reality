import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import fs from 'fs'
// import basicSsl from '@vitejs/plugin-basic-ssl'


// https://vite.dev/config/
export default defineConfig({
  // plugins: [react(), basicSsl()],
  plugins: [react()],
  server: {
    https: {
      key: fs.readFileSync('../cert/key.pem'),
      cert: fs.readFileSync('../cert/cert.pem'),
    } 
  }
})
