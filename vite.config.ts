import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 端口跟随 PORT（部署时注入），本地默认 5273，避免与家庭事务台的 5173 冲突
const port = Number(process.env.PORT) || 5273

export default defineConfig({
  plugins: [vue()],
  base: './',
  build: { outDir: 'dist' },
  server: { host: '0.0.0.0', allowedHosts: true, port },
  preview: { host: '0.0.0.0', allowedHosts: true, port },
})
