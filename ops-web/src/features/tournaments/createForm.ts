/**
 * 대회 생성 폼 — 입력 문자열 → CreateOpsTournamentInput. 기본값·변환 규칙은 모바일
 * `app/(ops)/tournaments/new.tsx` 와 같다(검증 자체는 서비스의 동기화 사본 zod 스키마가 한다).
 */
import type { CreateOpsTournamentInput } from '@/core/repositories/interfaces/IOpsTournamentRepository';

export interface CreateFormState {
  name: string;
  venue: string;
  gameType: string;
  eventDate: string; // YYYY-MM-DD (input[type=date]) 또는 ''
  startingChips: string;
  seatsPerTable: string;
  buyInChips: string;
  buyInCost: string;
  feeCost: string;
  rebuyChips: string;
  rebuyCost: string;
  addonChips: string;
  addonCost: string;
  bountyCost: string; // 빈칸 = 비-바운티(null)
  jobPostingId: string | null;
}

export function initialCreateForm(
  today: string,
  jobPostingId: string | null = null
): CreateFormState {
  return {
    name: '',
    venue: '',
    gameType: 'NLH',
    eventDate: today,
    startingChips: '30000',
    seatsPerTable: '9',
    buyInChips: '30000',
    buyInCost: '50000',
    feeCost: '5000',
    rebuyChips: '30000',
    rebuyCost: '50000',
    addonChips: '20000',
    addonCost: '30000',
    bountyCost: '',
    jobPostingId,
  };
}

/** 숫자만 남긴다(쉼표·단위 허용). 빈칸이면 0. */
export const toInt = (v: string): number => {
  const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};

/** 빈칸이면 null(바운티 없음). */
export const toIntOrNull = (v: string): number | null => {
  const digits = v.replace(/[^0-9]/g, '');
  return digits === '' ? null : parseInt(digits, 10);
};

export function toCreateInput(f: CreateFormState): CreateOpsTournamentInput {
  return {
    name: f.name.trim(),
    venue: f.venue.trim() || undefined,
    eventDate: f.eventDate || undefined,
    gameType: f.gameType.trim() || 'NLH',
    jobPostingId: f.jobPostingId ?? undefined,
    startingChips: toInt(f.startingChips),
    seatsPerTable: toInt(f.seatsPerTable) || 9,
    config: {
      buyInChips: toInt(f.buyInChips),
      rebuyChips: toInt(f.rebuyChips),
      addonChips: toInt(f.addonChips),
      buyInCost: toInt(f.buyInCost),
      feeCost: toInt(f.feeCost),
      rebuyCost: toInt(f.rebuyCost),
      addonCost: toInt(f.addonCost),
      bountyCost: toIntOrNull(f.bountyCost),
    },
  };
}
