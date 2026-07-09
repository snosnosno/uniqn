import type { ReactNode } from 'react';

interface SheetProviderProps {
  children: ReactNode;
}

export function SheetProvider({ children }: SheetProviderProps) {
  return <>{children}</>;
}
