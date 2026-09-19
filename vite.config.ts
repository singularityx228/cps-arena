import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import JavaScriptObfuscator from 'javascript-obfuscator'

// Production Obfuscator Plugin (100% stable, scrambles code without breaking React runtime)
function customObfuscatorPlugin() {
  return {
    name: 'custom-javascript-obfuscator',
    enforce: 'post' as const,
    apply: 'build' as const,
    generateBundle(_options: any, bundle: any) {
      for (const fileName in bundle) {
        const chunk = bundle[fileName]
        if (chunk.type === 'chunk' && fileName.endsWith('.js')) {
          try {
            const obfuscationResult = JavaScriptObfuscator.obfuscate(chunk.code, {
              compact: true,
              controlFlowFlattening: true,
              controlFlowFlatteningThreshold: 0.3,
              deadCodeInjection: false,
              debugProtection: true,
              debugProtectionInterval: 2000,
              stringArray: true,
              stringArrayEncoding: ['base64'],
              stringArrayThreshold: 0.75,
              splitStrings: true,
              splitStringsChunkLength: 8,
              identifierNamesGenerator: 'hexadecimal',
              renameGlobals: false,
            })
            chunk.code = obfuscationResult.getObfuscatedCode()
          } catch (e) {
            console.warn('Obfuscation skipped for chunk:', fileName, e)
          }
        }
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/cps-arena/',
  build: {
    sourcemap: false,
    cssMinify: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    customObfuscatorPlugin(),
  ],
})
