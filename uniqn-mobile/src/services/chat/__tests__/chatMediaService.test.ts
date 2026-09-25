/**
 * chatMediaService — 사진 재인코딩·경로·업로드 (S2b C8)
 *
 * RG3: 업로드되는 바이트는 **재인코딩 결과**여야 한다. 원본을 그대로 올리면 EXIF(GPS 등)가 남는다.
 *      manipulate 는 upload 보다 먼저 불려야 하고, 작은 사진도 재인코딩은 항상 거친다.
 */
import { fromByteArray } from 'base64-js';
import { BusinessError } from '@/errors/AppError';
import { CHAT_ERROR_CODES } from '@/errors/chat';
import { CHAT_MAX_UPLOAD_BYTES } from '@/constants/chat';
import {
  buildChatImagePath,
  chatImageResizeTarget,
  prepareChatImage,
  uploadChatImage,
} from '../chatMediaService';

const mockManipulate = jest.fn();
const mockResize = jest.fn();
const mockRender = jest.fn();
const mockSave = jest.fn();

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: (...a: unknown[]) => mockManipulate(...a) },
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
}));

const mockUpload = jest.fn();
jest.mock('@/repositories/chat', () => ({
  chatRepository: { uploadImage: (...a: unknown[]) => mockUpload(...a) },
}));

jest.mock('expo-image-picker', () => ({}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const CONV = '0F8FAD5B-D9CB-469F-A165-70867728950E';
const UID = 'A3BB189E-8BF9-3888-9912-ACE4E6543002';
const CLIENT = '16FD2706-8BAF-433B-82EB-8C7FADA847DA';

/** 재인코딩 결과로 돌려줄 바이트 — 원본(uri)과 구별되는 표식 */
const REENCODED = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 1, 2, 3, 0xff, 0xd9]);

function setupManipulator(saveResults: { base64: string; width: number; height: number }[]) {
  const context = {
    resize: (...a: unknown[]) => {
      mockResize(...a);
      return context;
    },
    renderAsync: (...a: unknown[]) => {
      mockRender(...a);
      return Promise.resolve({ saveAsync: mockSave, width: 0, height: 0 });
    },
  };
  mockManipulate.mockReturnValue(context);
  for (const result of saveResults) {
    mockSave.mockResolvedValueOnce({ uri: 'file:///out.jpg', ...result });
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSave.mockReset();
  mockUpload.mockResolvedValue(undefined);
});

describe('chatImageResizeTarget', () => {
  it('가로가 길면 width 를, 세로가 길면 height 를 1600 으로 맞춘다', () => {
    expect(chatImageResizeTarget(4000, 3000)).toEqual({ width: 1600 });
    expect(chatImageResizeTarget(3000, 4000)).toEqual({ height: 1600 });
  });

  it('긴 변이 1600 이하면 리사이즈하지 않는다', () => {
    expect(chatImageResizeTarget(1600, 900)).toBeNull();
    expect(chatImageResizeTarget(800, 600)).toBeNull();
  });
});

describe('prepareChatImage', () => {
  it('큰 사진은 긴 변 1600 으로 줄이고 JPEG 0.8 로 재인코딩한다', async () => {
    setupManipulator([{ base64: fromByteArray(REENCODED), width: 1600, height: 1200 }]);

    const prepared = await prepareChatImage({
      uri: 'file:///orig.heic',
      width: 4000,
      height: 3000,
    });

    expect(mockManipulate).toHaveBeenCalledWith('file:///orig.heic');
    expect(mockResize).toHaveBeenCalledWith({ width: 1600 });
    expect(mockSave).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.8, base64: true });
    expect(prepared.width).toBe(1600);
    expect(prepared.height).toBe(1200);
  });

  it('세로 사진은 height 기준으로 줄인다', async () => {
    setupManipulator([{ base64: fromByteArray(REENCODED), width: 1200, height: 1600 }]);
    await prepareChatImage({ uri: 'file:///p.jpg', width: 3000, height: 4000 });
    expect(mockResize).toHaveBeenCalledWith({ height: 1600 });
  });

  it('작은 사진도 재인코딩은 항상 거친다 (EXIF 제거) — 리사이즈만 생략', async () => {
    setupManipulator([{ base64: fromByteArray(REENCODED), width: 800, height: 600 }]);
    await prepareChatImage({ uri: 'file:///small.jpg', width: 800, height: 600 });
    expect(mockResize).not.toHaveBeenCalled();
    expect(mockRender).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it('결과 바이트는 재인코딩 결과(base64 디코드)다 (RG3)', async () => {
    setupManipulator([{ base64: fromByteArray(REENCODED), width: 800, height: 600 }]);
    const prepared = await prepareChatImage({ uri: 'file:///small.jpg', width: 800, height: 600 });
    expect(Array.from(new Uint8Array(prepared.bytes))).toEqual(Array.from(REENCODED));
  });

  it('1.5MB 를 넘으면 품질 0.6 으로 한 번 더 인코딩한다', async () => {
    const big = new Uint8Array(CHAT_MAX_UPLOAD_BYTES + 1);
    setupManipulator([
      { base64: fromByteArray(big), width: 1600, height: 1200 },
      { base64: fromByteArray(REENCODED), width: 1600, height: 1200 },
    ]);

    const prepared = await prepareChatImage({ uri: 'file:///b.jpg', width: 4000, height: 3000 });

    expect(mockSave).toHaveBeenNthCalledWith(2, { format: 'jpeg', compress: 0.6, base64: true });
    expect(prepared.bytes.byteLength).toBe(REENCODED.byteLength);
  });

  it('두 번째도 1.5MB 를 넘으면 사진 거부(E6153)로 던진다', async () => {
    const big = fromByteArray(new Uint8Array(CHAT_MAX_UPLOAD_BYTES + 1));
    setupManipulator([
      { base64: big, width: 1600, height: 1200 },
      { base64: big, width: 1600, height: 1200 },
    ]);

    const error = await prepareChatImage({ uri: 'file:///b.jpg', width: 4000, height: 3000 }).catch(
      (e: unknown) => e
    );
    expect(error).toBeInstanceOf(BusinessError);
    expect((error as BusinessError).code).toBe(CHAT_ERROR_CODES.CHAT_IMAGE_INVALID);
    expect(mockSave).toHaveBeenCalledTimes(2);
  });

  it('base64 가 비면 사진 거부로 던진다', async () => {
    setupManipulator([{ base64: '', width: 800, height: 600 }]);
    await expect(
      prepareChatImage({ uri: 'file:///x.jpg', width: 800, height: 600 })
    ).rejects.toBeInstanceOf(BusinessError);
  });
});

describe('buildChatImagePath', () => {
  it('<방>/<내 uid>/<clientMessageId>.jpg 를 전부 소문자로 만든다 (서버 완전 일치 대조)', () => {
    expect(buildChatImagePath(CONV, UID, CLIENT)).toBe(
      `${CONV.toLowerCase()}/${UID.toLowerCase()}/${CLIENT.toLowerCase()}.jpg`
    );
  });
});

describe('uploadChatImage', () => {
  it('재인코딩 결과 바이트를 소문자 경로로 올리고 경로를 돌려준다 (RG3 순서)', async () => {
    setupManipulator([{ base64: fromByteArray(REENCODED), width: 800, height: 600 }]);
    const prepared = await prepareChatImage({ uri: 'file:///s.jpg', width: 800, height: 600 });

    const path = await uploadChatImage({
      conversationId: CONV,
      uid: UID,
      clientMessageId: CLIENT,
      image: prepared,
    });

    expect(path).toBe(buildChatImagePath(CONV, UID, CLIENT));
    expect(mockUpload).toHaveBeenCalledTimes(1);
    const [uploadedPath, bytes] = mockUpload.mock.calls[0] as [string, ArrayBuffer];
    expect(uploadedPath).toBe(path);
    expect(Array.from(new Uint8Array(bytes))).toEqual(Array.from(REENCODED));
    expect(mockManipulate.mock.invocationCallOrder[0]).toBeLessThan(
      mockUpload.mock.invocationCallOrder[0] ?? 0
    );
  });
});

describe('encode 자원 해제 (리뷰 MEDIUM-2)', () => {
  it('성공·실패 모두 ImageRef 와 context 를 release 한다', async () => {
    const releaseRef = jest.fn();
    const releaseContext = jest.fn();
    const context = {
      resize: jest.fn(),
      release: releaseContext,
      renderAsync: () =>
        Promise.resolve({
          release: releaseRef,
          saveAsync: jest
            .fn()
            .mockResolvedValue({ uri: 'file:///o.jpg', base64: '', width: 1, height: 1 }),
        }),
    };
    mockManipulate.mockReturnValue(context);

    await expect(
      prepareChatImage({ uri: 'file:///x.jpg', width: 10, height: 10 })
    ).rejects.toBeDefined();
    expect(releaseRef).toHaveBeenCalledTimes(1);
    expect(releaseContext).toHaveBeenCalledTimes(1);
  });
});
