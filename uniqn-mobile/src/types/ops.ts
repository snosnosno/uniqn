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

/** STATUS 부분통계 (1a — 참가자 파생만, 클라이언트 계산). 좌석/블라인드 의존 값은 1b/1c. */
export interface OpsPartialStats {
  playing: number;
  entries: number;
  totalChips: number;
  averageStack: number;
  prizePool: number;
}
