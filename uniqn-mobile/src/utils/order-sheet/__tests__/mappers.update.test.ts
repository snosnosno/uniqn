/**
 * valuesToUpdateInput(S3) — 주문서 값 → 공고 수정 입력.
 * 신·구 등가성 게이트: 레거시 draftToUpdateJobPostingInput 산출과 타입별 동등(위임 계약 고정).
 * 축소 payload: hasConfirmedApplicants=true면 schedule·conditions 제외(레거시 계약 그대로).
 * 승인 무접촉: 어떤 타입에서도 tournamentConfig own-property를 만들지 않는다(설계 확정 ⑥).
 * 위임 구조(valuesToUpdateInput→draftToUpdateJobPostingInput)에서는 동어반복이며, 위임을 해제(mappers 자체 조립)하는 순간 이 스위트가 실질 등가성 게이트가 된다(S3 최종리뷰 명기).
 */
import { valuesToDraft, valuesToUpdateInput } from '../mappers';
import { draftToUpdateJobPostingInput } from '@/utils/job-posting/draftAdapter';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';
import { singleGroup, stripKnownGeneratedIds } from './orderSheetTestHelpers';

const baseSlots: OrderSheetValues['scheduleGroups'][number]['timeSlots'] = [
  {
    startTime: '19:00',
    roles: [
      { role: 'dealer', count: 2 },
      { role: 'serving', count: 1 },
    ],
  },
];

const datedValues: OrderSheetValues = {
  postingType: 'regular',
  title: '주말 딜러 구합니다',
  location: { name: '라운더스 홀덤펍', address: '서울 강남구', region: 'seoul-gangnam' },
  contactPhone: '010-1234-5678',
  description: '',
  scheduleGroups: singleGroup(['2026-07-20', '2026-07-21'], baseSlots),
  salary: { type: 'hourly', amount: 20000 },
  useSameSalary: true,
  roleSalaries: [],
  allowances: { meal: -1 },
  conditions: { dressCode: '검정셔츠/슬랙스' },
  usesPreQuestions: false,
  preQuestions: [],
};

const tournamentValues: OrderSheetValues = {
  ...datedValues,
  postingType: 'tournament',
  title: 'WSOP 서울 딜러',
  salary: { type: 'daily', amount: 200000 },
};

const fixedValues: OrderSheetValues = {
  ...datedValues,
  postingType: 'fixed',
  title: '상시 딜러 모집',
  scheduleGroups: [],
  fixedSchedule: {
    daysPerWeek: 5,
    startTime: '19:00',
    isStartTimeNegotiable: false,
    roles: [{ role: 'dealer', count: 2 }],
  },
};

describe('valuesToUpdateInput — 신·구 등가성(타입별)', () => {
  it.each([
    ['regular(dated)', datedValues],
    ['tournament', tournamentValues],
    ['fixed', fixedValues],
  ])('%s: 레거시 draftToUpdateJobPostingInput 산출과 동등하다', (_label, values) => {
    const legacy = draftToUpdateJobPostingInput(valuesToDraft(values));
    expect(stripKnownGeneratedIds(valuesToUpdateInput(values))).toEqual(
      stripKnownGeneratedIds(legacy)
    );
  });

  it('tournament: postingType이 보존된다(silent-coercion 재발 금지)', () => {
    expect(valuesToUpdateInput(tournamentValues).postingType).toBe('tournament');
  });

  it('fixed: schedule.kind=fixed + date:null synthetic requirement를 낸다(SP1 불변식)', () => {
    const input = valuesToUpdateInput(fixedValues);
    expect(input.schedule?.kind).toBe('fixed');
    if (input.schedule?.kind !== 'fixed') throw new Error('kind');
    expect(input.schedule.requirements).toHaveLength(1);
    expect(input.schedule.requirements[0]?.date).toBeNull();
  });
});

describe('valuesToUpdateInput — 확정 지원자 축소 payload(레거시 계약 계승)', () => {
  it('hasConfirmedApplicants=true면 schedule만 제외하고 conditions는 유지한다', () => {
    const input = valuesToUpdateInput(datedValues, { hasConfirmedApplicants: true });
    // 서버 가드(JobPostingRepository:531)는 schedule·roleCatalog identity 변경만 차단한다.
    expect('schedule' in input).toBe(false);
    // conditions 변경은 확정 지원자와 무관하게 허용 — 축소 payload가 생략하면 UI가 조건 행을
    // 잠그지 않아 편집이 조용히 소실된다(S3 리뷰 I-1). 값까지 검증.
    expect(input.conditions).toEqual({ dressCode: '검정셔츠/슬랙스' });
    // 나머지 편집 가능 필드는 유지(급여·질문·카탈로그 — 서버 identity 가드와 대칭)
    expect(input.compensation).toBeDefined();
    expect(input.roleCatalog).toBeDefined();
    expect(input.title).toBe('주말 딜러 구합니다');
  });

  it('기본(false)이면 schedule을 포함한다', () => {
    const input = valuesToUpdateInput(datedValues);
    expect(input.schedule?.kind).toBe('dated');
  });
});

describe('valuesToUpdateInput — 조건 전량 해제 명시 전달(S3 리뷰 I-2)', () => {
  it('conditions:{} values면 input.conditions가 빈 {}로 명시 전달된다(생략=현행유지 침묵부활 차단)', () => {
    const cleared: OrderSheetValues = { ...datedValues, conditions: {} };
    // update는 patch 시맨틱(키 생략=현행 유지)이라, 전량 해제가 키 부재로 표현되면 merge base의
    // 기존 conditions가 살아남아 해제가 조용히 부활한다. update 경로는 빈 {}를 항상 명시 전달해야 한다.
    expect(valuesToUpdateInput(cleared).conditions).toEqual({});
  });

  it('확정 지원자 축소 payload에서도 conditions:{} 해제가 명시 전달된다', () => {
    const cleared: OrderSheetValues = { ...datedValues, conditions: {} };
    expect(valuesToUpdateInput(cleared, { hasConfirmedApplicants: true }).conditions).toEqual({});
  });
});

describe('valuesToUpdateInput — 대회 승인 무접촉(설계 확정 ⑥)', () => {
  it.each([
    ['regular', datedValues],
    ['tournament', tournamentValues],
    ['fixed', fixedValues],
  ])('%s: tournamentConfig own-property를 만들지 않는다', (_label, values) => {
    expect('tournamentConfig' in valuesToUpdateInput(values)).toBe(false);
    expect(
      'tournamentConfig' in valuesToUpdateInput(values, { hasConfirmedApplicants: true })
    ).toBe(false);
  });
});
