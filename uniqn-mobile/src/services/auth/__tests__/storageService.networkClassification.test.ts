/**
 * uploadProfileImage — 로컬 이미지 읽기 실패 처리 검증.
 *
 * Sentry UNIQN-MOBILE-1H/1J (동일 trace, 이슈 2개로 이중 리포팅):
 * 실패 지점은 Supabase 업로드가 아니라 `prepareImage` 의
 * `fetch(manipulatedImage.uri)` — ImagePicker 가 만든 로컬 파일 읽기다.
 * (whatwg-fetch 가 `TypeError: Network request failed` 로 reject)
 *
 * 고정하는 계약:
 *   1) 일시적 읽기 실패는 1회 재시도로 흡수한다
 *   2) 최종 실패는 재시도 가능(isRetryable) 으로 분류해 상위가 판단할 수 있게 한다
 *   3) 사용자 메시지는 "업로드 실패" 가 아니라 실제로 일어난 일을 말한다
 *      (업로드는 시작조차 안 됐다)
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

function okBlobResponse(size = 1024) {
  return { blob: () => Promise.resolve({ size, type: 'image/jpeg' }) };
}

describe('uploadProfileImage — 로컬 파일 읽기 실패', () => {
  beforeEach(() => {
    mockManipulateAsync.mockResolvedValue({ uri: 'file:///resized.jpg' });
    mockUpload.mockResolvedValue({ error: null });
  });

  it('일시적 읽기 실패는 재시도로 흡수해 업로드까지 성공시킨다', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce(okBlobResponse());
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await uploadProfileImage('user-1', 'file:///a.jpg');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.downloadURL).toBe('https://example.com/a.jpg');
    expect(mockUpload).toHaveBeenCalledTimes(1);
  });

  it('재시도 후에도 실패하면 재시도 가능한 AppError 로 분류한다', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch;

    const error = await uploadProfileImage('user-1', 'file:///a.jpg').catch((e: unknown) => e);

    expect(isAppError(error)).toBe(true);
    if (!isAppError(error)) return;
    expect(error.isRetryable).toBe(true);
    // 업로드는 시작도 안 했으므로 "업로드 실패" 라고 말하면 안 된다
    expect(error.userMessage).toContain('이미지를 읽지 못했어요');
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('업로드 단계 실패는 기존대로 업로드 실패 메시지를 유지한다', async () => {
    global.fetch = jest.fn().mockResolvedValue(okBlobResponse()) as unknown as typeof fetch;
    mockUpload.mockResolvedValue({ error: { message: 'bucket policy violation' } });

    const error = await uploadProfileImage('user-1', 'file:///a.jpg').catch((e: unknown) => e);

    expect(isAppError(error)).toBe(true);
    if (!isAppError(error)) return;
    expect(error.userMessage).toBe('이미지 업로드에 실패했습니다');
  });
});
