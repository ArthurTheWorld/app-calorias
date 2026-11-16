import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { aplicarTema } from './temas'

aplicarTema() // antes do primeiro desenho, para não piscar a cor padrão

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
