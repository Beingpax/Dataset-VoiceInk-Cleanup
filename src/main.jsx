import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { BenchmarkProvider } from './context/BenchmarkContext.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <BenchmarkProvider>
        <App />
      </BenchmarkProvider>
    </HashRouter>
  </StrictMode>,
);
