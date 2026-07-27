/**
 * useShareSheet — 웹 공유 경로 회귀 테스트
 *
 * @description 데스크톱 웹에서 공유가 통째로 먹통이던 결함을 고정한다.
 *   기존 구현은 `navigator.share` 가 존재하기만 하면 무조건 OS 공유 시트로 갔는데,
 *   데스크톱 공유 시트에는 카카오톡이 대상으로 없다. 게다가 시트를 닫으면 AbortError 가
 *   '사용자가 닫음'으로 분류돼 클립보드 복사도 건너뛰어, 사용자에겐 아무 반응이 없었다.
 *   (uniqn.app 실계측: 공유 클릭 시 navigator.share 1회 호출 · clipboard.writeText 0회)
 */

import { renderHook } from '@testing-library/react-native';
import { useShareSheet } from '../useShareSheet';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
  Share: { share: jest.fn(), sharedAction: 'sharedAction' },
}));

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
  info: jest.fn(),
};

jest.mock('@/stores/toastStore', () => ({
  useToast: () => mockToast,
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36';

interface NavigatorStubOptions {
  ua: string;
  /** userAgentData.mobile — Chromium 계열만 제공. undefined 면 UA 문자열로 판정해야 한다. */
  uaDataMobile?: boolean;
  share?: jest.Mock;
  writeText?: jest.Mock;
  /** clipboard 자체가 없는 브라우저(구형·비보안 컨텍스트) 재현 */
  withoutClipboard?: boolean;
}

function stubNavigator({
  ua,
  uaDataMobile,
  share,
  writeText,
  withoutClipboard,
}: NavigatorStubOptions) {
  const stub: Record<string, unknown> = { userAgent: ua };
  if (uaDataMobile !== undefined) stub.userAgentData = { mobile: uaDataMobile };
  if (share) stub.share = share;
  if (!withoutClipboard)
    stub.clipboard = { writeText: writeText ?? jest.fn().mockResolvedValue(undefined) };

  Object.defineProperty(globalThis, 'navigator', {
    value: stub,
    configurable: true,
    writable: true,
  });
}

const OPTIONS = {
  title: '공고 3건',
  message: '[UNIQN] 공고 3건 모집\n...본문...\n👉 지원하기 https://uniqn.app/jobs',
  dialogTitle: '공고 묶음 공유하기',
};

describe('useShareSheet — 웹', () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  afterEach(() => {
    jest.clearAllMocks();
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
  });

  describe('데스크톱', () => {
    it('navigator.share 가 있어도 공유 시트를 열지 않고 본문을 클립보드에 복사한다', async () => {
      const share = jest.fn().mockResolvedValue(undefined);
      const writeText = jest.fn().mockResolvedValue(undefined);
      stubNavigator({ ua: DESKTOP_UA, uaDataMobile: false, share, writeText });

      const { result } = renderHook(() => useShareSheet());
      const action = await result.current.openShareSheet(OPTIONS);

      // 데스크톱 공유 시트에는 카카오톡이 없다 — 시트를 열면 사용자가 할 수 있는 게 없다.
      expect(share).not.toHaveBeenCalled();
      expect(writeText).toHaveBeenCalledWith(OPTIONS.message);
      expect(action).toBe('shared');
    });

    it('붙여넣기를 안내하는 토스트를 띄운다', async () => {
      stubNavigator({ ua: DESKTOP_UA, uaDataMobile: false, share: jest.fn() });

      const { result } = renderHook(() => useShareSheet());
      await result.current.openShareSheet(OPTIONS);

      expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('붙여넣'));
    });

    it('userAgentData 가 없는 브라우저는 UA 문자열로 데스크톱을 판정한다', async () => {
      const share = jest.fn();
      stubNavigator({ ua: DESKTOP_UA, share });

      const { result } = renderHook(() => useShareSheet());
      await result.current.openShareSheet(OPTIONS);

      expect(share).not.toHaveBeenCalled();
    });

    it('클립보드 복사가 실패하면 원인을 알려주고 성공으로 위장하지 않는다', async () => {
      const writeText = jest.fn().mockRejectedValue(new Error('denied'));
      stubNavigator({ ua: DESKTOP_UA, uaDataMobile: false, writeText });

      const { result } = renderHook(() => useShareSheet());
      const action = await result.current.openShareSheet(OPTIONS);

      expect(mockToast.success).not.toHaveBeenCalled();
      expect(mockToast.error).toHaveBeenCalled();
      expect(action).toBe('dismissed');
    });

    it('clipboard API 자체가 없어도 예외를 던지지 않고 안내한다', async () => {
      stubNavigator({ ua: DESKTOP_UA, uaDataMobile: false, withoutClipboard: true });

      const { result } = renderHook(() => useShareSheet());
      const action = await result.current.openShareSheet(OPTIONS);

      expect(mockToast.error).toHaveBeenCalled();
      expect(action).toBe('dismissed');
    });

    it('url 을 별도로 넘긴 경우에는 url 만 복사한다', async () => {
      const writeText = jest.fn().mockResolvedValue(undefined);
      stubNavigator({ ua: DESKTOP_UA, uaDataMobile: false, writeText });

      const { result } = renderHook(() => useShareSheet());
      await result.current.openShareSheet({ ...OPTIONS, url: 'https://uniqn.app/jobs' });

      expect(writeText).toHaveBeenCalledWith('https://uniqn.app/jobs');
    });
  });

  describe('모바일 웹', () => {
    it('공유 시트에 카카오톡이 있으므로 navigator.share 를 그대로 쓴다', async () => {
      const share = jest.fn().mockResolvedValue(undefined);
      const writeText = jest.fn().mockResolvedValue(undefined);
      stubNavigator({ ua: ANDROID_UA, uaDataMobile: true, share, writeText });

      const { result } = renderHook(() => useShareSheet());
      const action = await result.current.openShareSheet(OPTIONS);

      expect(share).toHaveBeenCalledWith(
        expect.objectContaining({ title: OPTIONS.title, text: OPTIONS.message })
      );
      expect(writeText).not.toHaveBeenCalled();
      expect(action).toBe('shared');
    });

    it('사용자가 시트를 닫으면(AbortError) dismissed 로 끝낸다', async () => {
      const share = jest
        .fn()
        .mockRejectedValue(Object.assign(new Error('Share canceled'), { name: 'AbortError' }));
      const writeText = jest.fn().mockResolvedValue(undefined);
      stubNavigator({ ua: ANDROID_UA, uaDataMobile: true, share, writeText });

      const { result } = renderHook(() => useShareSheet());
      const action = await result.current.openShareSheet(OPTIONS);

      expect(action).toBe('dismissed');
      expect(writeText).not.toHaveBeenCalled();
    });

    it('AbortError 가 아닌 실패는 클립보드로 폴백한다', async () => {
      const share = jest
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('no share target'), { name: 'NotAllowedError' })
        );
      const writeText = jest.fn().mockResolvedValue(undefined);
      stubNavigator({ ua: ANDROID_UA, uaDataMobile: true, share, writeText });

      const { result } = renderHook(() => useShareSheet());
      const action = await result.current.openShareSheet(OPTIONS);

      expect(writeText).toHaveBeenCalledWith(OPTIONS.message);
      expect(action).toBe('shared');
    });

    it('navigator.share 가 없는 모바일 브라우저는 클립보드로 간다', async () => {
      const writeText = jest.fn().mockResolvedValue(undefined);
      stubNavigator({ ua: ANDROID_UA, uaDataMobile: true, writeText });

      const { result } = renderHook(() => useShareSheet());
      const action = await result.current.openShareSheet(OPTIONS);

      expect(writeText).toHaveBeenCalledWith(OPTIONS.message);
      expect(action).toBe('shared');
    });
  });
});
