import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { iniciarLatido } from './estado/tienda'
import './estilos.css'
import './ui/animaciones.css'
import './ui/escenario.css'
import { cargarFuentes } from './ui/fuentes'

cargarFuentes()

iniciarLatido()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
