import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Maps @credchain/shared → ../shared (monorepo workspace)
      '@credchain/shared': path.resolve(__dirname, '../shared'),
    },
  },
  // Allow @openzeppelin/merkle-tree to be pre-bundled for browser
  optimizeDeps: {
    include: ['@openzeppelin/merkle-tree', 'ethers'],
  },
  server: {
    port: 5173,
    open: true,
  },
})
