/**
 * TV 모니터 구성(monitor_config) 파서 — S1 C6 (스펙 결정 T1·T3·전방 호환 §3).
 *
 * 계약: NULL/파싱 불가 = 기본값(full + 기본 5슬롯). 미지 preset → full 폴백.
 * 미지 모듈 id → 해당 슬롯 숨김(null). 중복 id → 첫 항목만. slots 는 항상 길이 5 로 정규화.
 * 서버(ops_set_monitor_config)가 화이트리스트 재조립 저장하지만, 렌더러는 구버전/전방
 * 호환을 위해 여기서 다시 관용 파싱한다.
 */

export const MONITOR_PRESETS = ['full', 'mirror', 'classic'] as const;
export type MonitorPreset = (typeof MONITOR_PRESETS)[number];

export const MONITOR_MODULE_IDS = [
  'players',
  'totalChips',
  'avgStack',
  'regStatus',
  'nextBreak',
  'nextBlinds',
  'entries',
  'tables',
  'prizePool',
  'koPool',
] as const;
export type MonitorModuleId = (typeof MONITOR_MODULE_IDS)[number];

export const MONITOR_SLOT_COUNT = 5;

export type MonitorSlots = (MonitorModuleId | null)[];

export interface ResolvedMonitorConfig {
  preset: MonitorPreset;
  slots: MonitorSlots;
}

/** 기본 5슬롯(T3) — nextBlinds 는 중앙 타이머 하단 상시 표시라 기본 제외. */
export const DEFAULT_MONITOR_SLOTS: readonly MonitorModuleId[] = [
  'players',
  'totalChips',
  'avgStack',
  'regStatus',
  'nextBreak',
] as const;

function isMonitorPreset(value: unknown): value is MonitorPreset {
  return typeof value === 'string' && (MONITOR_PRESETS as readonly string[]).includes(value);
}

function isMonitorModuleId(value: unknown): value is MonitorModuleId {
  return typeof value === 'string' && (MONITOR_MODULE_IDS as readonly string[]).includes(value);
}

export function parseMonitorConfig(raw: unknown): ResolvedMonitorConfig {
  if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
    return { preset: 'full', slots: [...DEFAULT_MONITOR_SLOTS] };
  }
  const obj = raw as Record<string, unknown>;
  // v 는 스키마 파괴적 개정 신호 — 미지 버전은 통째로 기본값 폴백(오독 방지)
  if (obj.v !== 1) {
    return { preset: 'full', slots: [...DEFAULT_MONITOR_SLOTS] };
  }
  const preset: MonitorPreset = isMonitorPreset(obj.preset) ? obj.preset : 'full';

  const rawSlots: unknown[] = Array.isArray(obj.slots) ? obj.slots : [...DEFAULT_MONITOR_SLOTS];
  const seen = new Set<MonitorModuleId>();
  const slots: MonitorSlots = [];
  for (let i = 0; i < MONITOR_SLOT_COUNT; i++) {
    const candidate = rawSlots[i];
    if (isMonitorModuleId(candidate) && !seen.has(candidate)) {
      seen.add(candidate);
      slots.push(candidate);
    } else {
      slots.push(null); // 미지 id 무시(숨김) · 중복은 첫 항목만 · 부족분은 빈 슬롯
    }
  }
  return { preset, slots };
}
