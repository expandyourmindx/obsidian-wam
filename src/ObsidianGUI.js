import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import ObsidianPanel from './gui.jsx';

export function mountGUI(container, wam) {
  const root = createRoot(container);
  root.render(createElement(ObsidianPanel, { wam }));
  return root;
}
