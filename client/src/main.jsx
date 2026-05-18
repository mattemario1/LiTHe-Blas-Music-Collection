import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.name === 'AbortError' && event.reason?.message?.includes('media resource')) {
    event.preventDefault();
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);