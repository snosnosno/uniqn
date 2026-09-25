/**
 * JPEG 정화기 — 채팅 사진 서버 측 메타데이터 제거·크기 상한 (보안 M1)
 *
 * 비유: 편지 봉투(마커 구조)만 열어 뒷면 메모(EXIF·주석)를 떼고, 봉투에 적힌 크기가 너무 크면
 *       배달하지 않는다. 편지 내용(압축된 픽셀)은 펼쳐 보지 않는다.
 *
 * 왜 디코딩하지 않는가
 *   가로·세로가 거대한 JPEG("디코딩 폭탄")는 디코딩하는 쪽의 메모리를 터뜨린다. 정화기가 디코딩하면
 *   EF 가 먼저 터진다. 마커만 읽으면 입력 크기(≤1.5MB)에 비례하는 일만 하고, SOF 의 가로·세로를
 *   상한으로 묶어 **받는 쪽 앱이 디코딩할 크기**도 제한된다.
 *
 * 하는 일
 *   - SOI 로 시작해야 한다. EOI 에서 끝내고 그 뒤 꼬리는 버린다(폴리글랏 방지).
 *   - APP1~APP15(EXIF·GPS·XMP·ICC·Adobe 등)·COM(주석) 세그먼트를 버린다.
 *     APP0 은 썸네일 없는 JFIF(길이 16)만 남긴다 — 그 외 APP0 은 버린다.
 *   - 프레임은 SOF0/1/2(베이스라인·확장·프로그레시브, 허프만)만, 1개만, 성분 1 또는 3.
 *     가로·세로 1~JPEG_MAX_DIMENSION. 산술·무손실·계층 프레임과 DNL 등은 거부.
 *   - 스캔(SOS) 수 ≤ JPEG_MAX_SCANS — 스캔을 수천 개 쌓아 디코더를 오래 붙잡는 입력 방어.
 *   - 구조 필드 정합(보안 리뷰 M2): 정밀도 8 · 샘플링 1~4 · 표 번호 0~3 · 세그먼트 길이 = 필드 합 ·
 *     SOS 성분이 프레임에 있을 것 · 스펙트럼/근사 범위. 정화기와 받는 쪽 디코더가 같은 바이트를
 *     다르게 해석하는 입력(파서 취약점 표적)을 거른다. 엔트로피 데이터 자체는 해석하지 않는다 —
 *     그 안의 디코더 0-day 는 재인코딩 없이는 막을 수 없는 **수용한 잔여 위험**이다.
 *
 * ⚠️ Deno 전용 API·jsr import 를 쓰지 않는다 — jest(프로젝트 하네스)로 검증한다
 *    (선례 `idp-binding.ts`). EF 는 이 모듈을 그대로 import 한다.
 */

/** 앱은 긴 변 1600 으로 재인코딩한다. 여유를 두되 디코딩 크기를 묶는 상한 */
export const JPEG_MAX_DIMENSION = 2048;
/** 프로그레시브 JPEG 는 보통 10개 안팎의 스캔을 쓴다 */
export const JPEG_MAX_SCANS = 16;

export type JpegSanitizeError =
  | 'NOT_JPEG'
  | 'TRUNCATED'
  | 'UNSUPPORTED_MARKER'
  | 'BAD_DIMENSIONS'
  | 'NO_FRAME'
  | 'MULTIPLE_FRAMES'
  | 'TOO_MANY_SCANS'
  | 'BAD_STRUCTURE';

export type JpegSanitizeResult =
  | { ok: true; bytes: Uint8Array; width: number; height: number }
  | { ok: false; code: JpegSanitizeError };

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const COM = 0xfe;
/** 허프만 부호화 프레임만 — 베이스라인·확장 순차·프로그레시브 */
const ALLOWED_SOF = new Set([0xc0, 0xc1, 0xc2]);
/** 그대로 복사하는 표 세그먼트 — 양자화표·허프만표·재시작 간격 */
const KEPT_TABLES = new Set([0xdb, 0xc4, 0xdd]);

class SanitizeFailure extends Error {
  constructor(readonly code: JpegSanitizeError) {
    super(code);
  }
}

function fail(code: JpegSanitizeError): never {
  throw new SanitizeFailure(code);
}

function readLength(input: Uint8Array, at: number): number {
  if (at + 2 > input.length) fail('TRUNCATED');
  const length = (input[at] << 8) | input[at + 1];
  if (length < 2 || at + length > input.length) fail('TRUNCATED');
  return length;
}

/** 썸네일 없는 JFIF APP0 인가 — 'JFIF\0' 식별자 + 길이 16(썸네일 0x0) */
function isPlainJfif(input: Uint8Array, segmentStart: number, length: number): boolean {
  const id = [0x4a, 0x46, 0x49, 0x46, 0x00];
  return length === 16 && id.every((byte, i) => input[segmentStart + 2 + i] === byte);
}

/** 엔트로피 부호화 데이터의 끝(다음 마커의 0xFF 위치). 0xFF00(바이트 채움)·RSTn 은 데이터다 */
function findScanEnd(input: Uint8Array, from: number): number {
  for (let i = from; i < input.length - 1; i++) {
    if (input[i] !== 0xff) continue;
    const next = input[i + 1];
    if (next === 0x00 || (next >= 0xd0 && next <= 0xd7) || next === 0xff) continue;
    return i;
  }
  return fail('TRUNCATED');
}

interface Frame {
  width: number;
  height: number;
  progressive: boolean;
  componentIds: Set<number>;
}

/** segmentStart = 길이 필드 위치. 필드는 segmentStart + 2 부터 */
function readFrame(input: Uint8Array, segmentStart: number, length: number, marker: number): Frame {
  if (length < 8) fail('TRUNCATED');
  if (input[segmentStart + 2] !== 8) fail('BAD_STRUCTURE'); // 정밀도 8비트만
  const height = (input[segmentStart + 3] << 8) | input[segmentStart + 4];
  const width = (input[segmentStart + 5] << 8) | input[segmentStart + 6];
  const components = input[segmentStart + 7];
  if (components !== 1 && components !== 3) fail('UNSUPPORTED_MARKER');
  if (length !== 8 + 3 * components) fail('BAD_STRUCTURE');
  const componentIds = new Set<number>();
  for (let c = 0; c < components; c++) {
    const at = segmentStart + 8 + c * 3;
    const h = input[at + 1] >> 4;
    const v = input[at + 1] & 0x0f;
    if (componentIds.has(input[at]) || h < 1 || h > 4 || v < 1 || v > 4 || input[at + 2] > 3) {
      fail('BAD_STRUCTURE');
    }
    componentIds.add(input[at]);
  }
  const inRange = (value: number) => value >= 1 && value <= JPEG_MAX_DIMENSION;
  if (!inRange(width) || !inRange(height)) fail('BAD_DIMENSIONS');
  return { width, height, progressive: marker === 0xc2, componentIds };
}

/** DQT: 표마다 Pq(0=8비트·1=16비트)·Tq(0~3), 길이 합이 정확해야 한다 */
function checkQuantTables(input: Uint8Array, segmentStart: number, length: number): void {
  let at = segmentStart + 2;
  const end = segmentStart + length;
  while (at < end) {
    const pq = input[at] >> 4;
    const tq = input[at] & 0x0f;
    if (pq > 1 || tq > 3) fail('BAD_STRUCTURE');
    at += 1 + 64 * (pq + 1);
  }
  if (at !== end) fail('BAD_STRUCTURE');
}

/** DHT: 표마다 Tc(0~1)·Th(0~3), 코드 수 합 ≤ 256, 길이 합이 정확해야 한다 */
function checkHuffmanTables(input: Uint8Array, segmentStart: number, length: number): void {
  let at = segmentStart + 2;
  const end = segmentStart + length;
  while (at < end) {
    if (at + 17 > end) fail('BAD_STRUCTURE');
    if (input[at] >> 4 > 1 || (input[at] & 0x0f) > 3) fail('BAD_STRUCTURE');
    let symbols = 0;
    for (let i = 1; i <= 16; i++) symbols += input[at + i];
    if (symbols > 256) fail('BAD_STRUCTURE');
    at += 17 + symbols;
  }
  if (at !== end) fail('BAD_STRUCTURE');
}

/** SOS 헤더: 성분 수 1~4 · 선택자가 프레임에 있음 · 표 번호 · 스펙트럼/근사 범위 */
function checkScanHeader(
  input: Uint8Array,
  segmentStart: number,
  length: number,
  frame: Frame
): void {
  const ns = input[segmentStart + 2];
  if (ns < 1 || ns > 4 || ns > frame.componentIds.size || length !== 6 + 2 * ns)
    fail('BAD_STRUCTURE');
  for (let c = 0; c < ns; c++) {
    const at = segmentStart + 3 + c * 2;
    if (
      !frame.componentIds.has(input[at]) ||
      input[at + 1] >> 4 > 3 ||
      (input[at + 1] & 0x0f) > 3
    ) {
      fail('BAD_STRUCTURE');
    }
  }
  const tail = segmentStart + 3 + ns * 2;
  const ss = input[tail];
  const se = input[tail + 1];
  const ah = input[tail + 2] >> 4;
  const al = input[tail + 2] & 0x0f;
  const ok = frame.progressive
    ? ss <= se && se <= 63 && ah <= 13 && al <= 13
    : ss === 0 && se === 63 && ah === 0 && al === 0;
  if (!ok) fail('BAD_STRUCTURE');
}

function sanitize(input: Uint8Array): JpegSanitizeResult {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== SOI)
    return { ok: false, code: 'NOT_JPEG' };

  const out: Uint8Array[] = [input.subarray(0, 2)];
  let frame: Frame | null = null;
  let scans = 0;
  let pos = 2;

  for (;;) {
    if (pos >= input.length || input[pos] !== 0xff) fail('TRUNCATED');
    while (pos < input.length && input[pos] === 0xff) pos++; // 채움 0xFF
    if (pos >= input.length) fail('TRUNCATED');
    const marker = input[pos++];

    if (marker === EOI) {
      if (!frame || scans === 0) fail('NO_FRAME');
      out.push(new Uint8Array([0xff, EOI]));
      return { ok: true, bytes: concat(out), width: frame.width, height: frame.height };
    }

    const length = readLength(input, pos);
    const segment = input.subarray(pos - 2, pos + length); // 마커 2바이트 포함

    if (marker === SOS) {
      if (!frame) fail('NO_FRAME');
      if (++scans > JPEG_MAX_SCANS) fail('TOO_MANY_SCANS');
      checkScanHeader(input, pos, length, frame);
      const dataEnd = findScanEnd(input, pos + length);
      out.push(input.subarray(pos - 2, dataEnd));
      pos = dataEnd;
      continue;
    }

    if (ALLOWED_SOF.has(marker)) {
      if (frame) fail('MULTIPLE_FRAMES');
      frame = readFrame(input, pos, length, marker);
      out.push(segment);
    } else if (KEPT_TABLES.has(marker)) {
      if (marker === 0xdb) checkQuantTables(input, pos, length);
      if (marker === 0xc4) checkHuffmanTables(input, pos, length);
      if (marker === 0xdd && length !== 4) fail('BAD_STRUCTURE');
      out.push(segment);
    } else if (marker === 0xe0) {
      if (isPlainJfif(input, pos, length)) out.push(segment);
    } else if ((marker >= 0xe1 && marker <= 0xef) || marker === COM) {
      // EXIF·GPS·XMP·ICC·주석 — 버린다
    } else {
      // SOF3·5~7·9~15(산술·무손실·계층) · DNL · DHP · EXP · JPGn · 스캔 밖 RSTn/TEM
      fail('UNSUPPORTED_MARKER');
    }
    pos += length;
  }
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** JPEG 바이트 → 메타데이터를 뗀 사본 + 가로·세로. 실패하면 사유 코드 */
export function sanitizeJpeg(input: Uint8Array): JpegSanitizeResult {
  try {
    return sanitize(input);
  } catch (error) {
    if (error instanceof SanitizeFailure) return { ok: false, code: error.code };
    throw error;
  }
}
