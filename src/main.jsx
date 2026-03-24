import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './components/ThemeProvider'
import { ModelingProvider } from './lib/ModelingContext'
import { OutageProvider } from './lib/OutageContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark">
      <ModelingProvider>
        <OutageProvider>
          <App />
        </OutageProvider>
      </ModelingProvider>
    </ThemeProvider>
  </React.StrictMode>
)
