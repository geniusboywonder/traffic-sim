import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import CardMockup from './CardMockup.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CardMockup />
  </StrictMode>,
)
