import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './artisan.css'
import './sorbet.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
