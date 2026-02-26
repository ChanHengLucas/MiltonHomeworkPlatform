import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css'
import App from './App.tsx'

// eslint-disable-next-line no-console
console.log('[Web] App mounting');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
