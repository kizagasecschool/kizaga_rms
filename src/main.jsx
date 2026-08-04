import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import { AppNotificationsProvider } from './context/AppNotificationsContext'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <NotificationProvider>
      <AuthProvider>
        <AppNotificationsProvider>
          <App />
        </AppNotificationsProvider>
      </AuthProvider>
    </NotificationProvider>
  </StrictMode>,
)
