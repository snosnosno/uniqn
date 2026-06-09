import { purchasesService } from '../purchasesService';

const mockConfigure = jest.fn();
const mockLogIn = jest.fn((..._a: unknown[]) => Promise.resolve({ customerInfo: {} }));
const mockLogOut = jest.fn((..._a: unknown[]) => Promise.resolve({}));
const mockGetOfferings = jest.fn();
const mockPurchasePackage = jest.fn();
const mockRestorePurchases = jest.fn();

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: (...a: unknown[]) => mockConfigure(...a),
    logIn: (...a: unknown[]) => mockLogIn(...a),
    logOut: (...a: unknown[]) => mockLogOut(...a),
    getOfferings: (...a: unknown[]) => mockGetOfferings(...a),
    purchasePackage: (...a: unknown[]) => mockPurchasePackage(...a),
    restorePurchases: (...a: unknown[]) => mockRestorePurchases(...a),
  },
  PURCHASES_ERROR_CODE: { PURCHASE_CANCELLED_ERROR: 'PURCHASE_CANCELLED' },
}));
jest.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios },
}));
jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// 키가 있어야 isAvailable=true
process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'appl_testkey';

const UID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  mockConfigure.mockClear();
  mockLogIn.mockClear();
  mockLogOut.mockClear();
  mockRestorePurchases.mockClear();
  purchasesService.__resetForTest?.();
});

describe('purchasesService (native)', () => {
  it('키가 있으면 isAvailable=true', () => {
    expect(purchasesService.isAvailable()).toBe(true);
  });

  it('env 키 부재 시 publishable fallback 키로 isAvailable=true (OTA 빈값 방어)', () => {
    const saved = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
    try {
      expect(purchasesService.isAvailable()).toBe(true);
    } finally {
      process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = saved;
    }
  });

  it('최초 configure는 Purchases.configure(appUserID) 호출', async () => {
    await purchasesService.configure(UID);
    expect(mockConfigure).toHaveBeenCalledWith(expect.objectContaining({ appUserID: UID }));
  });

  it('이미 configure된 상태에서 다른 uid면 logIn 호출(중복 configure 금지)', async () => {
    await purchasesService.configure(UID);
    mockConfigure.mockClear();
    await purchasesService.configure('22222222-2222-4222-8222-222222222222');
    expect(mockConfigure).not.toHaveBeenCalled();
    expect(mockLogIn).toHaveBeenCalledWith('22222222-2222-4222-8222-222222222222');
  });

  it('logOut은 configure된 경우에만 Purchases.logOut 호출', async () => {
    await purchasesService.logOut();
    expect(mockLogOut).not.toHaveBeenCalled();
    await purchasesService.configure(UID);
    await purchasesService.logOut();
    expect(mockLogOut).toHaveBeenCalledTimes(1);
  });

  it('purchase 사용자 취소는 { cancelled:true } 반환(throw 아님)', async () => {
    await purchasesService.configure(UID);
    mockPurchasePackage.mockRejectedValue({ code: 'PURCHASE_CANCELLED' });
    const result = await purchasesService.purchasePackage({ identifier: 'p1' } as never);
    expect(result).toEqual({ cancelled: true });
  });

  it('purchase 성공은 { cancelled:false, productId } 반환', async () => {
    await purchasesService.configure(UID);
    mockPurchasePackage.mockResolvedValue({
      productIdentifier: 'uniqn_diamonds_3000',
      customerInfo: {},
    });
    const result = await purchasesService.purchasePackage({ identifier: 'p1' } as never);
    expect(result).toEqual({ cancelled: false, productId: 'uniqn_diamonds_3000' });
  });

  it('restorePurchases는 Purchases.restorePurchases 호출', async () => {
    mockRestorePurchases.mockResolvedValue({});
    await purchasesService.restorePurchases();
    expect(mockRestorePurchases).toHaveBeenCalledTimes(1);
  });

  it('restorePurchases 실패는 그대로 throw(호출부가 토스트 처리)', async () => {
    mockRestorePurchases.mockRejectedValue(new Error('network'));
    await expect(purchasesService.restorePurchases()).rejects.toThrow('network');
  });

  it('미configure 상태에서 restorePurchases(uid)는 configure 후 restore', async () => {
    mockRestorePurchases.mockResolvedValue({});
    await purchasesService.restorePurchases(UID);
    expect(mockConfigure).toHaveBeenCalledWith(expect.objectContaining({ appUserID: UID }));
    expect(mockRestorePurchases).toHaveBeenCalledTimes(1);
  });

  it('다른 uid로 configure된 상태에서 restorePurchases(uid)는 logIn으로 정합 후 restore', async () => {
    await purchasesService.configure('22222222-2222-4222-8222-222222222222');
    mockRestorePurchases.mockResolvedValue({});
    await purchasesService.restorePurchases(UID);
    expect(mockLogIn).toHaveBeenCalledWith(UID);
    expect(mockRestorePurchases).toHaveBeenCalledTimes(1);
  });

  it('configure 실패로 uid 정합 미충족이면 restore 호출 없이 PURCHASES_UNAVAILABLE throw', async () => {
    mockConfigure.mockImplementationOnce(() => {
      throw new Error('rc down');
    });
    await expect(purchasesService.restorePurchases(UID)).rejects.toThrow('PURCHASES_UNAVAILABLE');
    expect(mockRestorePurchases).not.toHaveBeenCalled();
  });
});
