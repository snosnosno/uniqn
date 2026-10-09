/**
 * 레이트 등록 자동 마감 — 표시용 파생(순수). 마감 자체는 서버가 한다(레벨이 넘어가는 순간).
 * 기준은 블라인드 구조의 순번(sort)이라 레벨과 브레이크를 모두 고를 수 있다.
 * 웹 콘솔과 모바일 콘솔이 같은 문구·같은 선택지를 쓰도록 정본에 둔다(ops-web 은 사본).
 */
import type { OpsBlindLevel } from '@/types/ops';

type LevelLike = Pick<OpsBlindLevel, 'sort' | 'level' | 'isBreak'>;

/** "레벨 3" · "레벨 3 뒤 휴식" — 휴식은 번호가 없어 바로 앞 레벨로 가리킨다. */
export function cutoffLevelName(levels: readonly LevelLike[], sort: number): string | null {
  const target = levels.find((l) => l.sort === sort);
  if (!target) return null;
  if (!target.isBreak) return `레벨 ${target.level}`;
  const before = [...levels]
    .filter((l) => l.sort < sort && !l.isBreak)
    .sort((a, b) => b.sort - a.sort)[0];
  return before ? `레벨 ${before.level} 뒤 휴식` : '휴식';
}

export interface CutoffOption {
  sort: number;
  label: string;
}

/**
 * 고를 수 있는 기준 — 지금 레벨부터(이미 지난 레벨은 서버가 거부한다).
 * 마지막 순번은 뺀다: 그 뒤로 넘어갈 레벨이 없어 영영 발동하지 않는다.
 */
export function cutoffOptions(levels: readonly LevelLike[], currentSort: number): CutoffOption[] {
  const last = Math.max(0, ...levels.map((l) => l.sort));
  return [...levels]
    .filter((l) => l.sort >= currentSort && l.sort < last)
    .sort((a, b) => a.sort - b.sort)
    .map((l) => ({ sort: l.sort, label: `${cutoffLevelName(levels, l.sort)} 종료 시` }));
}

export type CutoffState =
  | { kind: 'none' }
  /** 설정돼 있고 아직 발동 전 */
  | { kind: 'scheduled'; label: string }
  /** 기준을 넘어 서버가 닫았다 */
  | { kind: 'closed'; label: string }
  /** 기준 순번이 구조에서 사라졌다(서버가 곧 지우지만 그 사이의 화면) */
  | { kind: 'orphan' };

export function cutoffState(input: {
  levels: readonly LevelLike[];
  cutoffSort: number | null | undefined;
  currentSort: number;
  registrationOpen: boolean;
}): CutoffState {
  const { levels, cutoffSort, currentSort, registrationOpen } = input;
  if (cutoffSort === null || cutoffSort === undefined) return { kind: 'none' };
  const name = cutoffLevelName(levels, cutoffSort);
  if (!name) return { kind: 'orphan' };
  if (!registrationOpen && currentSort > cutoffSort) return { kind: 'closed', label: name };
  return { kind: 'scheduled', label: name };
}
