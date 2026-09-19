/**
 * Supabase 세션 저장소 — 네이티브 (감사 auth-F3).
 *
 * ## 왜
 * 지금까지 네이티브 세션은 `AsyncStorage` 에 **평문**으로 있었다. AsyncStorage 는
 * 앱 샌드박스 안의 평범한 파일이라, 루팅·탈옥 기기나 기기 백업에서 access/refresh 토큰이
 * 그대로 읽힌다. refresh token 은 장기 자격증명이라 유출되면 비밀번호 변경으로도 안 끊긴다.
 *
 * ## 왜 지금인가
 * 저장 형식을 바꾸면 기존 세션은 원칙적으로 무효가 된다. prod users 27명인 지금이
 * 그 비용이 사실상 0인 마지막 구간이다.
 * (그래도 아래 마이그레이션으로 실제 무효화는 피한다 — 공짜로 되는 일을 굳이 버리지 않는다.)
 *
 * ## 왜 청킹인가 (AES 암호화 + AsyncStorage 오프로드 대신)
 * Supabase 공식 예제(LargeSecureStore)는 AES 키만 SecureStore 에 두고 **암호문은
 * AsyncStorage 에** 둔다. 그러면 `aes-js` 같은 암호 라이브러리가 새로 필요하고,
 * 암호문이 여전히 일반 저장소에 남는다.
 *
 * 여기서는 값을 조각내 **전부 SecureStore(iOS 키체인 / Android KeyStore)** 에 넣는다:
 *   - 새 의존성 0개 — 검증할 암호 코드가 없다는 것 자체가 보안 이득이다.
 *   - 평문·암호문 어느 것도 일반 저장소에 남지 않는다.
 * 청킹이 필요한 이유는 SecureStore 값 상한이 **2048 바이트**이고, 세션 JSON 은
 * JWT 두 개 + user 객체라 그걸 쉽게 넘기기 때문이다.
 *
 * ## 가용성 우선 폴백 (의도적 절충)
 * SecureStore 가 실패하면 **AsyncStorage 로 떨어진다**. 기밀성을 깎는 선택이지만,
 * 대안은 "로그인 상태를 아예 유지하지 못하는 앱"이다. 폴백 결과는 **현재 상태와 동일**
 * 하므로 어떤 경우에도 지금보다 나빠지지 않는다. 대신 에러로 기록해 관측 가능하게 둔다.
 *
 * ## 키체인 접근 수준 — `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` (Sentry #145607041)
 * expo-secure-store 의 기본값은 `WHEN_UNLOCKED` 다. 그러면 **기기가 잠긴 동안 조각을 읽을 수
 * 없다** — 키체인이 `errSecInteractionNotAllowed`("User interaction is not allowed.")로 거부한다.
 * 백그라운드에서 세션을 읽는 경로(푸시 처리·포그라운드 복귀 직전 갱신)가 그대로 터진다.
 *
 * `AFTER_FIRST_UNLOCK` 계열은 **부팅 후 첫 잠금해제 이후로는** 잠긴 상태에서도 읽힌다.
 * 세션 토큰에 필요한 건 딱 그만큼이다. `THIS_DEVICE_ONLY` 를 붙이는 이유는 이 파일이 애초에
 * 막으려던 것이 **기기 백업·기기 이전에서의 refresh token 유출**이기 때문이다(위 참조).
 * 대가: 기기를 새로 사서 복원하면 재로그인해야 한다. 장기 자격증명을 옮기지 않는 쪽을 택한다.
 * (선례: `secureStorage.ts` 의 `authStorage.setRefreshToken`)
 *
 * ⚠️ 옵션만 바꿔서는 **기존 사용자에게 적용되지 않는다.** expo 의 iOS 구현은 이미 있는 항목에
 * `SecItemAdd` 가 `errSecDuplicateItem` 을 내면 `SecItemUpdate` 로 넘어가는데, 그 update 는
 * `kSecValueData` 만 갱신하고 `kSecAttrAccessible` 은 손대지 않는다. 그래서 인덱스에 형식 버전을
 * 적어두고, 옛 버전이면 조각을 **지운 뒤 새로 넣어**(=`SecItemAdd` 경로) 접근 수준을 다시 찍는다.
 *
 * ## 웹은 건드리지 않는다
 * 웹 절반(sessionStorage vs localStorage)은 자동로그인과의 트레이드오프가 있어
 * 원장이 "결정 기록만 남기고 교체하지 마라"로 못박았다. 이 어댑터는 네이티브 전용이다.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { logger } from '@/utils/logger';

/**
 * 조각 하나의 UTF-8 바이트 상한.
 * SecureStore 상한이 2048 이라 여유를 두고 1600 으로 잡는다 — 플랫폼별 오버헤드
 * (키 이름·메타데이터)를 정확히 알 수 없으므로 아슬아슬하게 맞추지 않는다.
 */
const CHUNK_BYTE_LIMIT = 1600;

/** 조각 개수를 적어두는 인덱스 키의 접미사. 이게 있어야 몇 조각을 읽을지 안다. */
const COUNT_SUFFIX = '.__n';

/**
 * 조각의 저장 형식 버전. 인덱스 값에 `v<N>:<개수>` 로 함께 적는다.
 * 접두사가 없거나 번호가 다르면 옛 접근 수준으로 기록된 조각이라는 뜻이다(위 ⚠️ 참조).
 */
const FORMAT_VERSION = 2;

/** 모든 조각에 적용할 iOS 키체인 접근 수준. Android 에서는 무시된다. */
const KEYCHAIN_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

/**
 * 키체인이 **기기 잠금** 때문에 거부했을 때 원인 문구(errSecInteractionNotAllowed, -25308).
 * expo 의 `ERR_KEY_CHAIN` 코드는 키체인 실패 전반을 뭉뚱그려서, 코드로 거르면 진짜 장애까지
 * 함께 삼킨다. 잠금인지 아닌지는 이 문구로만 갈린다.
 */
const KEYCHAIN_LOCKED_HINT = 'User interaction is not allowed';

/**
 * 잠금 때문에 거부된 것인가.
 *
 * 부팅 후 첫 잠금해제 전에는 `AFTER_FIRST_UNLOCK` 로도 여전히 막히므로, 이 경로는 하드닝
 * 이후에도 남는다. **정상 동작**이라 `logger.error` 로 올리면 Sentry 가 소음으로 찬다.
 */
function isKeychainLockedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.message.includes(KEYCHAIN_LOCKED_HINT)) return true;

  const cause: unknown = error.cause;
  return cause instanceof Error && cause.message.includes(KEYCHAIN_LOCKED_HINT);
}

/**
 * SecureStore 는 영숫자와 `.`, `-`, `_` 만 키로 허용한다.
 * Supabase 키(`sb-<ref>-auth-token`)는 이미 안전하지만, 형식이 바뀌어도 깨지지 않게 정제한다.
 */
function sanitizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * 문자열의 UTF-8 바이트 길이.
 *
 * `TextEncoder` 를 쓰지 않는다 — Hermes 에서의 존재 여부가 런타임·버전에 따라 갈리는데,
 * 여기서 틀리면 조각이 상한을 넘겨 **저장이 조용히 실패**한다(=로그인 유지 불가).
 * 코드포인트를 직접 세는 편이 짧고 확실하다.
 */
export function utf8ByteLength(value: string): number {
  let bytes = 0;

  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code <= 0xffff) bytes += 3;
    else bytes += 4;
  }

  return bytes;
}

/**
 * UTF-8 바이트 상한을 넘지 않게 문자열을 조각낸다.
 * 서로게이트 페어(이모지)를 쪼개면 복원 시 깨지므로 코드포인트 단위로 자른다.
 */
export function chunkByUtf8Bytes(value: string, limit: number = CHUNK_BYTE_LIMIT): string[] {
  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;

  for (const char of value) {
    const charBytes = utf8ByteLength(char);

    if (currentBytes + charBytes > limit && current.length > 0) {
      chunks.push(current);
      current = '';
      currentBytes = 0;
    }

    current += char;
    currentBytes += charBytes;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

function chunkKey(base: string, index: number): string {
  return `${base}.${index}`;
}

/** 남아 있을 수 있는 조각을 인덱스 기준으로 지운다(개수가 줄어드는 갱신 대비). */
async function deleteChunks(base: string, count: number): Promise<void> {
  const deletions: Promise<void>[] = [SecureStore.deleteItemAsync(`${base}${COUNT_SUFFIX}`)];

  for (let index = 0; index < count; index += 1) {
    deletions.push(SecureStore.deleteItemAsync(chunkKey(base, index)));
  }

  await Promise.all(deletions.map((promise) => promise.catch(() => undefined)));
}

interface ChunkIndex {
  /** 저장된 조각 개수. 읽을 수 없으면 0. */
  count: number;
  /** 현재 형식 버전(=현재 키체인 접근 수준)으로 기록된 조각인가. */
  isCurrentFormat: boolean;
}

function formatChunkIndex(count: number): string {
  return `v${FORMAT_VERSION}:${count}`;
}

function toCount(raw: string): number {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

async function readChunkIndex(base: string): Promise<ChunkIndex> {
  const raw = await SecureStore.getItemAsync(`${base}${COUNT_SUFFIX}`);
  // 아무것도 없으면 옮길 옛 조각도 없다 — 이제부터 쓰는 건 전부 현재 형식이다.
  if (raw === null) return { count: 0, isCurrentFormat: true };

  const versioned = /^v(\d+):(\d+)$/.exec(raw);
  if (versioned) {
    return {
      count: toCount(versioned[2]),
      isCurrentFormat: Number.parseInt(versioned[1], 10) === FORMAT_VERSION,
    };
  }

  // 접두사 없는 개수 = v1. 기본값(WHEN_UNLOCKED)으로 기록돼 잠금 중에는 못 읽는 조각이다.
  return { count: toCount(raw), isCurrentFormat: false };
}

/**
 * AsyncStorage 평문에 값이 있으면 SecureStore 로 올리고 원본을 지운다.
 *
 * 평문이 남아 있는 경우는 둘뿐이고, **둘 다 SecureStore 조각보다 나중이다**:
 *   1. 구버전에서 올라온 세션 — 아직 조각이 없다. 이게 없으면 1.0.7 사용자 전원이 로그아웃된다.
 *   2. 키체인 쓰기 실패로 떨어진 폴백 — 조각에는 **옛 세션**이 남아 있다.
 *
 * 2번을 안 챙기면 회전된 refresh token 대신 폐기된 옛 토큰을 돌려주게 되고,
 * 결국 세션이 끊긴다. 옮긴 뒤 평문 원본은 **반드시 지운다** — 남기면 하드닝의 의미가 없다.
 */
async function promoteFallbackValue(key: string, base: string, value: string): Promise<string> {
  logger.info('세션을 AsyncStorage 평문에서 SecureStore 로 옮깁니다', {
    component: 'supabaseSessionStorage',
  });

  const written = await writeChunks(base, value);
  if (written) {
    // 옮긴 뒤에만 지운다. 순서를 뒤집으면 쓰기 실패 시 세션이 증발한다.
    await AsyncStorage.removeItem(key).catch(() => undefined);
  }

  return value;
}

async function writeChunks(base: string, value: string): Promise<boolean> {
  const chunks = chunkByUtf8Bytes(value);

  try {
    const previous = await readChunkIndex(base);

    // 지워야 하는 두 경우:
    //   - 옛 형식: 덮어쓰기(SecItemUpdate)로는 접근 수준이 안 바뀐다. 지워야 SecItemAdd 를 탄다.
    //   - 조각 수 감소: 이전 값의 조각이 더 많았다면 남는다.
    if (!previous.isCurrentFormat) {
      await deleteChunks(base, Math.max(previous.count, chunks.length));
    } else if (previous.count > chunks.length) {
      await deleteChunks(base, previous.count);
    }

    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(chunkKey(base, index), chunk, KEYCHAIN_OPTIONS)
      )
    );
    // 개수는 **마지막에** 쓴다. 먼저 쓰면 중간에 실패했을 때 없는 조각을 읽으러 간다.
    await SecureStore.setItemAsync(
      `${base}${COUNT_SUFFIX}`,
      formatChunkIndex(chunks.length),
      KEYCHAIN_OPTIONS
    );
    return true;
  } catch (error) {
    if (isKeychainLockedError(error)) {
      // 부팅 후 첫 잠금해제 전. 폴백으로 세션은 유지되고, 다음 쓰기에서 조각으로 복귀한다.
      logger.warn('기기 잠금으로 세션을 SecureStore 에 저장하지 못했습니다 — 평문 폴백', {
        component: 'supabaseSessionStorage',
      });
      return false;
    }

    logger.error(
      '세션을 SecureStore 에 저장하지 못했습니다 — AsyncStorage 로 폴백합니다',
      error instanceof Error ? error : new Error(String(error)),
      { component: 'supabaseSessionStorage' }
    );
    return false;
  }
}

/**
 * Supabase `SupportedStorage` 구현.
 * 네이티브에서만 쓴다 — 웹은 Supabase 기본값(localStorage)을 그대로 둔다.
 */
export const supabaseSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const base = sanitizeKey(key);

    // 평문이 남아 있으면 그게 최신이다 — 조각보다 **먼저** 본다.
    // (구버전 잔존이거나, 키체인 쓰기 실패로 떨어진 폴백. 자세한 이유는 promoteFallbackValue 참조)
    const fallback = await AsyncStorage.getItem(key).catch(() => null);
    if (fallback !== null) {
      return promoteFallbackValue(key, base, fallback);
    }

    try {
      const { count } = await readChunkIndex(base);

      if (count === 0) {
        // 조각도 평문도 없다 = 로그인한 적 없거나 로그아웃 상태다.
        return null;
      }

      const parts = await Promise.all(
        Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(chunkKey(base, index)))
      );

      // 조각이 하나라도 비면 값이 손상된 것이다. 반쪽 JSON 을 돌려주면
      // Supabase 가 파싱 예외로 죽으므로 없는 것으로 취급한다.
      if (parts.some((part) => part === null)) {
        logger.warn('세션 조각이 손상되어 폐기합니다 — 재로그인이 필요합니다', {
          component: 'supabaseSessionStorage',
          data: { expected: count },
        });
        await deleteChunks(base, count);
        return null;
      }

      return parts.join('');
    } catch (error) {
      if (isKeychainLockedError(error)) {
        // 부팅 후 첫 잠금해제 전의 백그라운드 조회. 정상 동작이라 error 로 올리지 않는다.
        logger.warn('기기 잠금으로 세션을 조회하지 못했습니다 — 잠금해제 후 복구됩니다', {
          component: 'supabaseSessionStorage',
        });
        return null;
      }

      logger.error(
        '세션 조회 실패 — AsyncStorage 폴백을 시도합니다',
        error instanceof Error ? error : new Error(String(error)),
        { component: 'supabaseSessionStorage' }
      );
      return AsyncStorage.getItem(key);
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    const base = sanitizeKey(key);
    const written = await writeChunks(base, value);

    if (written) {
      // 이전 폴백이 남긴 평문을 지운다. 남겨두면 getItem 이 그걸 최신으로 보고
      // 방금 쓴 조각을 계속 무시한다(=옛 세션에 갇힌다).
      await AsyncStorage.removeItem(key).catch(() => undefined);
      return;
    }

    // 가용성 우선 — 여기서 포기하면 앱이 로그인 상태를 유지하지 못한다.
    // 폴백 결과는 하드닝 이전과 동일하므로 지금보다 나빠지지는 않는다.
    await AsyncStorage.setItem(key, value);
  },

  async removeItem(key: string): Promise<void> {
    const base = sanitizeKey(key);

    try {
      const { count } = await readChunkIndex(base);
      await deleteChunks(base, Math.max(count, 1));
    } catch {
      // 삭제 실패로 로그아웃을 막지 않는다.
    }

    // 폴백 경로에 남았을 수 있는 평문도 함께 지운다.
    await AsyncStorage.removeItem(key).catch(() => undefined);
  },
};
