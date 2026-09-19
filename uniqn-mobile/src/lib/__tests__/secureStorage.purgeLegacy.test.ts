/**
 * `purgeLegacyLoginAttemptKeys` — PR#406 잔존 키 정리 (한시 코드, 2026-11 제거 예정).
 *
 * 잠그는 것:
 *  1. 웹에서 `uniqn_secure_login_attempts_<평문이메일>` 키가 실제로 지워진다
 *  2. **다른 키는 건드리지 않는다** — clearAll 재사용이 아니라 접두사 한정 소거임을 증명
 *  3. 네이티브에서는 localStorage 를 아예 만지지 않는다 (SecureStore 는 열거 불가)
 *  4. localStorage 부재 환경에서도 throw 하지 않는다 (부팅을 막으면 안 된다)
 *  5. 로그에 **키 이름(=이메일)이 새지 않는다** — 이 수정 자체가 유출 경로가 되면 안 된다
 */
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock('@/utils/logger', () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockPlatform = { OS: 'web' as string };
jest.mock('react-native', () => ({
  get Platform() {
    return mockPlatform;
  },
}));

// secureStorage → mmkvStorage → expo-crypto → expo-modules-core 사슬을 끊는다.
// (react-native 를 목으로 대체하면 css-interop 의 Appearance 접근이 그 사슬에서 터진다)
jest.mock('@/lib/mmkvStorage', () => ({
  getMMKVInstance: jest.fn(() => null),
}));

/** 열거 가능한 최소 localStorage 스텁 (jsdom 없이도 동작하도록 직접 구현) */
function makeLocalStorageStub(seed: Record<string, string>) {
  const store = new Map<string, string>(Object.entries(seed));
  return {
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    snapshot: () => [...store.keys()],
  };
}

type LocalStorageStub = ReturnType<typeof makeLocalStorageStub>;

function installLocalStorage(stub: LocalStorageStub | undefined) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: stub,
    configurable: true,
    writable: true,
  });
}

const LEGACY_A = 'uniqn_secure_login_attempts_alice@example.com';
const LEGACY_B = 'uniqn_secure_login_attempts_bob@holdem.kr';

function seedKeys() {
  return {
    [LEGACY_A]: '{"count":3}',
    [LEGACY_B]: '{"count":1}',
    // 대조군 — 지워지면 안 되는 정상 키들
    uniqn_secure_theme: '"dark"',
    uniqn_secure_autoLoginEnabled: 'true',
    // 접두사가 비슷하지만 다른 키 (경계 확인)
    uniqn_secure_login_state: '"idle"',
    unrelated_key: 'x',
  };
}

describe('purgeLegacyLoginAttemptKeys', () => {
  beforeEach(() => {
    jest.resetModules();
    mockLoggerInfo.mockClear();
    mockLoggerWarn.mockClear();
    mockPlatform.OS = 'web';
  });

  afterEach(() => {
    installLocalStorage(undefined);
  });

  function load() {
    // Platform mock 이 모듈 로드 시점에 평가되므로 매 케이스마다 새로 require 한다.
    return require('../secureStorage').purgeLegacyLoginAttemptKeys as () => void;
  }

  it('웹에서 레거시 login_attempts 키를 전부 지운다', () => {
    const stub = makeLocalStorageStub(seedKeys());
    installLocalStorage(stub);

    load()();

    expect(stub.getItem(LEGACY_A)).toBeNull();
    expect(stub.getItem(LEGACY_B)).toBeNull();
  });

  it('레거시 키가 아닌 것은 하나도 건드리지 않는다 (clearAll 이 아니다)', () => {
    const stub = makeLocalStorageStub(seedKeys());
    installLocalStorage(stub);

    load()();

    expect(stub.getItem('uniqn_secure_theme')).toBe('"dark"');
    expect(stub.getItem('uniqn_secure_autoLoginEnabled')).toBe('true');
    // 접두사가 `login_` 까지 겹치지만 `login_attempts_` 는 아닌 키
    expect(stub.getItem('uniqn_secure_login_state')).toBe('"idle"');
    expect(stub.getItem('unrelated_key')).toBe('x');
    expect(stub.snapshot()).toHaveLength(4);
  });

  it('네이티브에서는 localStorage 를 만지지 않는다', () => {
    mockPlatform.OS = 'ios';
    const stub = makeLocalStorageStub(seedKeys());
    installLocalStorage(stub);

    load()();

    // 조기 반환 — 레거시 키가 그대로 남아 있어야 한다(SecureStore 는 열거 불가라 방치가 설계)
    expect(stub.getItem(LEGACY_A)).toBe('{"count":3}');
    expect(stub.snapshot()).toHaveLength(6);
  });

  it('localStorage 가 없는 환경에서도 throw 하지 않는다', () => {
    installLocalStorage(undefined);
    expect(() => load()()).not.toThrow();
  });

  it('삭제 로그에 키 이름(=평문 이메일)을 남기지 않는다', () => {
    const stub = makeLocalStorageStub(seedKeys());
    installLocalStorage(stub);

    load()();

    expect(mockLoggerInfo).toHaveBeenCalledWith(expect.any(String), { count: 2 });
    const logged = JSON.stringify(mockLoggerInfo.mock.calls);
    expect(logged).not.toContain('alice@example.com');
    expect(logged).not.toContain('bob@holdem.kr');
    expect(logged).not.toContain('login_attempts_');
  });

  it('지울 것이 없으면 로그도 남기지 않는다 (매 부팅 소음 방지)', () => {
    const stub = makeLocalStorageStub({ uniqn_secure_theme: '"dark"' });
    installLocalStorage(stub);

    load()();

    expect(mockLoggerInfo).not.toHaveBeenCalled();
  });
});
