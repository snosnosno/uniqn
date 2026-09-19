/**
 * StaffAttendanceSheet(결함 ⑦-2 UI) — 사유별 게이트 + 되돌리기 노출 회귀.
 *
 * 이 파일이 고정하는 것은 **버튼을 언제 열지**다. 설계
 * `docs/planning/2026-08-08-ops-attendance-writeback-design.md` §7 이 못박은 규칙:
 *   · `reason === 'ok' && writeAllowed` 일 때만 기록 컨트롤을 연다.
 *     특히 `ambiguous`(같은 날 2건)·`cancelled`(취소된 행)에서 버튼을 열면
 *     **틀린 행에 시각이 박힌다** — 되돌려도 스태프에게 나간 푸시는 회수되지 않는다.
 *   · `settled` 는 행을 표시하되 컨트롤만 잠근다(work_log_id 는 정상 반환된다).
 *   · 되돌리기를 같은 화면에 함께 낸다(§결정 7). 없으면 편도 문이다.
 *   · 일괄 버튼 금지(§결정 5) — 알림 트리거가 FOR EACH ROW ×3 이라 20명이면 최대 60발화.
 *
 * SheetModal 은 @gorhom/bottom-sheet 실물이라 jest 렌더 불가 — 같은 폴더 시트 테스트와
 * 동일하게 가볍게 모킹한다.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { StaffAttendanceSheet } from '../StaffAttendanceSheet';
import { useRecordOpsAttendance } from '@/hooks/ops';
import { confirmAction } from '@/utils/confirmAction';
import type { OpsStaffWorkLogLink, OpsStaffWorkLogReason } from '@/types/ops';

jest.mock('@/components/ui/SheetModal', () => {
  const { View } = require('react-native');
  return {
    SheetModal: ({ visible, children }: any) => (visible ? <View>{children}</View> : null),
  };
});

jest.mock('@/hooks/ops', () => ({ useRecordOpsAttendance: jest.fn() }));
jest.mock('@/utils/confirmAction', () => ({ confirmAction: jest.fn() }));

const mockMutate = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useRecordOpsAttendance as jest.Mock).mockReturnValue({
    mutate: mockMutate,
    isPending: false,
  });
  // confirmAction 은 사용자가 "확인" 을 누른 경로만 검증한다 — 취소 경로는 mutate 미호출이
  // 자명하고, 여기서 고정하려는 것은 게이트지 다이얼로그 구현이 아니다.
  (confirmAction as jest.Mock).mockImplementation(({ onConfirm }: any) => onConfirm?.());
});

function makeLink(over: Partial<OpsStaffWorkLogLink> = {}): OpsStaffWorkLogLink {
  return {
    opsStaffId: 'ops-1',
    staffId: 'staff-1',
    staffName: '김딜러',
    workLogId: 'wl-1',
    wlStatus: 'scheduled',
    payrollStatus: 'pending',
    checkInTs: null,
    checkOutTs: null,
    writeAllowed: true,
    reason: 'ok',
    ...over,
  };
}

function renderSheet(link: OpsStaffWorkLogLink | null) {
  return render(
    <StaffAttendanceSheet
      visible
      tournamentId="t-1"
      staffName="김딜러"
      link={link}
      onClose={jest.fn()}
    />
  );
}

describe('StaffAttendanceSheet — 사유별 게이트', () => {
  // 🚨 이 표가 이 컴포넌트의 존재 이유다. 여기 한 줄이라도 true 로 바뀌면
  //    "애매한 상태에서 버튼을 열지 않는다"는 fail-closed 계약이 깨진 것이다.
  const blocked: OpsStaffWorkLogReason[] = [
    'no_posting',
    'no_event_date',
    'not_linked',
    'cancelled',
    'ambiguous',
  ];

  it.each(blocked)('%s 는 기록 컨트롤을 열지 않는다', (reason) => {
    const { queryByText } = renderSheet(makeLink({ reason, workLogId: null }));

    expect(queryByText('출근 기록')).toBeNull();
    expect(queryByText('퇴근 기록')).toBeNull();
  });

  it.each(blocked)('%s 는 사유별 안내 문구를 띄운다', (reason) => {
    const { getByTestId } = renderSheet(makeLink({ reason, workLogId: null }));

    // 문구 자체를 하드코딩해 고정하지 않는다 — 안내 문구는 카피 조정 대상이다.
    // 고정하는 것은 "사유마다 비어있지 않은 안내가 반드시 있다" 는 계약이다.
    expect(getByTestId('attendance-reason-notice').props.children).toBeTruthy();
  });

  it('settled 는 시각을 표시하되 컨트롤만 잠근다', () => {
    const { queryByText, getByTestId } = renderSheet(
      makeLink({
        reason: 'settled',
        payrollStatus: 'completed',
        checkInTs: '2026-08-09T00:05:00.000Z',
      })
    );

    expect(getByTestId('attendance-check-in').props.children).toBeTruthy();
    expect(queryByText('출근 기록')).toBeNull();
    expect(queryByText('출근 취소')).toBeNull();
  });

  it('ok 이지만 writeAllowed=false 면 컨트롤을 열지 않는다', () => {
    // ops 축(대회 멤버)과 공고 축(정산 권한)은 다르다 — 대회 owner 이지만 공고
    // 워크스페이스 밖인 사용자가 실재한다(설계 결정 4).
    const { queryByText } = renderSheet(makeLink({ writeAllowed: false }));

    expect(queryByText('출근 기록')).toBeNull();
    expect(queryByText('퇴근 기록')).toBeNull();
  });

  it('link 가 없으면 컨트롤을 열지 않는다', () => {
    const { queryByText } = renderSheet(null);

    expect(queryByText('출근 기록')).toBeNull();
    expect(queryByText('퇴근 기록')).toBeNull();
  });
});

describe('StaffAttendanceSheet — ok + writeAllowed 쓰기 경로', () => {
  it('출근 기록은 checkIn 만 싣는다 (퇴근 축 미변경)', () => {
    const { getByText } = renderSheet(makeLink());

    fireEvent.press(getByText('출근 기록'));

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const arg = mockMutate.mock.calls[0][0];
    expect(arg.workLogId).toBe('wl-1');
    expect(arg.checkIn).toBeInstanceOf(Date);
    // 🔑 3상 계약(키 없음=미변경 / null=삭제 / 값=기록). 퇴근 키를 같이 실으면
    //    건드릴 생각이 없던 축을 덮어쓴다.
    expect('checkOut' in arg).toBe(false);
  });

  it('퇴근 기록은 checkOut 만 싣는다', () => {
    const { getByText } = renderSheet(makeLink({ checkInTs: '2026-08-09T00:05:00.000Z' }));

    fireEvent.press(getByText('퇴근 기록'));

    const arg = mockMutate.mock.calls[0][0];
    expect(arg.checkOut).toBeInstanceOf(Date);
    expect('checkIn' in arg).toBe(false);
  });

  it('기록된 출근이 있으면 되돌리기를 같은 화면에 낸다 (편도 문 금지 §결정 7)', () => {
    const { getByText, queryByText } = renderSheet(
      makeLink({ checkInTs: '2026-08-09T00:05:00.000Z' })
    );

    expect(queryByText('출근 기록')).toBeNull();
    fireEvent.press(getByText('출근 취소'));

    // null = 삭제. undefined 나 키 생략이면 서버는 "미변경" 으로 읽어 아무 일도 안 한다.
    expect(mockMutate.mock.calls[0][0].checkIn).toBeNull();
  });

  it('기록된 퇴근이 있으면 퇴근 취소를 낸다', () => {
    const { getByText } = renderSheet(
      makeLink({
        checkInTs: '2026-08-09T00:05:00.000Z',
        checkOutTs: '2026-08-09T09:05:00.000Z',
      })
    );

    fireEvent.press(getByText('퇴근 취소'));

    expect(mockMutate.mock.calls[0][0].checkOut).toBeNull();
  });

  it('기록·취소 모두 확인 다이얼로그를 거친다', () => {
    // 되돌릴 수 있어도 확인을 받는다 — 기록 즉시 스태프에게 푸시가 나가고
    // 그 푸시는 되돌려도 회수되지 않는다.
    const { getByText } = renderSheet(makeLink());

    fireEvent.press(getByText('출근 기록'));

    expect(confirmAction).toHaveBeenCalledTimes(1);
  });

  it('일괄 처리 버튼을 만들지 않는다 (§결정 5 알림 폭발 방어)', () => {
    const { queryByText } = renderSheet(makeLink());

    expect(queryByText('전체 출근 처리')).toBeNull();
    expect(queryByText('일괄 기록')).toBeNull();
  });

  it('mutate 진행 중에는 컨트롤을 잠근다 (중복 발화 방지)', () => {
    (useRecordOpsAttendance as jest.Mock).mockReturnValue({ mutate: mockMutate, isPending: true });
    const { getByText } = renderSheet(makeLink());

    fireEvent.press(getByText('출근 기록'));

    expect(mockMutate).not.toHaveBeenCalled();
  });
});
