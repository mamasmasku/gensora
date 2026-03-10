import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import AppWrapper from './AppWrapper';
import LoginPage from './pages/LoginPage';

const path = window.location.pathname;
const root = createRoot(document.getElementById('root')!);

// Routing sederhana tanpa React Router
// /login → halaman login tab baru (untuk flow iframe Blogger)
// yang lain → app utama
if (path === '/login') {
  root.render(
    <StrictMode>
      <LoginPage />
    </StrictMode>
  );
} else {
  root.render(
    <StrictMode>
      <AppWrapper />
    </StrictMode>
  );
}
