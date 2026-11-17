import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './ui/App';
import { RegressionGallery } from './ui/RegressionGallery';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  const isGallery =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('state') === 'gallery';

  root.render(
    <React.StrictMode>
      {isGallery ? <RegressionGallery /> : <App />}
    </React.StrictMode>
  );
}
