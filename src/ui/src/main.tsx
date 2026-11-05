import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WorkspaceHub } from './WorkspaceHub';
import './styles/studio.css';
import './styles/workspace-hub.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('No se encontro el contenedor #root para inicializar VozStudio Omni-ES.');
}

createRoot(rootEl).render(
  <StrictMode>
    <WorkspaceHub />
  </StrictMode>,
);
