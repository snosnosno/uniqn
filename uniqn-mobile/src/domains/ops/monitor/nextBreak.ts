/**
 * 다음 브레이크 카운트다운 계산 (순수, S1 C1).
 *
 * 3표면(운영 STATUS·플레이어뷰·TV 모니터) 동일 데이터 소스 계약(§12.4-4):
 * - 공개 2표면: RPC 가 반환한 nextBreak.secondsFromLevelStart(현재 레벨 시작 앵커 기준 누적 초)
 * - 운영자 표면: 전체 블라인드 레벨 보유 → findNextBreakFromLevels 로 같은 값을 클라 계산
 * 카운트다운 = secondsFromLevelStart − 현재 레벨 경과. 경과는 computeClockRemaining 과
 * 동일한 앵커(levelStartedAt)·serverOffsetMs 를 사용 — 클럭과 드리프트 0.
 */
import type { OpsNextBreak } from '@/types/ops';

export type NextBreakDisplay =
  | { kind: 'inBreak' } // 현재 레벨이 휴식 — 잔여는 메인 클럭이 표시
  | { kind: 'until'; remainingSec: number } // 다음 휴식 시작까지 남은 초
  | { kind: 'none' }; // 남은 휴식 없음 → 모듈 자동 숨김

export type NextBreakComputeInput = {
  nextBreak: OpsNextBreak | null;
  currentLevelIsBreak: boolean;
  /** 현재 레벨 길이(초). 레벨 미존재면 null */
  currentLevelDurationSec: number | null;
  levelStartedAt: string | null;
  isRunning: boolean;
  pausedRemainingSec: number | null;
  serverOffsetMs: number;
  nowMs: number;
};

export function computeNextBreakRemaining(input: NextBreakComputeInput): NextBreakDisplay {
  if (input.currentLevelIsBreak) return { kind: 'inBreak' };
  const nb = input.nextBreak;
  if (!nb) return { kind: 'none' };

  // 현재 레벨 경과 초 — 클럭과 동일 앵커/보정
  let elapsedSec = 0;
  const dur = input.currentLevelDurationSec;
  if (dur !== null) {
    if (!input.isRunning) {
      // 일시정지/미시작: 저장된 잔여로부터 역산(잔여 없으면 경과 0)
      elapsedSec = dur - (input.pausedRemainingSec ?? dur);
    } else if (input.levelStartedAt !== null) {
      elapsedSec = (input.nowMs + input.serverOffsetMs - Date.parse(input.levelStartedAt)) / 1000;
    }
  }

  const raw = nb.secondsFromLevelStart - elapsedSec;
  return { kind: 'until', remainingSec: Math.max(0, Math.ceil(raw)) };
}

type BlindLevelLike = {
  sort: number;
  level: number;
  isBreak: boolean;
  durationSec: number;
};

/**
 * 운영자 표면용 — 전체 레벨 배열에서 서버 RPC 와 동일한 nextBreak 값을 계산.
 * (서버 산식: sort >= current AND sort < break 의 duration 합)
 */
export function findNextBreakFromLevels(
  levels: readonly BlindLevelLike[],
  currentLevelSort: number | null
): OpsNextBreak | null {
  if (currentLevelSort === null) return null;
  const sorted = [...levels].sort((a, b) => a.sort - b.sort);
  const brk = sorted.find((l) => l.isBreak && l.sort > currentLevelSort);
  if (!brk) return null;
  const secondsFromLevelStart = sorted
    .filter((l) => l.sort >= currentLevelSort && l.sort < brk.sort)
    .reduce((acc, l) => acc + l.durationSec, 0);
  return { level: brk.level, sort: brk.sort, secondsFromLevelStart };
}

/** HH:MM:SS 포맷(항상 시 단위 포함 — 전광판 관례 "00:42:10"). */
export function formatHms(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
