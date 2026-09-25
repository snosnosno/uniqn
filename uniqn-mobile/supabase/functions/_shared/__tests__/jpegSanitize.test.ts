/**
 * jpegSanitize — 채팅 사진 서버 정화(보안 M1) 단위 테스트
 *
 * 정화기는 디코딩하지 않고 JPEG 마커만 읽는다. 그래서 "메타데이터가 사라졌는가"와 함께
 * "결과가 여전히 올바른 JPEG 로 디코딩되는가"를 실제 디코더(jpeg-js)로 확인한다 — 마커를 잘못
 * 자르면 메타데이터 단언은 통과해도 사진이 깨진다(공허한 검증 방지).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { decode } from 'jpeg-js';
import { JPEG_MAX_DIMENSION, sanitizeJpeg } from '../jpegSanitize.ts';

const FIXTURE_DIR = join(__dirname, 'fixtures');
/** S2b E2E 픽스처(2400x1800, 카메라식 EXIF + GPS) — 앱 재인코딩을 건너뛴 원본 업로드 재현 */
const CAMERA_ORIGINAL = new Uint8Array(
  readFileSync(join(__dirname, '../../../../e2e/fixtures/chat-exif-sample.jpg'))
);
/** 같은 사진을 400x300 베이스라인으로 줄이되 EXIF·GPS 를 그대로 둔 것 */
const REAL_EXIF = new Uint8Array(readFileSync(join(FIXTURE_DIR, 'baseline-exif-gps.jpg')));
/** PIL 로 만든 프로그레시브 JPEG — EXIF(카메라 제조사·GPS) + COM(주석) */
const PROGRESSIVE = new Uint8Array(readFileSync(join(FIXTURE_DIR, 'progressive-exif.jpg')));

function contains(bytes: Uint8Array, needle: string): boolean {
  return Buffer.from(bytes).includes(Buffer.from(needle, 'latin1'));
}

/** SOF0/1/2 의 가로·세로를 덮어쓴 사본 */
function withDimensions(bytes: Uint8Array, width: number, height: number): Uint8Array {
  const copy = new Uint8Array(bytes);
  for (let i = 2; i < copy.length - 9; i++) {
    if (
      copy[i] === 0xff &&
      (copy[i + 1] === 0xc0 || copy[i + 1] === 0xc1 || copy[i + 1] === 0xc2)
    ) {
      copy[i + 5] = height >> 8;
      copy[i + 6] = height & 0xff;
      copy[i + 7] = width >> 8;
      copy[i + 8] = width & 0xff;
      return copy;
    }
  }
  throw new Error('SOF 없음');
}

describe('sanitizeJpeg — 메타데이터 제거', () => {
  it('실사진의 EXIF·GPS 를 지우고 여전히 같은 크기로 디코딩된다', () => {
    expect(contains(REAL_EXIF, 'Exif')).toBe(true); // 대조군: 원본엔 있다

    const result = sanitizeJpeg(REAL_EXIF);
    if (!result.ok) throw new Error(result.code);

    expect(contains(result.bytes, 'Exif')).toBe(false);
    expect(contains(result.bytes, 'GPS')).toBe(false);
    const original = decode(REAL_EXIF, { useTArray: true });
    const cleaned = decode(result.bytes, { useTArray: true });
    expect([cleaned.width, cleaned.height]).toEqual([original.width, original.height]);
    expect([result.width, result.height]).toEqual([original.width, original.height]);
  });

  it('프로그레시브 JPEG 의 EXIF·주석(COM)을 지우고 픽셀은 그대로 디코딩된다', () => {
    const result = sanitizeJpeg(PROGRESSIVE);
    if (!result.ok) throw new Error(result.code);

    expect(contains(PROGRESSIVE, 'SpyCam')).toBe(true);
    expect(contains(result.bytes, 'SpyCam')).toBe(false);
    expect(contains(result.bytes, 'secret-comment')).toBe(false);
    const before = decode(PROGRESSIVE, { useTArray: true });
    const after = decode(result.bytes, { useTArray: true });
    expect([after.width, after.height]).toEqual([64, 48]);
    expect(Buffer.from(after.data).equals(Buffer.from(before.data))).toBe(true);
  });

  it('EOI 뒤에 붙은 꼬리(폴리글랏 페이로드)를 버린다', () => {
    const tail = Buffer.from('<script>alert(1)</script>', 'latin1');
    const withTail = new Uint8Array(Buffer.concat([Buffer.from(PROGRESSIVE), tail]));
    const result = sanitizeJpeg(withTail);
    if (!result.ok) throw new Error(result.code);
    expect(contains(result.bytes, '<script>')).toBe(false);
    expect(result.bytes[result.bytes.length - 2]).toBe(0xff);
    expect(result.bytes[result.bytes.length - 1]).toBe(0xd9);
  });
});

describe('sanitizeJpeg — 거부', () => {
  it('JPEG 가 아니면(PNG 서명) NOT_JPEG', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(sanitizeJpeg(png)).toEqual({ ok: false, code: 'NOT_JPEG' });
  });

  it(`가로·세로가 ${JPEG_MAX_DIMENSION} 를 넘으면 BAD_DIMENSIONS(디코딩 폭탄)`, () => {
    expect(sanitizeJpeg(withDimensions(PROGRESSIVE, 60000, 60000))).toEqual({
      ok: false,
      code: 'BAD_DIMENSIONS',
    });
    expect(sanitizeJpeg(withDimensions(PROGRESSIVE, 0, 48))).toEqual({
      ok: false,
      code: 'BAD_DIMENSIONS',
    });
  });

  it('앱 재인코딩을 건너뛴 카메라 원본(2400x1800)은 BAD_DIMENSIONS — 앱은 긴 변 1600 으로 보낸다', () => {
    expect(sanitizeJpeg(CAMERA_ORIGINAL)).toEqual({ ok: false, code: 'BAD_DIMENSIONS' });
  });

  it('경계: 정확히 상한이면 통과', () => {
    const result = sanitizeJpeg(
      withDimensions(PROGRESSIVE, JPEG_MAX_DIMENSION, JPEG_MAX_DIMENSION)
    );
    expect(result.ok).toBe(true);
  });

  it('중간에 잘린 파일은 TRUNCATED', () => {
    expect(sanitizeJpeg(PROGRESSIVE.slice(0, 200))).toEqual({ ok: false, code: 'TRUNCATED' });
  });

  it('세그먼트 길이가 파일 끝을 넘으면 TRUNCATED', () => {
    const bad = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 0x00]);
    expect(sanitizeJpeg(bad)).toEqual({ ok: false, code: 'TRUNCATED' });
  });

  it('산술 부호화·무손실 프레임(SOF3 등)은 UNSUPPORTED_MARKER', () => {
    const copy = new Uint8Array(PROGRESSIVE);
    const at = Buffer.from(copy).indexOf(Buffer.from([0xff, 0xc2]));
    copy[at + 1] = 0xc3;
    expect(sanitizeJpeg(copy)).toEqual({ ok: false, code: 'UNSUPPORTED_MARKER' });
  });

  it('프레임(SOF) 없이 스캔이 오면 NO_FRAME', () => {
    const bad = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02, 0x00, 0xff, 0xd9]);
    expect(sanitizeJpeg(bad)).toEqual({ ok: false, code: 'NO_FRAME' });
  });
});

/** 마커(0xFF xx) 첫 위치 */
function markerAt(bytes: Uint8Array, marker: number): number {
  for (let i = 2; i < bytes.length - 1; i++) {
    if (bytes[i] === 0xff && bytes[i + 1] === marker) return i;
  }
  throw new Error(`마커 ${marker.toString(16)} 없음`);
}

function patched(bytes: Uint8Array, patch: (copy: Uint8Array) => void): Uint8Array {
  const copy = new Uint8Array(bytes);
  patch(copy);
  return copy;
}

describe('sanitizeJpeg — 구조 필드 검증(보안 리뷰 M2: 디코더 불일치 입력 차단)', () => {
  // SOF2 세그먼트: FF C2 | 길이(2) | P(1) | Y(2) | X(2) | Nf(1) | [Ci Hi/Vi Tqi]×Nf
  const sof = () => markerAt(PROGRESSIVE, 0xc2);

  it('정밀도 8 이 아니면(12비트) 거부', () => {
    const bad = patched(PROGRESSIVE, (c) => (c[sof() + 4] = 12));
    expect(sanitizeJpeg(bad)).toEqual({ ok: false, code: 'BAD_STRUCTURE' });
  });

  it('샘플링 계수 0 이면 거부', () => {
    const bad = patched(PROGRESSIVE, (c) => (c[sof() + 11] = 0x00));
    expect(sanitizeJpeg(bad)).toEqual({ ok: false, code: 'BAD_STRUCTURE' });
  });

  it('성분의 양자화표 번호가 3 을 넘으면 거부', () => {
    const bad = patched(PROGRESSIVE, (c) => (c[sof() + 12] = 200));
    expect(sanitizeJpeg(bad)).toEqual({ ok: false, code: 'BAD_STRUCTURE' });
  });

  it('SOF 길이가 성분 수와 맞지 않으면 거부(성분 명세 누락)', () => {
    const bad = new Uint8Array([
      0xff, 0xd8, 0xff, 0xc0, 0x00, 0x08, 0x08, 0x00, 0x10, 0x00, 0x10, 0x03, 0xff, 0xd9,
    ]);
    expect(sanitizeJpeg(bad)).toEqual({ ok: false, code: 'BAD_STRUCTURE' });
  });

  it('DQT 표 번호(Tq)가 3 을 넘으면 거부', () => {
    const at = markerAt(PROGRESSIVE, 0xdb);
    const bad = patched(PROGRESSIVE, (c) => (c[at + 4] = (c[at + 4] & 0xf0) | 0x07));
    expect(sanitizeJpeg(bad)).toEqual({ ok: false, code: 'BAD_STRUCTURE' });
  });

  it('DHT 클래스·번호가 범위를 벗어나면 거부', () => {
    const at = markerAt(PROGRESSIVE, 0xc4);
    const bad = patched(PROGRESSIVE, (c) => (c[at + 4] = 0x27));
    expect(sanitizeJpeg(bad)).toEqual({ ok: false, code: 'BAD_STRUCTURE' });
  });

  it('SOS 의 성분 선택자가 프레임에 없으면 거부', () => {
    const at = markerAt(PROGRESSIVE, 0xda);
    const bad = patched(PROGRESSIVE, (c) => (c[at + 5] = 0x63));
    expect(sanitizeJpeg(bad)).toEqual({ ok: false, code: 'BAD_STRUCTURE' });
  });

  it('대조군: 실제 인코더 출력(베이스라인·프로그레시브)은 모두 통과', () => {
    expect(sanitizeJpeg(REAL_EXIF).ok).toBe(true);
    expect(sanitizeJpeg(PROGRESSIVE).ok).toBe(true);
  });
});
