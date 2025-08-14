import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initializeHelpContent } from './lib/help-content-database'

// Initialize help content when app starts
initializeHelpContent();

createRoot(document.getElementById("root")!).render(<App />);
