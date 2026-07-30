import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CreatePage } from './pages/CreatePage';
import './styles/create.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Hubly Create root element missing');
}

createRoot(rootEl).render(
  <StrictMode>
    <CreatePage />
  </StrictMode>,
);
