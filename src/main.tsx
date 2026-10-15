import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
const node = document.getElementById('root');
if (node) createRoot(node).render(<React.StrictMode><App /></React.StrictMode>);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // The app remains fully usable online when service workers are unavailable.
    });
  });
}
