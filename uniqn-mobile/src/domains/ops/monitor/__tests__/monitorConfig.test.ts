/** monitor_config 파서 — 전방 호환 계약(C6 스펙 §3) 전수. */
import { DEFAULT_MONITOR_SLOTS, MONITOR_MODULE_IDS, parseMonitorConfig } from '../monitorConfig';

describe('parseMonitorConfig', () => {
  it('null/undefined → 기본값(full + 기본 5슬롯)', () => {
    for (const raw of [null, undefined]) {
      const c = parseMonitorConfig(raw);
      expect(c.preset).toBe('full');
      expect(c.slots).toEqual([...DEFAULT_MONITOR_SLOTS]);
    }
  });

  it('비객체(문자열/배열/숫자) → 기본값', () => {
    for (const raw of ['full', 42, ['players'], true]) {
      expect(parseMonitorConfig(raw)).toEqual({
        preset: 'full',
        slots: [...DEFAULT_MONITOR_SLOTS],
      });
    }
  });

  it('미지 버전(v≠1) → 통째로 기본값 폴백(오독 방지)', () => {
    expect(
      parseMonitorConfig({ v: 2, preset: 'mirror', slots: ['players', null, null, null, null] })
    ).toEqual({ preset: 'full', slots: [...DEFAULT_MONITOR_SLOTS] });
  });

  it('유효 구성은 그대로 통과', () => {
    const c = parseMonitorConfig({
      v: 1,
      preset: 'mirror',
      slots: ['players', 'entries', null, 'koPool', 'nextBreak'],
    });
    expect(c.preset).toBe('mirror');
    expect(c.slots).toEqual(['players', 'entries', null, 'koPool', 'nextBreak']);
  });

  it('미지 preset → full 폴백(slots 는 유지)', () => {
    const c = parseMonitorConfig({
      v: 1,
      preset: 'diagonal',
      slots: ['players', null, null, null, null],
    });
    expect(c.preset).toBe('full');
    expect(c.slots[0]).toBe('players');
  });

  it('미지 모듈 id → 해당 슬롯만 숨김(null), 다른 슬롯 유지', () => {
    const c = parseMonitorConfig({
      v: 1,
      preset: 'full',
      slots: ['players', 'hackerModule', 'avgStack', null, 'nextBreak'],
    });
    expect(c.slots).toEqual(['players', null, 'avgStack', null, 'nextBreak']);
  });

  it('중복 id 는 첫 항목만 렌더(뒤는 null)', () => {
    const c = parseMonitorConfig({
      v: 1,
      preset: 'full',
      slots: ['players', 'players', 'players', 'entries', 'players'],
    });
    expect(c.slots).toEqual(['players', null, null, 'entries', null]);
  });

  it('slots 길이 정규화 — 짧으면 null 패딩, 길면 5개로 절단', () => {
    expect(parseMonitorConfig({ v: 1, preset: 'full', slots: ['players'] }).slots).toEqual([
      'players',
      null,
      null,
      null,
      null,
    ]);
    expect(
      parseMonitorConfig({
        v: 1,
        preset: 'full',
        slots: ['players', 'entries', 'tables', 'avgStack', 'koPool', 'prizePool', 'nextBreak'],
      }).slots
    ).toHaveLength(5);
  });

  it('모듈 카탈로그 v1 = 10종(스펙 §2)', () => {
    expect(MONITOR_MODULE_IDS).toHaveLength(10);
  });
});
