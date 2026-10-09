import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** 모듈이 로드될 때 저장값을 읽으므로, 케이스마다 저장소를 채운 뒤 새로 불러온다. */
async function load() {
  vi.resetModules();
  return import('./chime');
}

describe('chime — 화면별 스위치', () => {
  // 테스트 환경은 node 라 브라우저 전역이 없다 — 저장소와 window 만 흉내 낸다(AudioContext 는 없어 소리는 안 난다).
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      clear: () => store.clear(),
    });
    vi.stubGlobal('window', { addEventListener: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('콘솔과 플레이어뷰는 저장 키가 다르다', async () => {
    const { CHIME_STORAGE_KEYS } = await load();
    expect(CHIME_STORAGE_KEYS.console).not.toBe(CHIME_STORAGE_KEYS.player);
    // 콘솔 키는 종전 값 — 이미 켜 둔 운영 PC 의 설정을 잃지 않는다
    expect(CHIME_STORAGE_KEYS.console).toBe('ops-web:clock-chime');
  });

  it('플레이어 알림을 켜도 콘솔 클럭음은 그대로다(반대도)', async () => {
    const { isChimeEnabled, setChimeEnabled, CHIME_STORAGE_KEYS } = await load();
    setChimeEnabled(true, 'player');
    expect(isChimeEnabled('player')).toBe(true);
    expect(isChimeEnabled('console')).toBe(false);
    expect(localStorage.getItem(CHIME_STORAGE_KEYS.console)).toBeNull();

    setChimeEnabled(true, 'console');
    setChimeEnabled(false, 'player');
    expect(isChimeEnabled('console')).toBe(true);
    expect(isChimeEnabled('player')).toBe(false);
  });

  it('채널을 안 주면 콘솔 스위치다(기존 호출부 그대로)', async () => {
    const { isChimeEnabled, setChimeEnabled } = await load();
    setChimeEnabled(true);
    expect(isChimeEnabled()).toBe(true);
    expect(isChimeEnabled('player')).toBe(false);
  });

  it('새로고침 뒤 저장값을 채널별로 되읽는다 — 옛 공용 키는 플레이어 알림을 켜지 않는다', async () => {
    localStorage.setItem('ops-web:clock-chime', '1');
    const { isChimeEnabled } = await load();
    expect(isChimeEnabled('console')).toBe(true);
    expect(isChimeEnabled('player')).toBe(false);
  });
});
