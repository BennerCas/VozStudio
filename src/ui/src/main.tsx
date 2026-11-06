import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import FigmaMakeApp from './FigmaMakeApp';
import './styles/figma-make.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('No se encontro el contenedor #root para inicializar VozStudio Omni-ES.');
}

createRoot(rootEl).render(
  <StrictMode>
    <FigmaMakeApp />
  </StrictMode>,
);
