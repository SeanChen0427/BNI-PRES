import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@/app/globals.css';
import { LeadershipWorkspace } from '@/components/leadership-workspace';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LeadershipWorkspace />
  </StrictMode>,
);
