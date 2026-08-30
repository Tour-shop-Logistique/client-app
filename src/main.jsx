import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { store } from './store';
import { sessionExpired } from './store/slices/authSlice';
import App from './App.jsx';
import './index.css';

// The API interceptor fires this on any 401 (revoked/expired Sanctum token,
// e.g. after reset-password wipes every token) — drop the session store-side.
window.addEventListener('auth:unauthorized', () => store.dispatch(sessionExpired()));

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
        <Toaster position="top-center" richColors closeButton />
      </BrowserRouter>
    </Provider>
  </StrictMode>
);
