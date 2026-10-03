/**
 * 대회 생성 폼 — 입력 문자열 → CreateOpsTournamentInput. 기본값·변환 규칙은 모바일
 * `app/(ops)/tournaments/new.tsx` 와 같다(검증 자체는 서비스의 동기화 사본 zod 스키마가 한다).
 */
import type { CreateOpsTournamentInput } from '@/core/repositories/interfaces/IOpsTournamentRepository';
import type { OpsTournament } from '@/core/types/ops';

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

/**
 * 지난 대회 설정 불러오기 — 장소·게임·칩·좌석·금액을 채운다.
 * 이름·날짜·공고 연결은 이번 대회의 것이라 건드리지 않는다. 블라인드 구조는 폼에 없어 가져오지 않는다(복제가 맡는다).
 */
export function prefillFromTournament(
  form: CreateFormState,
  source: OpsTournament
): CreateFormState {
  return {
    ...form,
    // 장소가 없는 대회를 불러와도 이미 적은 장소는 지우지 않는다.
    venue: source.venue ?? form.venue,
    gameType: source.gameType,
    startingChips: String(source.startingChips),
    seatsPerTable: String(source.seatsPerTable),
    buyInChips: String(source.buyInChips),
    buyInCost: String(source.buyInCost),
    feeCost: String(source.feeCost),
    rebuyChips: String(source.rebuyChips),
    rebuyCost: String(source.rebuyCost),
    addonChips: String(source.addonChips),
    addonCost: String(source.addonCost),
    bountyCost: source.bountyCost == null ? '' : String(source.bountyCost),
  };
}

/** 불러오기 후보 — 최근에 만든 대회부터 최대 20개(보관한 대회도 설정은 쓸 수 있다). */
export function prefillSources(tournaments: readonly OpsTournament[]): OpsTournament[] {
  return [...tournaments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);
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
