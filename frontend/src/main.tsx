import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AdminBooks from './AdminBooks.tsx'

const currentPath = window.location.pathname.toLowerCase()
const isAdminRoute = currentPath === '/adminbooks'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminRoute ? <AdminBooks /> : <App />}
  </StrictMode>,
)
