/**
 * blurhash.ts — 파이프라인 & 오류 경로 단위 테스트
 *
 * 실제 이미지·jpeg 디코더는 느리고 RN jest 환경에서 설치 상 문제가 있어
 * 모든 외부 의존성을 mock. 호출 시그니처와 예외 경로만 검증.
 */

import * as base64js from 'base64-js';
import { encode } from 'blurhash';
import * as ImageManipulator from 'expo-image-manipulator';
import * as jpegjs from 'jpeg-js';

import { computeBlurhash } from '../blurhash';

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
  manipulateAsync: jest.fn(),
}));

jest.mock('base64-js', () => ({
  toByteArray: jest.fn(),
}));

jest.mock('jpeg-js', () => ({
  decode: jest.fn(),
}));

jest.mock('blurhash', () => ({
  encode: jest.fn(),
}));

describe('computeBlurhash pipeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
      uri: 'file://tmp/out.jpg',
      base64: 'fakebase64',
      width: 32,
      height: 32,
    });
    (base64js.toByteArray as jest.Mock).mockReturnValue(new Uint8Array(16));
    (jpegjs.decode as jest.Mock).mockReturnValue({
      data: new Uint8Array(32 * 32 * 4),
      width: 32,
      height: 32,
    });
    (encode as jest.Mock).mockReturnValue('LjH.XM?bofay~qayayj[IUj[ayj@');
  });

  it('resizes to 32×32 JPEG with base64 output by default', async () => {
    await computeBlurhash('file://tmp/source.jpg');

    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
      'file://tmp/source.jpg',
      [{ resize: { width: 32, height: 32 } }],
      expect.objectContaining({ format: 'jpeg', base64: true })
    );
  });

  it('honours a custom thumbnailSize', async () => {
    await computeBlurhash('file://tmp/source.jpg', { thumbnailSize: 64 });

    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
      'file://tmp/source.jpg',
      [{ resize: { width: 64, height: 64 } }],
      expect.any(Object)
    );
  });

  it('passes default 4×3 components to blurhash.encode', async () => {
    await computeBlurhash('file://tmp/source.jpg');
    expect(encode).toHaveBeenCalledWith(expect.any(Uint8Array), 32, 32, 4, 3);
  });

  it('passes custom components to blurhash.encode', async () => {
    await computeBlurhash('file://tmp/source.jpg', { components: { x: 6, y: 5 } });
    expect(encode).toHaveBeenCalledWith(expect.any(Uint8Array), 32, 32, 6, 5);
  });

  it('returns the hash produced by blurhash.encode', async () => {
    const hash = await computeBlurhash('file://tmp/source.jpg');
    expect(hash).toBe('LjH.XM?bofay~qayayj[IUj[ayj@');
  });
});

describe('computeBlurhash error paths', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws when uri is empty', async () => {
    await expect(computeBlurhash('')).rejects.toThrow(/empty uri/);
  });

  it.each([
    [{ x: 0, y: 3 }],
    [{ x: 10, y: 3 }],
    [{ x: 4, y: 0 }],
    [{ x: 4, y: 10 }],
    [{ x: 1.5, y: 3 }],
  ])('throws for invalid components %p', async (components) => {
    await expect(computeBlurhash('file://tmp/x.jpg', { components })).rejects.toThrow(/components/);
  });

  it('throws when manipulator omits base64 payload', async () => {
    (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
      uri: 'file://tmp/out.jpg',
      base64: undefined,
    });

    await expect(computeBlurhash('file://tmp/x.jpg')).rejects.toThrow(/no base64/);
  });

  it('throws when jpeg decode returns empty image', async () => {
    (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
      uri: 'file://tmp/out.jpg',
      base64: 'fake',
    });
    (base64js.toByteArray as jest.Mock).mockReturnValue(new Uint8Array(4));
    (jpegjs.decode as jest.Mock).mockReturnValue({
      data: null,
      width: 0,
      height: 0,
    });

    await expect(computeBlurhash('file://tmp/x.jpg')).rejects.toThrow(/empty image/);
  });
});
