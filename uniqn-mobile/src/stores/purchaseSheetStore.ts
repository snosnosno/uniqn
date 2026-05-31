/**
 * UNIQN Mobile - purchaseSheetStore
 * @description 전역 다이아 충전 시트 open/close. PaywallModal·지갑 카드 등 어디서든 open() 호출.
 */
import { create } from 'zustand';

interface PurchaseSheetState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const usePurchaseSheetStore = create<PurchaseSheetState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
