import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/chakra-petch/400.css'
import '@fontsource/chakra-petch/600.css'
import '@fontsource/chakra-petch/700.css'
import '@fontsource/chakra-petch/600-italic.css'
import '@fontsource/chakra-petch/700-italic.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/bangers/400.css'
import '@fontsource/comic-neue/400.css'
import '@fontsource/comic-neue/700.css'
import '@fontsource/vt323/400.css'
import './theme.css'
import './toon.css'
import './motorsport.css'
import './terminal.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
