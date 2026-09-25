import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './artisan.css'
import './sorbet.css'
import App from './App.jsx'
import './storefront-refresh.css'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { reloadForNewDeploy } from './utils/staleDeploy'

// Vite reports a missing preloaded chunk (old tab after a deploy) here.
window.addEventListener('vite:preloadError', event => {
  if (reloadForNewDeploy()) event.preventDefault();
});
document.documentElement.classList.remove('startup-failed');
window.dispatchEvent(new Event('friozo:ready'));

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
