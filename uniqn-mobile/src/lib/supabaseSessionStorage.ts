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

async function readChunkCount(base: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(`${base}${COUNT_SUFFIX}`);
  if (raw === null) return 0;

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * 이전 빌드가 AsyncStorage 에 남긴 평문 세션을 SecureStore 로 옮긴다.
 *
 * 이게 없으면 1.0.7 로 올라온 사용자 전원이 한 번 로그아웃된다. 27명이라 감당 가능한
 * 비용이긴 하지만, 옮기는 비용이 더 싸다. 옮긴 뒤 평문 원본은 **반드시 지운다** —
 * 남겨두면 하드닝의 의미가 없다.
 */
async function migrateFromAsyncStorage(key: string, base: string): Promise<string | null> {
  const legacy = await AsyncStorage.getItem(key);
  if (legacy === null) return null;

  logger.info('세션 저장소 마이그레이션 — AsyncStorage 평문 → SecureStore', {
    component: 'supabaseSessionStorage',
  });

  const written = await writeChunks(base, legacy);
  if (written) {
    // 옮긴 뒤에만 지운다. 순서를 뒤집으면 쓰기 실패 시 세션이 증발한다.
    await AsyncStorage.removeItem(key);
  }

  return legacy;
}

async function writeChunks(base: string, value: string): Promise<boolean> {
  const chunks = chunkByUtf8Bytes(value);

  try {
    // 이전 값의 조각이 더 많았다면 남는다 — 먼저 정리한다.
    const previousCount = await readChunkCount(base);
    if (previousCount > chunks.length) {
      await deleteChunks(base, previousCount);
    }

    await Promise.all(
      chunks.map((chunk, index) => SecureStore.setItemAsync(chunkKey(base, index), chunk))
    );
    // 개수는 **마지막에** 쓴다. 먼저 쓰면 중간에 실패했을 때 없는 조각을 읽으러 간다.
    await SecureStore.setItemAsync(`${base}${COUNT_SUFFIX}`, String(chunks.length));
    return true;
  } catch (error) {
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

    try {
      const count = await readChunkCount(base);

      if (count === 0) {
        // 아직 SecureStore 에 없다 = 첫 실행이거나 구버전에서 올라온 사용자다.
        return await migrateFromAsyncStorage(key, base);
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

    if (!written) {
      // 가용성 우선 — 여기서 포기하면 앱이 로그인 상태를 유지하지 못한다.
      // 폴백 결과는 하드닝 이전과 동일하므로 지금보다 나빠지지는 않는다.
      await AsyncStorage.setItem(key, value);
    }
  },

  async removeItem(key: string): Promise<void> {
    const base = sanitizeKey(key);

    try {
      const count = await readChunkCount(base);
      await deleteChunks(base, Math.max(count, 1));
    } catch {
      // 삭제 실패로 로그아웃을 막지 않는다.
    }

    // 폴백 경로에 남았을 수 있는 평문도 함께 지운다.
    await AsyncStorage.removeItem(key).catch(() => undefined);
  },
};
