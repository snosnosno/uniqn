/**
 * uploadProfileImage — 이미지 읽기 실패 처리 검증.
 *
 * 연혁: 과거 `prepareImage` 는 `fetch(file://)`→Blob 경로였고 이 스위트는
 * whatwg-fetch 재시도 계약(Sentry UNIQN-MOBILE-1H/1J)을 고정했다.
 * RN에서 그 경로가 0바이트 파일을 만들어(2026-07-24 실측) base64→ArrayBuffer 로
 * 교체됐다 — fetch 재시도 계약은 소멸, 아래 두 계약은 유지한다:
 *
 *   1) 읽기 실패(base64 누락/빈 바이트)는 재시도 가능(isRetryable) 으로 분류해
 *      상위가 판단할 수 있게 한다 — 업로드는 시작조차 하지 않는다
 *   2) 사용자 메시지는 "업로드 실패" 가 아니라 실제로 일어난 일을 말한다
 */
import { uploadProfileImage } from '../storageService';
import { isAppError } from '@/errors';

const mockUpload = jest.fn();
const mockManipulateAsync = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => mockUpload(...args),
        getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/a.jpg' } }),
      }),
    },
  },
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: (...args: unknown[]) => mockManipulateAsync(...args),
  SaveFormat: { JPEG: 'jpeg' },
}));

jest.mock('@/utils/blurhash', () => ({
  computeBlurhash: jest.fn().mockResolvedValue(undefined),
}));

const VALID_BASE64 = Buffer.alloc(1024, 7).toString('base64');

describe('uploadProfileImage — 이미지 읽기 실패 분류', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpload.mockResolvedValue({ error: null });
  });

  it('base64 누락(읽기 실패)은 재시도 가능한 AppError 로 분류한다', async () => {
    mockManipulateAsync.mockResolvedValue({ uri: 'file:///resized.jpg' });

    const error = await uploadProfileImage('user-1', 'file:///a.jpg').catch((e: unknown) => e);

    expect(isAppError(error)).toBe(true);
    if (!isAppError(error)) return;
    expect(error.isRetryable).toBe(true);
    // 업로드는 시작도 안 했으므로 "업로드 실패" 라고 말하면 안 된다
    expect(error.userMessage).toContain('이미지를 읽지 못했어요');
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('빈 바이트(0바이트)도 동일하게 업로드 전에 차단한다', async () => {
    mockManipulateAsync.mockResolvedValue({ uri: 'file:///resized.jpg', base64: '' });

    const error = await uploadProfileImage('user-1', 'file:///a.jpg').catch((e: unknown) => e);

    expect(isAppError(error)).toBe(true);
    if (!isAppError(error)) return;
    expect(error.isRetryable).toBe(true);
    expect(error.userMessage).toContain('이미지를 읽지 못했어요');
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('업로드 단계 실패는 기존대로 업로드 실패 메시지를 유지한다', async () => {
    mockManipulateAsync.mockResolvedValue({ uri: 'file:///resized.jpg', base64: VALID_BASE64 });
    mockUpload.mockResolvedValue({ error: { message: 'bucket policy violation' } });

    const error = await uploadProfileImage('user-1', 'file:///a.jpg').catch((e: unknown) => e);

    expect(isAppError(error)).toBe(true);
    if (!isAppError(error)) return;
    expect(error.userMessage).toBe('이미지 업로드에 실패했습니다');
  });
});
