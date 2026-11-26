import { RouterProvider } from '@tanstack/react-router';
import { LazyMotion, MotionConfig } from 'motion/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { createDataLayer, DataProvider } from '@/data';
import { restoreContrastMode } from '@/design/contrast-mode';
import { createAppRouter } from '@/router';

import './index.css';

restoreContrastMode();
const layer = createDataLayer();
const motionFeatures = () => import('@/lib/motion-features').then((mod) => mod.default);
const router = createAppRouter();

const root = document.getElementById('root');
if (!root) throw new Error('Elemen #root tidak ditemukan');

createRoot(root).render(
  <StrictMode>
    {/* Animasi mengikuti setelan "kurangi gerakan" di HP. */}
    <MotionConfig reducedMotion="user">
      <LazyMotion features={motionFeatures} strict>
        <DataProvider layer={layer}>
          <RouterProvider router={router} />
        </DataProvider>
      </LazyMotion>
    </MotionConfig>
  </StrictMode>,
);
