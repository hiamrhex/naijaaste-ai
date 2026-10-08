import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import NaijaTasteAI from './NaijaTasteAI'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <NaijaTasteAI/>
  </StrictMode>,
)
