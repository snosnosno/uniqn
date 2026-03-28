import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import type { ReactNode } from 'react';

interface SheetProviderProps {
  children: ReactNode;
}

export function SheetProvider({ children }: SheetProviderProps) {
  return <BottomSheetModalProvider>{children}</BottomSheetModalProvider>;
}

export default SheetProvider;
