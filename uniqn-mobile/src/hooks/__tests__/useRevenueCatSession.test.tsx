import { renderHook } from '@testing-library/react-native';

import { useRevenueCatSession } from '../useRevenueCatSession';

const mockConfigure = jest.fn((..._a: unknown[]) => Promise.resolve());
const mockLogOut = jest.fn((..._a: unknown[]) => Promise.resolve());
jest.mock('@/services/purchases', () => ({
  purchasesService: {
    configure: (...a: unknown[]) => mockConfigure(...a),
    logOut: (...a: unknown[]) => mockLogOut(...a),
  },
}));

let mockUser: { uid: string } | null = { uid: '11111111-1111-4111-8111-111111111111' };
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: mockUser }),
}));

beforeEach(() => {
  mockConfigure.mockClear();
  mockLogOut.mockClear();
});

it('인증 사용자가 있으면 configure(uid) 호출', () => {
  mockUser = { uid: '11111111-1111-4111-8111-111111111111' };
  renderHook(() => useRevenueCatSession());
  expect(mockConfigure).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
});

it('언마운트 시 logOut 호출', () => {
  mockUser = { uid: '11111111-1111-4111-8111-111111111111' };
  const { unmount } = renderHook(() => useRevenueCatSession());
  unmount();
  expect(mockLogOut).toHaveBeenCalledTimes(1);
});
