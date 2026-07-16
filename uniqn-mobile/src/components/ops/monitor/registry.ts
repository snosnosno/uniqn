/**
 * TV 모니터 모듈 레지스트리 (S1 C6 — 스펙 §2·§5).
 * id → { 라벨, 값 셀렉터(포맷 포함), 톤 }. 렌더는 레지스트리 순회만.
 * getValue 가 null 을 반환하면 데이터 없음 → 슬롯 자동 숨김(빈 카드 금지, 아래 모듈 당김).
 * 골드 톤은 상금 금액(prizePool/koPool)만 — 60-30-10 규칙.
 */
import type { OpsMonitorSnapshot } from '@/types/ops';
import type { MonitorModuleId, MonitorSlots, NextBreakDisplay } from '@/domains/ops';
import { formatHms } from '@/domains/ops';
import { formatNumber as fmt } from '@/utils/formatters/currency';

export interface MonitorModuleContext {
  snapshot: OpsMonitorSnapshot;
  nextBreak: NextBreakDisplay;
}

export interface MonitorModuleDef {
  label: string;
  /** 설정 UI(슬롯 피커)용 한글 이름. */
  pickerLabel: string;
  /** null = 데이터 없음 → 슬롯 자동 숨김 */
  getValue: (ctx: MonitorModuleContext) => string | null;
  /** 'gold' = 상금 금액 전용 강조 톤 */
  tone?: 'gold';
}

export const MONITOR_MODULES: Record<MonitorModuleId, MonitorModuleDef> = {
  players: {
    label: 'PLAYERS',
    pickerLabel: '플레이어 수',
    getValue: ({ snapshot }) => `${fmt(snapshot.stats.playing)}/${fmt(snapshot.stats.entries)}`,
  },
  totalChips: {
    label: 'TOTAL CHIPS',
    pickerLabel: '총 칩',
    getValue: ({ snapshot }) => fmt(snapshot.stats.totalChips),
  },
  avgStack: {
    label: 'AVG STACK',
    pickerLabel: '평균 스택',
    getValue: ({ snapshot }) =>
      `${fmt(snapshot.stats.averageStack)} · ${snapshot.stats.avgStackBb.toFixed(1)}BB`,
  },
  regStatus: {
    label: 'REGISTRATION',
    pickerLabel: '등록 상태',
    getValue: ({ snapshot }) =>
      snapshot.tournament.registrationOpen ? '등록 진행 중' : '등록 마감',
  },
  nextBreak: {
    label: 'NEXT BREAK',
    pickerLabel: '다음 브레이크',
    getValue: ({ nextBreak }) => {
      if (nextBreak.kind === 'none') return null; // 브레이크 없는 구조 → 자동 숨김
      if (nextBreak.kind === 'inBreak') return '휴식 진행 중';
      return formatHms(nextBreak.remainingSec);
    },
  },
  nextBlinds: {
    label: 'NEXT BLINDS',
    pickerLabel: '다음 블라인드',
    getValue: ({ snapshot }) => {
      const next = snapshot.nextLevel;
      if (!next) return null;
      if (next.isBreak) return '휴식';
      return `${fmt(next.smallBlind)} / ${fmt(next.bigBlind)}`;
    },
  },
  entries: {
    label: 'ENTRIES',
    pickerLabel: '엔트리·리엔트리',
    getValue: ({ snapshot }) =>
      snapshot.stats.reentriesTotal > 0
        ? `${fmt(snapshot.stats.entries)} · 리엔트리 ${fmt(snapshot.stats.reentriesTotal)}`
        : fmt(snapshot.stats.entries),
  },
  tables: {
    label: 'TABLES',
    pickerLabel: '테이블·빈좌석',
    getValue: ({ snapshot }) =>
      snapshot.stats.tablesOpen > 0
        ? `${fmt(snapshot.stats.tablesOpen)} · 빈좌석 ${fmt(snapshot.stats.seatsFree)}`
        : null, // 테이블 미개설 → 숨김
  },
  prizePool: {
    label: 'PRIZE POOL',
    pickerLabel: '프라이즈 풀',
    getValue: ({ snapshot }) =>
      snapshot.stats.prizePool > 0 ? fmt(snapshot.stats.prizePool) : null,
    tone: 'gold',
  },
  koPool: {
    label: 'KO POOL',
    pickerLabel: 'KO 풀',
    getValue: ({ snapshot }) =>
      snapshot.stats.knockoutPool !== null ? fmt(snapshot.stats.knockoutPool) : null, // 비-바운티 → 숨김
    tone: 'gold',
  },
};

export interface ResolvedSlot {
  id: MonitorModuleId;
  label: string;
  value: string;
  tone?: 'gold';
}

/** 슬롯 5개 → 렌더 가능한 항목만(빈 슬롯·미지 id·데이터 없음 제외, 아래 모듈 당김). */
export function resolveMonitorSlots(
  slots: MonitorSlots,
  ctx: MonitorModuleContext
): ResolvedSlot[] {
  const resolved: ResolvedSlot[] = [];
  for (const id of slots) {
    if (!id) continue;
    const def = MONITOR_MODULES[id];
    if (!def) continue; // 방어: 레지스트리 밖 id (파서가 이미 거르지만 이중 안전)
    const value = def.getValue(ctx);
    if (value === null) continue;
    resolved.push({ id, label: def.label, value, tone: def.tone });
  }
  return resolved;
}
