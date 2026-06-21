/**
 * WalletRepository.getMonetizationConfig — 충전 UI 원격 킬스위치 reader (iap-2)
 * app_config key='monetization' 의 show_purchase_ui 를 읽어 노출 여부를 반환.
 */
import { WalletRepository } from '../WalletRepository';

const mockMaybeSingle = jest.fn();
const mockEq = jest.fn((..._a: unknown[]) => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = jest.fn((..._a: unknown[]) => ({ eq: mockEq }));
const mockFrom = jest.fn((..._a: unknown[]) => ({ select: mockSelect }));
jest.mock('@/lib/supabase', () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));

describe('WalletRepository.getMonetizationConfig', () => {
  beforeEach(() => jest.clearAllMocks());

  it('show_purchase_ui=false 면 showPurchaseUi=false (킬스위치 ON)', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { value: { show_purchase_ui: false } },
      error: null,
    });
    const r = await WalletRepository.getMonetizationConfig();
    expect(mockFrom).toHaveBeenCalledWith('app_config');
    expect(mockEq).toHaveBeenCalledWith('key', 'monetization');
    expect(r.showPurchaseUi).toBe(false);
  });

  it('show_purchase_ui=true 면 showPurchaseUi=true', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { value: { show_purchase_ui: true } }, error: null });
    expect((await WalletRepository.getMonetizationConfig()).showPurchaseUi).toBe(true);
  });

  it('설정 미존재(행 없음) 시 fail-open(true)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await WalletRepository.getMonetizationConfig()).showPurchaseUi).toBe(true);
  });

  it('show_purchase_ui 키 누락 시 fail-open(true)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { value: {} }, error: null });
    expect((await WalletRepository.getMonetizationConfig()).showPurchaseUi).toBe(true);
  });

  it('읽기 에러 시 fail-open(true)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect((await WalletRepository.getMonetizationConfig()).showPurchaseUi).toBe(true);
  });
});
