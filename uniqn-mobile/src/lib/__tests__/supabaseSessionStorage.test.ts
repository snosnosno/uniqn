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
 */

import {
  supabaseSessionStorage,
  chunkByUtf8Bytes,
  utf8ByteLength,
} from '../supabaseSessionStorage';

const mockSecureStore = new Map<string, string>();
const mockAsyncStorage = new Map<string, string>();

let mockSecureStoreShouldFail = false;

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async (key: string, value: string) => {
    if (mockSecureStoreShouldFail) throw new Error('keychain unavailable');
    mockSecureStore.set(key, value);
  }),
  getItemAsync: jest.fn(async (key: string) => {
    if (mockSecureStoreShouldFail) throw new Error('keychain unavailable');
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
    mockSecureStoreShouldFail = true;

    await supabaseSessionStorage.setItem(SESSION_KEY, 'session-value');

    expect(mockAsyncStorage.get(SESSION_KEY)).toBe('session-value');
  });

  it('조회가 실패해도 폴백 값을 찾아낸다', async () => {
    mockAsyncStorage.set(SESSION_KEY, 'session-value');
    mockSecureStoreShouldFail = true;

    await expect(supabaseSessionStorage.getItem(SESSION_KEY)).resolves.toBe('session-value');
  });
});
