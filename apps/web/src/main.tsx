import { RouterProvider } from '@tanstack/react-router';
import { MotionConfig } from 'motion/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { createDataLayer, DataProvider } from '@/data';
import { restoreContrastMode } from '@/design/contrast-mode';
import { createAppRouter } from '@/router';

import './index.css';

restoreContrastMode();
const layer = createDataLayer();
const router = createAppRouter();

const root = document.getElementById('root');
if (!root) throw new Error('Elemen #root tidak ditemukan');

createRoot(root).render(
  <StrictMode>
    {/* Animasi mengikuti setelan "kurangi gerakan" di HP. */}
    <MotionConfig reducedMotion="user">
      <DataProvider layer={layer}>
        <RouterProvider router={router} />
      </DataProvider>
    </MotionConfig>
  </StrictMode>,
);
