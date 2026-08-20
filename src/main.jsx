import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import GlobalErrorBoundary from './components/GlobalErrorBoundary'
import { setupGlobalErrorHandling } from './utils/globalErrors'
import './index.css'

// Setup global error and unhandled promise rejection listeners
setupGlobalErrorHandling()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
)