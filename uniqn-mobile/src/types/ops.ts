/**
 * 라이브 운영(ops) 도메인 타입 — 슬라이스 1a.
 * enum 은 생성된 Supabase Constants 를 단일출처(SSOT)로 파생 (인라인 하드코딩 금지).
 * 앱은 camelCase, DB 는 snake_case (Repository 가 매핑).
 */
import { Constants } from '@/types/supabase';

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
  nextEntrySeq: number;
  createdAt: string;
  updatedAt: string;
}

/** 참가자(엔트리). claim_token 은 1a 에서 클라이언트로 읽지 않음(D8) → 타입에 없음. */
export interface OpsParticipant {
  id: string;
  tournamentId: string;
  entryNumber: number;
  name: string;
  nationality?: string | null;
  phone?: string | null;
  playerUserId?: string | null;
  status: OpsParticipantStatus;
  chips: number;
  buyInAmount?: number | null;
  rebuys: number;
  addOns: number;
  reentries: number;
  finishPosition?: number | null;
  bustedAt?: string | null;
  prizeAmount?: number | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
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
