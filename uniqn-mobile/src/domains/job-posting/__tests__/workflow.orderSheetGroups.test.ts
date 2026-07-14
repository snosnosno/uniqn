/**
 * 주문서 일정 그룹 → 지원자 화면 분기 스모크 (설계 2차 Eng-C1/F6 가드)
 *
 * isGrouped=묶음지원 축: 주문서 세그먼트 ②(연속 날짜 묶음 지원)로 만든 공고만
 * usesGroupedDateRanges=true(AssignmentSelector 묶음지원 UI — 연속 범위 일괄 지원)가 되고,
 * ①(같은 조건)/③(날짜마다 따로)은 false(날짜별 지원 UI — 현행 동등)여야 한다.
 * 이 축이 뒤집히면 다중 날짜 공고의 지원 UX가 통째로 바뀌는 CRITICAL 회귀다.
 */
import { selectPostingWorkflow } from '@/domains/job-posting/selectors';
import { valuesToDraft } from '@/utils/order-sheet/mappers';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';
import type { JobPosting } from '@/types';

const base: Omit<OrderSheetValues, 'scheduleGroups'> = {
  postingType: 'regular',
  title: '분기 스모크',
  location: { name: '강남 홀덤펍' },
  contactPhone: '010-1234-5678',
  description: '',
  salary: { type: 'hourly', amount: 20000 },
  useSameSalary: true,
  roleSalaries: [],
  allowances: {},
  conditions: {},
  usesPreQuestions: false,
  preQuestions: [],
};

const slots = [{ startTime: '19:00', roles: [{ role: 'dealer' as const, count: 1 }] }];

const workflowOf = (scheduleGroups: OrderSheetValues['scheduleGroups']) => {
  const draft = valuesToDraft({ ...base, scheduleGroups });
  // selectPostingWorkflow는 schedule·postingType만 소비 — 주문서 산출 requirements를 그대로 태운다
  return selectPostingWorkflow({
    postingType: draft.postingType,
    schedule: draft.schedule,
  } as JobPosting);
};

describe('주문서 그룹 → usesGroupedDateRanges 분기', () => {
  it('① 같은 조건(단일 그룹 다중날짜, grouped=false) → 날짜별 지원(false)', () => {
    const wf = workflowOf([
      { dates: ['2026-07-20', '2026-07-21'], timeSlots: slots, grouped: false },
    ]);
    expect(wf.usesGroupedDateRanges).toBe(false);
  });

  it('③ 날짜마다 따로(개별 그룹, grouped=false) → 날짜별 지원(false)', () => {
    const wf = workflowOf([
      { dates: ['2026-07-20'], timeSlots: slots, grouped: false },
      { dates: ['2026-07-22'], timeSlots: slots, grouped: false },
    ]);
    expect(wf.usesGroupedDateRanges).toBe(false);
  });

  it('② 연속 날짜 묶음 지원(grouped=true) → 묶음지원(true)', () => {
    const wf = workflowOf([
      { dates: ['2026-07-20', '2026-07-21'], timeSlots: slots, grouped: true },
    ]);
    expect(wf.usesGroupedDateRanges).toBe(true);
  });

  it('혼합(② 그룹 + ③ 그룹) → 묶음지원 UI(true) — grouped 그룹이 하나라도 있으면 범위 분기', () => {
    const wf = workflowOf([
      { dates: ['2026-07-20', '2026-07-21'], timeSlots: slots, grouped: true },
      {
        dates: ['2026-07-25'],
        timeSlots: [{ startTime: '21:00', roles: [{ role: 'floor' as const, count: 1 }] }],
        grouped: false,
      },
    ]);
    expect(wf.usesGroupedDateRanges).toBe(true);
  });
});
