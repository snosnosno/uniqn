/**
 * Supabase 세션 저장소 하드닝 (감사 auth-F3)
 *
 * @description 네이티브 세션이 AsyncStorage 평문에 있었다. refresh token 은 장기
 *   자격증명이라 유출되면 비밀번호 변경으로도 안 끊긴다.
 *
 *   여기서 고정하는 계약 4가지:
 *   1. 세션은 SecureStore 에만 남는다 — 평문·암호문 어느 것도 일반 저장소에 남지 않는다.
 *   2. 2048 바이트 상한을 넘지 않게 조각낸다(한글·이모지 포함해 **바이트** 기준).
 *   3. 구버전에서 올라온 평문 세션은 옮기고 **원본을 지운다** — 안 지우면 하드닝이 무의미하다.
 *   4. SecureStore 가 실패하면 AsyncStorage 로 떨어진다 — 대안이 "로그인 유지 불가"라서다.
 *      폴백 결과는 하드닝 이전과 같으므로 지금보다 나빠지지 않는다.
 *   5. (Sentry #145607041) 조각은 `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` 로 기록한다 —
 *      기본값 `WHEN_UNLOCKED` 는 기기가 잠긴 동안 읽히지 않아 백그라운드 세션 조회가 터진다.
 *      옵션만 바꾸면 기존 사용자는 그대로이므로(SecItemUpdate 는 접근 수준을 안 바꾼다)
 *      옛 형식 인덱스는 **지운 뒤 다시 넣는다**.
 */

import * as SecureStore from 'expo-secure-store';
import { logger } from '@/utils/logger';
import {
  supabaseSessionStorage,
  chunkByUtf8Bytes,
  utf8ByteLength,
} from '../supabaseSessionStorage';

const mockSecureStore = new Map<string, string>();
const mockAsyncStorage = new Map<string, string>();

/** 실기기의 `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` 에 대응하는 상수값. */
const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 1;

type FailureMode = false | 'generic' | 'locked';
let mockSecureStoreShouldFail: FailureMode = false;

/** 실기기가 잠겼을 때 expo-secure-store 가 던지는 것과 같은 형태의 에러. */
function mockKeychainError(): Error {
  if (mockSecureStoreShouldFail === 'locked') {
    const error = new Error(
      "Calling the 'getValueWithKeyAsync' function has failed\n" +
        '→ Caused by: User interaction is not allowed.'
    );
    (error as { code?: string }).code = 'ERR_KEY_CHAIN';
    return error;
  }
  return new Error('keychain unavailable');
}

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
  setItemAsync: jest.fn(async (key: string, value: string) => {
    if (mockSecureStoreShouldFail) throw mockKeychainError();
    mockSecureStore.set(key, value);
  }),
  getItemAsync: jest.fn(async (key: string) => {
    if (mockSecureStoreShouldFail) throw mockKeychainError();
    return mockSecureStore.get(key) ?? null;
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStore.delete(key);
  }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockAsyncStorage.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockAsyncStorage.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      mockAsyncStorage.delete(key);
    }),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const SESSION_KEY = 'sb-ygfxukhktpqymahfrvbz-auth-token';

/** 실제 세션과 비슷한 크기(JWT 2개 + user 객체)의 값을 만든다. */
function makeLargeSession(): string {
  return JSON.stringify({
    access_token: 'a'.repeat(1200),
    refresh_token: 'r'.repeat(400),
    user: { id: 'u1', name: '홍길동', email: 'test@example.com' },
  });
}

beforeEach(() => {
  mockSecureStore.clear();
  mockAsyncStorage.clear();
  mockSecureStoreShouldFail = false;
  jest.clearAllMocks();
});

describe('utf8ByteLength / chunkByUtf8Bytes', () => {
  it('ASCII·한글·이모지의 바이트 길이를 정확히 센다', () => {
    expect(utf8ByteLength('abc')).toBe(3);
    expect(utf8ByteLength('한글')).toBe(6); // 3바이트 × 2
    expect(utf8ByteLength('😀')).toBe(4); // 서로게이트 페어 = 1 코드포인트 4바이트
  });

  it('모든 조각이 바이트 상한을 넘지 않는다 (한글이 섞여도)', () => {
    const value = '가나다라마'.repeat(500);
    const chunks = chunkByUtf8Bytes(value, 100);

    chunks.forEach((chunk) => {
      expect(utf8ByteLength(chunk)).toBeLessThanOrEqual(100);
    });
    expect(chunks.join('')).toBe(value);
  });

  it('이모지를 쪼개지 않는다 (서로게이트 페어 파손 방지)', () => {
    // 상한을 이모지 하나보다 살짝 크게 잡아 경계에 걸리게 한다
    const value = '😀'.repeat(10);
    const chunks = chunkByUtf8Bytes(value, 6);

    expect(chunks.join('')).toBe(value);
    chunks.forEach((chunk) => {
      expect(chunk.includes('�')).toBe(false);
    });
  });
});

describe('supabaseSessionStorage', () => {
  it('큰 세션을 조각내 SecureStore 에 저장하고 그대로 복원한다', async () => {
    const session = makeLargeSession();

    await supabaseSessionStorage.setItem(SESSION_KEY, session);

    // 상한을 넘겼다면 실기기에서 저장이 조용히 실패한다
    Array.from(mockSecureStore.values()).forEach((chunk) => {
      expect(utf8ByteLength(chunk)).toBeLessThanOrEqual(2048);
    });
    expect(mockSecureStore.size).toBeGreaterThan(1);

    await expect(supabaseSessionStorage.getItem(SESSION_KEY)).resolves.toBe(session);
  });

  it('세션이 AsyncStorage 평문으로 남지 않는다 (하드닝의 요점)', async () => {
    await supabaseSessionStorage.setItem(SESSION_KEY, makeLargeSession());

    expect(mockAsyncStorage.size).toBe(0);
  });

  it('저장된 적 없으면 null 이다', async () => {
    await expect(supabaseSessionStorage.getItem(SESSION_KEY)).resolves.toBeNull();
  });

  it('조각 수가 줄어드는 갱신에서 이전 조각이 남지 않는다', async () => {
    await supabaseSessionStorage.setItem(SESSION_KEY, 'x'.repeat(5000));
    const before = mockSecureStore.size;

    await supabaseSessionStorage.setItem(SESSION_KEY, 'short');

    expect(mockSecureStore.size).toBeLessThan(before);
    await expect(supabaseSessionStorage.getItem(SESSION_KEY)).resolves.toBe('short');
  });

  it('removeItem 이 조각과 폴백 평문을 모두 지운다', async () => {
    await supabaseSessionStorage.setItem(SESSION_KEY, makeLargeSession());
    mockAsyncStorage.set(SESSION_KEY, 'stale-plaintext');

    await supabaseSessionStorage.removeItem(SESSION_KEY);

    expect(mockSecureStore.size).toBe(0);
    expect(mockAsyncStorage.has(SESSION_KEY)).toBe(false);
  });

  it('조각이 손상되면 반쪽 JSON 대신 null 을 준다', async () => {
    await supabaseSessionStorage.setItem(SESSION_KEY, makeLargeSession());
    // 조각 하나만 사라진 상황(부분 삭제·저장 실패)
    mockSecureStore.delete(`${SESSION_KEY}.0`);

    // 반쪽 JSON 을 돌려주면 Supabase 가 파싱 예외로 죽는다
    await expect(supabaseSessionStorage.getItem(SESSION_KEY)).resolves.toBeNull();
  });
});

describe('구버전 평문 세션 마이그레이션', () => {
  it('AsyncStorage 평문을 SecureStore 로 옮기고 원본을 지운다', async () => {
    const legacy = makeLargeSession();
    mockAsyncStorage.set(SESSION_KEY, legacy);

    // 마이그레이션이 없으면 1.0.7 올라온 사용자 전원이 로그아웃된다
    await expect(supabaseSessionStorage.getItem(SESSION_KEY)).resolves.toBe(legacy);

    // 옮기고 나면 평문은 남으면 안 된다 — 남기면 하드닝이 무의미하다
    expect(mockAsyncStorage.has(SESSION_KEY)).toBe(false);
    expect(mockSecureStore.size).toBeGreaterThan(0);

    // 다음 조회는 SecureStore 에서 온다
    await expect(supabaseSessionStorage.getItem(SESSION_KEY)).resolves.toBe(legacy);
  });
});

describe('SecureStore 장애 시 가용성 우선 폴백', () => {
  it('저장이 실패하면 AsyncStorage 로 떨어진다 (로그인 유지 불가보다는 낫다)', async () => {
    mockSecureStoreShouldFail = 'generic';

    await supabaseSessionStorage.setItem(SESSION_KEY, 'session-value');

    expect(mockAsyncStorage.get(SESSION_KEY)).toBe('session-value');
  });

  it('조회가 실패해도 폴백 값을 찾아낸다', async () => {
    mockAsyncStorage.set(SESSION_KEY, 'session-value');
    mockSecureStoreShouldFail = 'generic';

    await expect(supabaseSessionStorage.getItem(SESSION_KEY)).resolves.toBe('session-value');
  });

  it('폴백으로 저장된 새 세션이 SecureStore 의 옛 조각을 이긴다', async () => {
    // 회전 전 세션이 조각으로 들어가 있다
    await supabaseSessionStorage.setItem(SESSION_KEY, 'old-session');

    // 잠금 중 토큰이 회전돼 폴백 평문으로만 저장됐다
    mockSecureStoreShouldFail = 'locked';
    await supabaseSessionStorage.setItem(SESSION_KEY, 'rotated-session');
    mockSecureStoreShouldFail = false;

    // 옛 조각을 돌려주면 이미 폐기된 refresh token 으로 갱신을 시도하다 세션이 끊긴다
    await expect(supabaseSessionStorage.getItem(SESSION_KEY)).resolves.toBe('rotated-session');

    // 되찾은 뒤에는 조각으로 승격되고 평문은 남지 않는다
    expect(mockAsyncStorage.has(SESSION_KEY)).toBe(false);
    await expect(supabaseSessionStorage.getItem(SESSION_KEY)).resolves.toBe('rotated-session');
  });

  it('SecureStore 저장 성공 시 이전 폴백 평문을 지운다', async () => {
    mockAsyncStorage.set(SESSION_KEY, 'stale-plaintext');

    await supabaseSessionStorage.setItem(SESSION_KEY, 'fresh-session');

    expect(mockAsyncStorage.has(SESSION_KEY)).toBe(false);
    await expect(supabaseSessionStorage.getItem(SESSION_KEY)).resolves.toBe('fresh-session');
  });
});

describe('키체인 접근 수준 (Sentry #145607041)', () => {
  it('모든 조각을 AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY 로 기록한다', async () => {
    // 기본값 WHEN_UNLOCKED 면 기기가 잠긴 동안 백그라운드 조회가 전부 실패한다
    await supabaseSessionStorage.setItem(SESSION_KEY, makeLargeSession());

    const calls = jest.mocked(SecureStore.setItemAsync).mock.calls;
    expect(calls.length).toBeGreaterThan(1);
    calls.forEach(([, , options]) => {
      expect(options?.keychainAccessible).toBe(AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY);
    });
  });

  it('옛 형식 조각은 덮어쓰지 않고 지운 뒤 다시 넣는다', async () => {
    // v1 = 접두사 없는 개수. 실기기에서는 WHEN_UNLOCKED 로 찍혀 있는 조각이다.
    // SecItemUpdate 는 kSecAttrAccessible 을 안 바꾸므로 삭제가 없으면 영원히 안 고쳐진다.
    mockSecureStore.set(`${SESSION_KEY}.__n`, '2');
    mockSecureStore.set(`${SESSION_KEY}.0`, 'old-');
    mockSecureStore.set(`${SESSION_KEY}.1`, 'session');

    await supabaseSessionStorage.setItem(SESSION_KEY, 'new-session');

    const deleted = jest.mocked(SecureStore.deleteItemAsync).mock.calls.map(([key]) => key);
    expect(deleted).toContain(`${SESSION_KEY}.0`);
    expect(deleted).toContain(`${SESSION_KEY}.1`);
    expect(mockSecureStore.get(`${SESSION_KEY}.__n`)).toBe('v2:1');
    await expect(supabaseSessionStorage.getItem(SESSION_KEY)).resolves.toBe('new-session');
  });

  it('옛 형식으로 저장된 세션을 그대로 읽어낸다 (재로그인 없음)', async () => {
    mockSecureStore.set(`${SESSION_KEY}.__n`, '2');
    mockSecureStore.set(`${SESSION_KEY}.0`, 'old-');
    mockSecureStore.set(`${SESSION_KEY}.1`, 'session');

    await expect(supabaseSessionStorage.getItem(SESSION_KEY)).resolves.toBe('old-session');
  });

  it('현재 형식은 다시 지우지 않는다 (매 갱신마다 삭제-재삽입 금지)', async () => {
    await supabaseSessionStorage.setItem(SESSION_KEY, 'first');
    jest.mocked(SecureStore.deleteItemAsync).mockClear();

    await supabaseSessionStorage.setItem(SESSION_KEY, 'second');

    expect(jest.mocked(SecureStore.deleteItemAsync)).not.toHaveBeenCalled();
  });
});

describe('기기 잠금은 에러가 아니다 (Sentry 소음 차단)', () => {
  it('잠금으로 조회가 막히면 error 가 아니라 warn 으로 남긴다', async () => {
    mockSecureStoreShouldFail = 'locked';

    // logger.error 는 프로덕션에서 Sentry 로 전송된다 — 정상 동작을 이슈로 올리면 안 된다
    await expect(supabaseSessionStorage.getItem(SESSION_KEY)).resolves.toBeNull();

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('잠금으로 저장이 막혀도 error 가 아니라 warn 이고, 세션은 폴백으로 유지된다', async () => {
    mockSecureStoreShouldFail = 'locked';

    await supabaseSessionStorage.setItem(SESSION_KEY, 'session-value');

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
    expect(mockAsyncStorage.get(SESSION_KEY)).toBe('session-value');
  });

  it('잠금이 아닌 진짜 키체인 장애는 error 로 남긴다 (침묵 금지)', async () => {
    mockSecureStoreShouldFail = 'generic';

    await supabaseSessionStorage.setItem(SESSION_KEY, 'session-value');

    expect(logger.error).toHaveBeenCalled();
  });
});
