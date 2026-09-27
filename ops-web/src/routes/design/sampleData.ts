import type { ClockStripData } from '@/components/ops/ClockStrip';

/** 견본 페이지 전용 가짜 데이터 — 실제 화면은 W3~ 에서 RPC 로 채운다. */
export const SAMPLE_CLOCK: ClockStripData = {
  level: 12,
  smallBlind: 1500,
  bigBlind: 3000,
  ante: 3000,
  remaining: '14:32',
  playersLeft: 47,
  playersTotal: 120,
  averageStack: 76596,
  prizePool: 36000000,
  connected: true,
};

export type SampleStatus = 'live' | 'wait' | 'bust';

export interface SamplePlayer {
  entry: string;
  name: string;
  seat: string;
  chips: number;
  entries: number;
  status: SampleStatus;
  note?: string;
}

export const SAMPLE_PLAYERS: readonly SamplePlayer[] = [
  { entry: '018', name: '박서준', seat: 'T2 · 5', chips: 142300, entries: 1, status: 'live' },
  {
    entry: '044',
    name: '이하은',
    seat: 'T4 · 1',
    chips: 98750,
    entries: 2,
    status: 'live',
    note: '리바이',
  },
  { entry: '061', name: '김민수', seat: 'T7 · 3', chips: 12400, entries: 1, status: 'live' },
  { entry: '072', name: '최유진', seat: 'T1 · 8', chips: 88100, entries: 1, status: 'live' },
  { entry: '083', name: '정도윤', seat: 'T3 · 2', chips: 61020, entries: 3, status: 'live' },
  { entry: '091', name: '한지민', seat: 'T5 · 6', chips: 203500, entries: 1, status: 'live' },
  { entry: '104', name: '오세훈', seat: '—', chips: 30000, entries: 1, status: 'wait' },
  { entry: '012', name: '윤가람', seat: '—', chips: 0, entries: 2, status: 'bust', note: '72위' },
];

export const TOKEN_SWATCHES = [
  ['background', '바탕'],
  ['card', '패널'],
  ['foreground', '본문'],
  ['muted-foreground', '보조'],
  ['border', '괘선'],
  ['primary', '라임 · 실행'],
  ['prize', '골드 · 상금만'],
  ['destructive', '위험'],
  ['success', '진행'],
  ['warning', '대기'],
] as const;
