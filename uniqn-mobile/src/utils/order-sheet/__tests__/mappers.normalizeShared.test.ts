/**
 * 매퍼 ↔ 정규화 단일 구현 계약 + edit 왕복 의미 동등 게이트 (T1 §9.2 · E5)
 *
 * ① 복원(draftToValues)이 폼 뮤테이션과 **같은** normalizeScheduleGroups 를 소비하는지 —
 *    중복 구현이 되살아나면 "임시저장을 다시 열면 그룹이 달라진다" 회귀가 재발한다.
 * ② 발행 공고를 edit 로 열어 **아무것도 고치지 않고** 저장했을 때 requirements 가 의미상
 *    동등한지 — 강등 신 정규형(§3.1 규칙 2)이 데이터에 미치는 영향의 안전망(§8.8 · Eng F-1).
 */
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';
import type { JobPostingDraft } from '@/types/jobPostingDraft';
import { draftToValues, valuesToDraft } from '../mappers';
import { normalizeScheduleGroups } from '../normalizeScheduleGroups';

// babel-plugin-jest-hoist 가 이 호출을 import 위로 끌어올린다 — import 를 아래로 내리면
// import/first 경고만 생기고 동작 이득은 없다.
jest.mock('../normalizeScheduleGroups', () => {
  const actual = jest.requireActual('../normalizeScheduleGroups');
  return { ...actual, normalizeScheduleGroups: jest.fn(actual.normalizeScheduleGroups) };
});

const normalizeSpy = normalizeScheduleGroups as jest.MockedFunction<typeof normalizeScheduleGroups>;

const baseValues: OrderSheetValues = {
  postingType: 'regular',
  title: '주말 딜러 구합니다',
  location: { name: '라운더스 홀덤펍', address: '서울 강남구', region: 'seoul-gangnam' },
  contactPhone: '010-1234-5678',
  description: '',
  scheduleGroups: [
    {
      dates: ['2026-07-14'],
      timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }],
      grouped: false,
    },
  ],
  salary: { type: 'hourly', amount: 20000 },
  useSameSalary: true,
  roleSalaries: [],
  allowances: {},
  conditions: {},
  usesPreQuestions: false,
  preQuestions: [],
};

const mkReq = (date: string, startTime: string, isGrouped?: boolean) => ({
  date,
  timeSlots: [
    { id: `s-${date}`, startTime, roles: [{ id: `r-${date}`, role: 'dealer' as const, count: 2 }] },
  ],
  ...(isGrouped === true ? { isGrouped: true as const } : {}),
});

const draftWith = (requirements: ReturnType<typeof mkReq>[]): JobPostingDraft => {
  const base = valuesToDraft(baseValues);
  if (base.schedule.kind !== 'dated') throw new Error('unreachable');
  const dates = requirements.map((r) => r.date).sort();
  return {
    ...base,
    schedule: { ...base.schedule, allDates: dates, primaryDate: dates[0]!, requirements },
  };
};

/** 의미 동등 비교용 — 생성 id 를 벗긴 날짜별 조건 지도 */
const conditionByDate = (draft: JobPostingDraft): Record<string, unknown> => {
  if (draft.schedule.kind !== 'dated') throw new Error('unreachable');
  return Object.fromEntries(
    draft.schedule.requirements.map((r) => [
      String(r.date),
      r.timeSlots.map((s) => ({
        startTime: s.startTime,
        isTimeToBeAnnounced: s.isTimeToBeAnnounced === true,
        roles: s.roles.map((role) => ({ role: role.role, count: role.count })),
      })),
    ])
  );
};

const groupedDates = (draft: JobPostingDraft): string[] => {
  if (draft.schedule.kind !== 'dated') throw new Error('unreachable');
  return draft.schedule.requirements
    .filter((r) => r.isGrouped === true)
    .map((r) => String(r.date))
    .sort();
};

describe('복원과 폼이 한 정규화 구현을 공유한다 (중복 구현 회귀 방지)', () => {
  it('draftToValues 가 normalizeScheduleGroups 를 실제로 호출한다', () => {
    draftToValues(draftWith([mkReq('2026-07-20', '19:00')]));
    expect(normalizeSpy).toHaveBeenCalled();
  });

  it('정규화에 넘어가는 입력은 requirement 1건당 그룹 1개(날짜 단위 평탄화)다', () => {
    draftToValues(draftWith([mkReq('2026-07-20', '19:00'), mkReq('2026-07-21', '19:00')]));
    const firstCallArg = normalizeSpy.mock.calls[0]?.[0];
    expect(firstCallArg).toHaveLength(2);
    expect(firstCallArg?.map((g) => g.dates)).toEqual([['2026-07-20'], ['2026-07-21']]);
  });
});

describe('E5 — edit 로드 → 무편집 저장의 requirements 의미 동등 (§8.8 회귀 게이트)', () => {
  it('날짜별 조건(시간·역할)은 왕복에서 그대로 보존된다', () => {
    const original = draftWith([
      mkReq('2026-07-20', '19:00', true),
      mkReq('2026-07-21', '19:00', true),
      mkReq('2026-07-25', '21:00', true), // 레거시 grouped 싱글턴
    ]);
    const resaved = valuesToDraft(draftToValues(original) as unknown as OrderSheetValues);
    expect(conditionByDate(resaved)).toEqual(conditionByDate(original));
  });

  it('묶음이 실제 성립하는 run(연속 2일+·동일 조건)의 isGrouped 는 보존된다', () => {
    const original = draftWith([
      mkReq('2026-07-20', '19:00', true),
      mkReq('2026-07-21', '19:00', true),
      mkReq('2026-07-25', '21:00', true),
    ]);
    const resaved = valuesToDraft(draftToValues(original) as unknown as OrderSheetValues);
    // 7/25 는 단독 run — 강등되어 isGrouped 가 빠진다(지원자 화면 행동 중립).
    expect(groupedDates(original)).toEqual(['2026-07-20', '2026-07-21', '2026-07-25']);
    expect(groupedDates(resaved)).toEqual(['2026-07-20', '2026-07-21']);
  });

  it('정규형 draft 는 edit 왕복의 고정점이다 — 2회차부터 변화 0', () => {
    const original = draftWith([
      mkReq('2026-07-20', '19:00', true),
      mkReq('2026-07-21', '19:00', true),
      mkReq('2026-07-25', '21:00', true),
    ]);
    const once = valuesToDraft(draftToValues(original) as unknown as OrderSheetValues);
    const twice = valuesToDraft(draftToValues(once) as unknown as OrderSheetValues);
    expect(conditionByDate(twice)).toEqual(conditionByDate(once));
    expect(groupedDates(twice)).toEqual(groupedDates(once));
  });

  it('묶음이 없는 평범한 공고는 왕복에서 isGrouped 가 생기지 않는다 (무회귀)', () => {
    const original = draftWith([mkReq('2026-07-20', '19:00'), mkReq('2026-07-21', '19:00')]);
    const resaved = valuesToDraft(draftToValues(original) as unknown as OrderSheetValues);
    expect(groupedDates(resaved)).toEqual([]);
    expect(conditionByDate(resaved)).toEqual(conditionByDate(original));
  });
});
