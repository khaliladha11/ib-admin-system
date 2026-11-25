import { useEffect, type ReactNode } from 'react';

import { DataContext, type DataLayer } from './context';

export interface DataProviderProps {
  layer: DataLayer;
  /** Jalankan sinkron latar belakang (mati di tes). */
  autoSync?: boolean;
  children: ReactNode;
}

export function DataProvider({ layer, autoSync = true, children }: DataProviderProps) {
  useEffect(() => (autoSync ? layer.sync.start() : undefined), [layer, autoSync]);
  return <DataContext value={layer}>{children}</DataContext>;
}
