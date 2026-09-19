import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import JavaScriptObfuscator from 'javascript-obfuscator'

// Custom Production Obfuscation Plugin (100% scrambles JS code while preserving full functionality)
function customObfuscatorPlugin() {
  return {
    name: 'custom-javascript-obfuscator',
    enforce: 'post' as const,
    apply: 'build' as const,
    generateBundle(_options: any, bundle: any) {
      for (const fileName in bundle) {
        const chunk = bundle[fileName]
        if (chunk.type === 'chunk' && fileName.endsWith('.js')) {
          const obfuscationResult = JavaScriptObfuscator.obfuscate(chunk.code, {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.4,
            deadCodeInjection: false,
            stringArray: true,
            stringArrayEncoding: ['base64'],
            stringArrayThreshold: 0.75,
            splitStrings: true,
            splitStringsChunkLength: 8,
            identifierNamesGenerator: 'hexadecimal',
            renameGlobals: false,
          })
          chunk.code = obfuscationResult.getObfuscatedCode()
        }
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/cps-arena/',
  plugins: [
    react(),
    tailwindcss(),
    customObfuscatorPlugin(),
  ],
})
