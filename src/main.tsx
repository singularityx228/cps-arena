import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initSecurityGuards } from './lib/security'

// Initialize all anti-inspect, anti-devtools, and domain guards immediately
initSecurityGuards()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
