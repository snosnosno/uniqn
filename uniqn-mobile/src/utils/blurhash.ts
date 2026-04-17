/**
 * blurhash — 클라이언트 선계산 파이프라인 (impeccable v2 §18 / D4)
 *
 * 파이프라인:
 *   1. expo-image-manipulator 로 32×32 JPEG 생성 (+ base64 동봉)
 *   2. base64 → Uint8Array (base64-js)
 *   3. jpeg-js decode → RGBA Uint8Array
 *   4. blurhash encode → "LjH.XM?bofay~qayayj[IUj[ayj@" 류 해시(~30자)
 *
 * 해시 충실도: 4×3 components(가로·세로 저주파 성분 개수) — 평균 ~28자.
 * 더 상세한 placeholder 가 필요하면 `components`에 {x, y} 지정(최대 9×9 = 83자).
 *
 * 비용: 32×32 JPEG 디코드 + 해시 인코드 = 100~300ms(디바이스·이미지 따라 다름).
 * UI 차단 방지를 위해 업로드 진행 중 async 로 호출 → 결과가 확정되기 전에도
 * 이미지 자체는 progressable.
 */

import { toByteArray } from 'base64-js';
import { encode } from 'blurhash';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode as decodeJpeg } from 'jpeg-js';

export type BlurhashComponents = { x: number; y: number };

const DEFAULT_THUMBNAIL = 32;
const DEFAULT_COMPONENTS: BlurhashComponents = { x: 4, y: 3 };

export type ComputeBlurhashOptions = {
  /** 축소 해상도(정사각형). 기본 32. */
  thumbnailSize?: number;
  /** blurhash 성분 수. x/y ∈ [1, 9]. 기본 {x:4, y:3} (Lucide 권장 밸런스). */
  components?: BlurhashComponents;
};

/**
 * 이미지 URI → blurhash 해시. 업로드 파이프라인에서 이미지와 함께 저장할 것.
 * 실패 시(포맷 불일치 등) throw 하므로 호출부에서 graceful fallback 처리 권장:
 *
 * ```ts
 * let blurhash: string | null = null;
 * try {
 *   blurhash = await computeBlurhash(uri);
 * } catch (err) {
 *   logger.warn('blurhash 계산 실패', err);
 * }
 * ```
 */
export async function computeBlurhash(
  uri: string,
  options: ComputeBlurhashOptions = {}
): Promise<string> {
  const { thumbnailSize = DEFAULT_THUMBNAIL, components = DEFAULT_COMPONENTS } = options;

  if (!uri) throw new Error('computeBlurhash: empty uri');
  assertComponents(components);

  // 1. JPEG 32×32 썸네일 + base64 출력
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: thumbnailSize, height: thumbnailSize } }],
    { format: ImageManipulator.SaveFormat.JPEG, base64: true, compress: 0.8 }
  );

  if (!manipulated.base64) {
    throw new Error('computeBlurhash: manipulator returned no base64 payload');
  }

  // 2. base64 → bytes
  const bytes = toByteArray(manipulated.base64);

  // 3. JPEG → RGBA
  const decoded = decodeJpeg(bytes, { useTArray: true });

  if (!decoded.data || !decoded.width || !decoded.height) {
    throw new Error('computeBlurhash: jpeg decode produced empty image');
  }

  // 4. RGBA → blurhash
  // jpeg-js.data 는 Uint8Array, blurhash.encode 는 Uint8ClampedArray 시그니처.
  // 런타임 바이트 레이아웃은 동일하므로 타입 캐스트로 충분.
  return encode(
    decoded.data as unknown as Uint8ClampedArray,
    decoded.width,
    decoded.height,
    components.x,
    components.y
  );
}

function assertComponents({ x, y }: BlurhashComponents): void {
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    throw new Error('blurhash components must be integers');
  }
  if (x < 1 || x > 9 || y < 1 || y > 9) {
    throw new Error('blurhash components must be in [1, 9]');
  }
}
