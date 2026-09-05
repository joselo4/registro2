import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './artisan.css'
import './sorbet.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
