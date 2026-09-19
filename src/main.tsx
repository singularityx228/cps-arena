import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initSecurityGuards } from './lib/security'
import { globalLeaderboardService } from './lib/realtime'

// Initialize all anti-inspect, anti-devtools, and domain guards immediately
initSecurityGuards()

// Initialize cloud leaderboard background sync
globalLeaderboardService.init()


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
