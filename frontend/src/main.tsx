import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { resolveInitialLocale, resolveIntlLocale } from './i18n/provider'
import './index.css'

// Set initial document language to avoid text flash and improve accessibility
document.documentElement.lang = resolveIntlLocale(resolveInitialLocale());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
