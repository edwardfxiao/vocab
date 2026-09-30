import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App.tsx';
import { ROUTER_BASE } from './lib/base.ts';
import { loadDatasetIndex } from './lib/datasets.ts';
import './styles/globals.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');
const root = createRoot(container);

function Problem({ title, detail }: { title: string; detail: string }) {
  return (
    <main style={{ maxWidth: 640, margin: '80px auto', padding: '0 24px', fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>{title}</h1>
      <p style={{ color: '#495771' }}>{detail}</p>
    </main>
  );
}

// The collection list comes from data/index.json (one entry per data/*/dataset.json); nothing renders until it is known.
loadDatasetIndex().then(count => {
  if (!count) { root.render(<Problem title="No collections found." detail="Add a folder under data/ with a dataset.json and a CSV (see data/README.md), then reload." />); return; }
  root.render(<StrictMode><BrowserRouter basename={ROUTER_BASE}><App /></BrowserRouter></StrictMode>);
}).catch((error: unknown) => {
  root.render(<Problem title="Could not load the collection index." detail={error instanceof Error ? error.message : String(error)} />);
});
