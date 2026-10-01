import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonts are saved inside the app (so they work offline). Only the letters
// and weights we use are loaded, to keep the app small.
import '@fontsource/roboto/latin-400.css'
import '@fontsource/roboto/latin-700.css'
import '@fontsource/poppins/latin-700.css'
import '@fontsource/poppins/devanagari-700.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
