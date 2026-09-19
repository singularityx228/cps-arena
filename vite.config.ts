import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import JavaScriptObfuscator from 'javascript-obfuscator'

// Advanced Production Obfuscator, Anti-Theft Domain Lock & HTML Flattener Plugin
function advancedProtectionPlugin() {
  return {
    name: 'custom-production-protection',
    enforce: 'post' as const,
    apply: 'build' as const,
    transformIndexHtml(html: string) {
      // Flatten & minify HTML into single line
      return html
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/>\s+</g, '><')
        .replace(/\s{2,}/g, ' ')
        .trim()
    },
    generateBundle(_options: any, bundle: any) {
      for (const fileName in bundle) {
        const chunk = bundle[fileName]
        if (chunk.type === 'chunk' && fileName.endsWith('.js')) {
          try {
            const obfuscationResult = JavaScriptObfuscator.obfuscate(chunk.code, {
              compact: true,
              controlFlowFlattening: true,
              controlFlowFlatteningThreshold: 0.6,
              deadCodeInjection: true,
              deadCodeInjectionThreshold: 0.15,
              stringArray: true,
              stringArrayEncoding: ['base64', 'rc4'],
              stringArrayThreshold: 0.85,
              splitStrings: true,
              splitStringsChunkLength: 6,
              identifierNamesGenerator: 'hexadecimal',
              transformObjectKeys: true,
              disableConsoleOutput: true,
              numbersToExpressions: true,
              simplify: true,
              unicodeEscapeSequence: false,
              domainLock: ['singularityx228.github.io', 'localhost', '127.0.0.1'],
              domainLockRedirectUrl: 'https://singularityx228.github.io/cps-arena/',
            })
            chunk.code = obfuscationResult.getObfuscatedCode()
          } catch (e) {
            console.warn('Obfuscation fallback for chunk:', fileName, e)
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
    advancedProtectionPlugin(),
  ],
})
