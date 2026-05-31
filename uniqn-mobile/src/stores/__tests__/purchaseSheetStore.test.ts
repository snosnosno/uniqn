// src/stores/__tests__/purchaseSheetStore.test.ts
import { usePurchaseSheetStore } from '../purchaseSheetStore';

it('open/close가 isOpen을 토글한다', () => {
  usePurchaseSheetStore.getState().open();
  expect(usePurchaseSheetStore.getState().isOpen).toBe(true);
  usePurchaseSheetStore.getState().close();
  expect(usePurchaseSheetStore.getState().isOpen).toBe(false);
});
