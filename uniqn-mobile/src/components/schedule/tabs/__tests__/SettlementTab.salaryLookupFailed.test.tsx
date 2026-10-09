/**
 * SettlementTab — 단가를 **못 읽은 것**과 **안 정해진 것**을 구별한다 (#475 리뷰 잔여)
 *
 * 근무표 직접배치 근무는 단가를 SECDEF RPC(get_my_venue_role_salaries)로 따로 읽는다. 그 호출이
 * 실패하면 단가표가 비어 "급여 근거 없음"이 되는데, 종전에는 그것을 '급여가 아직 정해지지 않았어요'로
 * 표시했다 — 구인자는 급여를 정해 뒀는데 화면이 거짓을 말한다.
 *
 * 고정하는 계약:
 *  1. 조회 실패(salaryLookupFailed)면 '불러오지 못했어요'라고 말하고 '아직 정해지지 않았어요'는 안 뜬다.
 *  2. 대조군 — 실패 표시가 없으면 종전 '미정' 안내 그대로다.
 *  3. 지원 단계(applied) 분기도 같은 구별을 한다.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { SettlementTab } from '../SettlementTab';
import type { ScheduleEvent } from '@/types';

function makeSchedule(overrides: Partial<ScheduleEvent> = {}): ScheduleEvent {
  return {
    id: 'schedule-1',
    type: 'confirmed',
    date: '2026-08-01',
    startTime: new Date('2026-08-01T19:00:00'),
    endTime: null,
    jobPostingId: 'venue-1',
    jobPostingName: '홀덤펍 강남점',
    location: '강남역',
    role: 'dealer',
    status: 'not_started',
    sourceCollection: 'workLogs',
    sourceId: 'worklog-1',
    timeSlot: '19:00',
    // 근무별 커스텀 단가 없음 + 단가표 비어 있음 → 급여 근거가 없다.
    postingProjection: { settlement: { roles: [] } },
    ...overrides,
  } as ScheduleEvent;
}

const failedProjection = { settlement: { roles: [], salaryLookupFailed: true } };

describe('SettlementTab — 급여 조회 실패 vs 급여 미정', () => {
  it('조회 실패면 불러오지 못했다고 말한다(미정이라고 하지 않는다)', () => {
    const { getByText, queryByText } = render(
      <SettlementTab schedule={makeSchedule({ postingProjection: failedProjection })} />
    );

    expect(getByText('급여 정보를 불러오지 못했어요')).toBeTruthy();
    expect(getByText(/급여가 정해지지 않았다는 뜻은 아니에요/)).toBeTruthy();
    expect(queryByText('급여가 아직 정해지지 않았어요')).toBeNull();
  });

  it('대조군 — 실패 표시가 없으면 종전대로 미정 안내', () => {
    const { getByText, queryByText } = render(<SettlementTab schedule={makeSchedule()} />);

    expect(getByText('급여가 아직 정해지지 않았어요')).toBeTruthy();
    expect(queryByText('급여 정보를 불러오지 못했어요')).toBeNull();
  });

  it('지원 단계에서도 같은 구별을 한다', () => {
    const failed = render(
      <SettlementTab
        schedule={makeSchedule({ type: 'applied', postingProjection: failedProjection })}
      />
    );
    expect(failed.getByText(/급여 정보를 불러오지 못했어요/)).toBeTruthy();
    expect(failed.queryByText(/급여 미정/)).toBeNull();

    const unset = render(<SettlementTab schedule={makeSchedule({ type: 'applied' })} />);
    expect(unset.getByText(/급여 미정/)).toBeTruthy();
  });

  it('근무별 커스텀 단가가 있으면 조회 실패여도 금액 근거가 있다 — 실패 안내를 띄우지 않는다', () => {
    const { queryByText } = render(
      <SettlementTab
        schedule={makeSchedule({
          postingProjection: failedProjection,
          customSalaryInfo: { type: 'hourly', amount: 20000 },
        })}
      />
    );

    expect(queryByText('급여 정보를 불러오지 못했어요')).toBeNull();
    expect(queryByText('급여가 아직 정해지지 않았어요')).toBeNull();
  });
});
