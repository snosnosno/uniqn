/**
 * 라이브 운영(ops) 도메인 타입 — 슬라이스 1a.
 * enum 은 생성된 Supabase Constants 를 단일출처(SSOT)로 파생 (인라인 하드코딩 금지).
 * 앱은 camelCase, DB 는 snake_case (Repository 가 매핑).
 */
import { Constants } from '@/types/supabase';
import type { StaffRole } from '@/types/role';

export type OpsTournamentStatus = (typeof Constants.public.Enums.ops_tournament_status)[number];
export type OpsParticipantStatus = (typeof Constants.public.Enums.ops_participant_status)[number];
export type OpsEventType = (typeof Constants.public.Enums.ops_event_type)[number];

/** 대회(라이브 운영) */
export interface OpsTournament {
  id: string;
  ownerId: string;
  jobPostingId?: string | null;
  name: string;
  venue?: string | null;
  eventDate?: string | null;
  gameType: string;
  status: OpsTournamentStatus;
  seatsPerTable: number;
  startingChips: number;
  color?: string | null;
  buyInChips: number;
  rebuyChips: number;
  addonChips: number;
  buyInCost: number;
  feeCost: number;
  rebuyCost: number;
  addonCost: number;
  bountyCost?: number | null;
  registrationOpen: boolean;
  autoSeatOnRegister: boolean;
  reentryAllowed: boolean;
  maxReentries?: number | null;
  monitorToken?: string | null;
  /** TV 모니터 구성(S1 C6) jsonb. NULL=기본. 소비는 parseMonitorConfig 경유. */
  monitorConfig?: unknown;
  nextEntrySeq: number;
  createdAt: string;
  updatedAt: string;
}

/** 참가자(엔트리). view_token 포함(D8 운영자 읽기). claim_pin_hash 는 절대 미포함. */
export interface OpsParticipant {
  id: string;
  tournamentId: string;
  entryNumber: number;
  name: string;
  nationality?: string | null;
  phone?: string | null;
  playerUserId?: string | null;
  /** 읽기 능력 토큰(운영자 read·D8). 미발급 시 null. */
  viewToken: string | null;
  status: OpsParticipantStatus;
  chips: number;
  buyInAmount?: number | null;
  rebuys: number;
  addOns: number;
  reentries: number;
  knockouts: number;
  finishPosition?: number | null;
  bustedAt?: string | null;
  prizeAmount?: number | null;
  /** 상금 지급 완료 시각(S1 C4). null=미지급. 쓰기는 ops_set_prize_paid 전용. */
  prizePaidAt?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 순위별 고정 상금(1d). */
export interface OpsPrize {
  id: string;
  tournamentId: string;
  rank: number;
  amount: number;
}

/** bust RPC 반환(camelCase 매핑됨). */
export interface OpsBustResult {
  finishPosition: number;
  prizeAmount: number | null;
  winnerFinalized: boolean;
  winner: { participantId: string; finishPosition: number; prizeAmount: number | null } | null;
}

/** 1f: 탈락 취소 결과(bust 직전 상태 복원 — reentries 불변·칩 복원). */
export interface OpsUndoBustResult {
  participantId: string;
  restoredChips: number;
  status: OpsParticipant['status'];
  seated: boolean;
  tableNo: number | null;
  seatNo: number | null;
}

/** 1f: 상금 정정/회수 결과. */
export interface OpsPrizeCorrectionResult {
  participantId: string;
  amountBefore: number | null;
  amountAfter: number | null;
}

/** reenter RPC 반환. */
export interface OpsReenterResult {
  participantId: string;
  reentries: number;
  status: OpsParticipantStatus;
  seated: boolean;
}

/** 감사 이벤트 로그 (append-only) */
export interface OpsEvent {
  id: string;
  tournamentId: string;
  type: OpsEventType;
  actorId?: string | null;
  actorDevice?: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export type OpsTableStatus = (typeof Constants.public.Enums.ops_table_status)[number];
export type OpsTableLockType = (typeof Constants.public.Enums.ops_table_lock_type)[number];

/** 라이브 운영 테이블 */
export interface OpsTable {
  id: string;
  tournamentId: string;
  tableNo: number;
  name?: string | null;
  status: OpsTableStatus;
  assignedStaffId?: string | null;
  lockType: OpsTableLockType;
  priority?: number | null;
  position?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

/** 좌석(단일 점유원) */
export interface OpsSeat {
  id: string;
  tournamentId: string;
  tableId: string;
  tableNo: number;
  seatNo: number;
  participantId?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** ops_staff.source — 로스터 편입 경로(1e). */
export type OpsStaffSource = 'snapshot_import' | 'manual';

/**
 * 대회 스태프 로스터(1e) — 확정 스태프 스냅샷(import) 또는 수동 추가(manual).
 * source_work_log_id 는 snapshot_import 출처에서만 채워짐(work_logs 는 SSOT·읽기전용, 여기엔 스냅샷만 보관).
 */
export interface OpsStaff {
  id: string;
  tournamentId: string;
  staffId: string;
  role: StaffRole;
  customRole: string | null;
  staffName: string;
  staffNickname: string | null;
  source: OpsStaffSource;
  sourceWorkLogId: string | null;
  createdAt: string;
}

/** STATUS 부분통계 (1a — 참가자 파생만, 클라이언트 계산). 좌석/블라인드 의존 값은 1b/1c. */
export interface OpsPartialStats {
  playing: number;
  entries: number;
  totalChips: number;
  averageStack: number;
  prizePool: number;
}

/** 블라인드 레벨(1c). sort 1..N 연속(ops_set_blind_levels 전체교체가 보장). */
export interface OpsBlindLevel {
  id: string;
  tournamentId: string;
  level: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  durationSec: number;
  isBreak: boolean;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

/** 서버 동기 클럭(대회당 1행, 1c). 남은시간은 서버 앵커(levelStartedAt) 파생. */
export interface OpsClock {
  tournamentId: string;
  currentLevelSort: number;
  /** 현재 레벨 시작 서버 시각(ISO). 일시정지/미시작이면 null */
  levelStartedAt: string | null;
  isRunning: boolean;
  /** 일시정지 시 남은 초 스냅샷 */
  pausedRemainingSec: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 파생 라이브 통계(대회당 1행, 1c — 트리거 재계산).
 * DB 의 bigint 컬럼(totalChips/averageStack/prizePool)·numeric(avgStackBb)은 앱에서 number 취급.
 */
export interface OpsLiveStats {
  tournamentId: string;
  playing: number;
  entries: number;
  uniquePlayers: number;
  reentriesTotal: number;
  tablesOpen: number;
  seatsTotal: number;
  seatsFree: number;
  totalChips: number;
  averageStack: number;
  avgStackBb: number;
  prizePool: number;
  knockoutPool: number | null;
  updatedAt: string;
}

/** 공개뷰 신고 사유 택소노미(S1 B2/D7) — 서버 CHECK 와 1:1. */
export type OpsReportReason = 'gambling' | 'illegal_gambling' | 'other';

export const OPS_REPORT_REASON_LABELS: Record<OpsReportReason, string> = {
  gambling: '사행성 우려',
  illegal_gambling: '불법 도박',
  other: '기타',
};

/**
 * 다음 브레이크 정보(S1 C1) — 현재 레벨 시작 앵커(levelStartedAt) 기준 브레이크 시작까지 누적 초.
 * 카운트다운 = secondsFromLevelStart − 현재 레벨 경과(클럭과 동일 앵커·offset — 표면별 드리프트 0).
 */
export interface OpsNextBreak {
  level: number;
  sort: number;
  secondsFromLevelStart: number;
}

/** 프라이즈 패널 payout 행(S1 C6/T4 — 상위 5). */
export interface OpsPayoutEntry {
  position: number;
  amount: number;
}

/** 모니터 스냅샷 블라인드 레벨(공개 RPC 부분집합 — 비-PII). */
export interface OpsMonitorLevel {
  level: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  durationSec: number;
  isBreak: boolean;
}

/**
 * 공개 모니터(전광판) 스냅샷 (1c-3) — `ops_get_monitor_snapshot(p_monitor_token)` anon RPC 반환.
 * **비-PII 화이트리스트 투영**: 참가자 PII·view_token·monitor_token·owner 미포함(집계만).
 * RPC 가 camelCase 키로 직접 반환(toCamelCase shallow 회피) → 그대로 소비.
 */
export interface OpsMonitorSnapshot {
  tournament: {
    name: string;
    venue: string | null;
    eventDate: string | null;
    gameType: string;
    status: string;
    color: string | null;
    registrationOpen: boolean;
  };
  clock: {
    currentLevelSort: number;
    levelStartedAt: string | null;
    isRunning: boolean;
    pausedRemainingSec: number | null;
  };
  currentLevel: OpsMonitorLevel | null;
  nextLevel: OpsMonitorLevel | null;
  stats: {
    playing: number;
    entries: number;
    reentriesTotal: number;
    tablesOpen: number;
    seatsTotal: number;
    seatsFree: number;
    totalChips: number;
    averageStack: number;
    avgStackBb: number;
    prizePool: number;
    knockoutPool: number | null;
  };
  /** 다음 브레이크(S1 C1). 남은 브레이크 없으면 null. */
  nextBreak: OpsNextBreak | null;
  /** 상위 5 payout(S1 C6). 상금 구조 없으면 빈 배열(프라이즈 패널 자동 숨김). */
  payouts: OpsPayoutEntry[];
  /**
   * TV 모니터 구성(S1 C6) — 서버가 화이트리스트로 재조립 저장한 jsonb 원본.
   * 소비는 반드시 parseMonitorConfig 경유(미지 preset→full 폴백·미지 id 무시·중복 첫 항목만).
   */
  monitorConfig: unknown;
  /** 서버 시각(ISO) — 클라 offset 보정용(기기 시계 오차 보정). */
  serverNow: string;
}

/** 운영자 발급 결과(평문 PIN은 1회만 노출 — 슬립용). */
export interface OpsPlayerCredentials {
  participantId: string;
  viewToken: string;
  claimPin: string;
}

/**
 * 공개 플레이어뷰 (1c-4) — `ops_get_player_view(p_view_token)` anon RPC 반환.
 * **본인 안전필드만**: 타 참가자·phone·nationality·view_token·claim_pin_hash·player_user_id 미포함.
 * RPC 가 camelCase 키로 직접 반환 → 그대로 소비.
 */
export interface OpsPlayerView {
  me: {
    entryNumber: number;
    name: string;
    status: string;
    chips: number;
    finishPosition: number | null;
    prizeAmount: number | null;
    bountyAccrued: number | null;
    rebuys: number;
    addOns: number;
    reentries: number;
    knockouts: number;
    /** 본인 좌석(미착석이면 null). */
    tableNo: number | null;
    seatNo: number | null;
  };
  tournament: {
    name: string;
    venue: string | null;
    gameType: string;
    status: string;
  };
  clock: {
    currentLevelSort: number;
    levelStartedAt: string | null;
    isRunning: boolean;
    pausedRemainingSec: number | null;
  };
  currentLevel: OpsMonitorLevel | null;
  stats: {
    playing: number;
    entries: number;
    averageStack: number;
    avgStackBb: number;
  };
  /** 다음 브레이크(S1 C1) — 모니터 스냅샷과 동일 산식(드리프트 0). */
  nextBreak: OpsNextBreak | null;
  serverNow: string;
}
