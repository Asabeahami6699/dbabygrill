import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

/** Stop mouse wheel from changing focused number inputs (browser default after hiding spinners). */
document.addEventListener(
  'wheel',
  (e) => {
    const el = document.activeElement;
    if (
      el instanceof HTMLInputElement &&
      el.type === 'number' &&
      el.classList.contains('no-number-spin')
    ) {
      e.preventDefault();
    }
  },
  { passive: false, capture: true }
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
);