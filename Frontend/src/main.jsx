import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// NOTE: StrictMode intentionally removed — in React 18 dev mode it double-invokes
// useEffect, which fired loadQuestion twice on mount and reset the question
// mid-recording, causing the Whisper 500 error on the 2nd recording.
createRoot(document.getElementById('root')).render(<App />)