import { createRoot } from 'react-dom/client';
import App from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento root non trovato');
createRoot(root).render(<App />);
