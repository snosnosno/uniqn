// src/components/wallet/__tests__/PurchaseSheet.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';

import { PurchaseSheet } from '../PurchaseSheet';
import { usePurchaseSheetStore } from '@/stores/purchaseSheetStore';

jest.mock('@/hooks/usePurchaseDiamonds', () => ({
  usePurchaseDiamonds: () => ({ status: 'idle', purchase: jest.fn(), reset: jest.fn() }),
}));
jest.mock('@/services/purchases', () => ({
  purchasesService: {
    isAvailable: () => true,
    getDiamondPackages: jest.fn(() => Promise.resolve([])),
  },
}));
jest.mock('@/repositories/supabase/WalletRepository', () => ({
  WalletRepository: {
    listProducts: jest.fn(() =>
      Promise.resolve([
        {
          product_id: 'uniqn_diamonds_3000',
          diamonds: 10,
          bonus_diamonds: 0,
          price_krw: 3000,
          display_order: 2,
          active: true,
        },
      ])
    ),
  },
}));

it('닫힌 상태면 시트 내용 미렌더', () => {
  usePurchaseSheetStore.setState({ isOpen: false });
  const { queryByText } = render(<PurchaseSheet />);
  expect(queryByText(/다이아 충전/)).toBeNull();
});

it('열린 상태면 제목 렌더', () => {
  usePurchaseSheetStore.setState({ isOpen: true });
  const { getByText } = render(<PurchaseSheet />);
  expect(getByText(/다이아 충전/)).toBeTruthy();
});
