import { tamaguiPlugin } from '@tamagui/vite-plugin'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import { readBuildInfo } from './scripts/build-info.ts'

export default defineConfig(({ mode }) => {
  const root = import.meta.dirname
  const buildInfo = readBuildInfo(root, mode, { ...loadEnv(mode, root, 'APP_'), ...process.env })
  const serializedBuildInfo = JSON.stringify(buildInfo, null, 2) + '\n'
  return {
    plugins: [
      {
        name: 'app-build-info',
        generateBundle() {
          this.emitFile({ type: 'asset', fileName: 'version.json', source: serializedBuildInfo })
        },
        configureServer(server) {
          server.middlewares.use((request, response, next) => {
            if (request.url?.split('?')[0] !== '/version.json' || !['GET', 'HEAD'].includes(request.method ?? '')) return next()
            response.setHeader('Content-Type', 'application/json; charset=utf-8')
            response.setHeader('Cache-Control', 'no-store')
            response.end(request.method === 'HEAD' ? undefined : serializedBuildInfo)
          })
        },
      },
      react(),
      tamaguiPlugin({
        // Design system compartido con la app móvil (mismo archivo copiado)
        config: './src/tamagui.config.ts',
        components: ['tamagui'],
        // Estilos en runtime: evitamos la extracción a CSS estático para
        // mantener paridad 1:1 con el comportamiento de la app móvil.
        disableExtraction: true,
      }),
    ],
    // OJO: el plugin de Tamagui define `envPrefix: ['TAMAGUI_']`, lo que
    // impide que las variables VITE_* lleguen al cliente. Las declaramos aquí
    // para que Vite haga merge y exponga también las nuestras.
    envPrefix: ['VITE_'],
    resolve: {
      alias: [
        // Tamagui necesita react-native-web en web
        { find: 'react-native', replacement: 'react-native-web' },
        { find: '@', replacement: resolve(import.meta.dirname, 'src') },
      ],
    },
    define: {
      __APP_BUILD_INFO__: JSON.stringify(buildInfo),
      global: 'window',
      DEV: `${mode === 'development'}`,
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    server: {
      port: 5173,
    },
  }
})
