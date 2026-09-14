/**
 * VenueDayPanel — 필요 인원 저장의 단일(단건) 경로 검증 + 요일 반복 제거 회귀 가드
 *
 * "이번 달 같은 요일 전체 적용"은 매주 같은 요일에 같은 인원이 필요하다는 가정 위에 있던
 * 벌크 수단이라 제거했다. 저장 경로는 이제 단건 하나뿐이다:
 *  - 저장 → useSetVenueSoftTarget(단건) 1회 호출, 확인 다이얼로그 없음.
 *  - 체크박스·벌크 훅 재유입 금지(회귀 가드).
 *  - 상한(99) 클램프는 단건 경로에서도 유지.
 *
 * 변이/조회 훅과 자식 시트는 목(경로만 검증), Input/Button 은 실물로 두어 실제 사용자 입력
 * 경로(목표 입력·저장 탭)를 그대로 태운다.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { VenueDayPanel } from '../VenueDayPanel';
import { useSetVenueSoftTarget, useVenueDaySlots } from '@/hooks/workSchedule';
import { useToastStore } from '@/stores/toastStore';
import { confirmAction } from '@/utils/confirmAction';

// 변이/조회 훅 목(경로 검증용) — 이 컴포넌트가 쓰는 두 훅만 대체.
jest.mock('@/hooks/workSchedule', () => ({
  useSetVenueSoftTarget: jest.fn(),
  useVenueDaySlots: jest.fn(),
  // 아래 셋은 이 파일의 관심 밖이라 무해한 스텁으로 둔다 — 명시 목이라 빠뜨리면
  // 컴포넌트가 렌더 단계에서 죽는다(모듈 전체가 이 객체로 대체된다).
  useUpdateSlot: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  useDeleteSlot: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  useUpdatePostingSlotTime: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
}));

jest.mock('@/stores/toastStore', () => ({ useToastStore: jest.fn() }));
jest.mock('@/stores/authStore', () => ({ useUser: jest.fn(() => ({ uid: 'u1' })) }));

// 확인 다이얼로그가 다시 배선되면 잡아내기 위한 목(호출 0 을 단언한다).
jest.mock('@/utils/confirmAction', () => ({ confirmAction: jest.fn() }));

// 자식 시트/상세는 이 테스트 관심 밖 — null 컴포넌트로 대체(무거운 의존 차단).
jest.mock('../VenueDayDetail', () => ({ VenueDayDetail: () => null }));
jest.mock('../AddSlotSheet', () => ({ AddSlotSheet: () => null }));
jest.mock('@/components/workLogEdit', () => ({ WorkLogEditSheet: () => null }));

const mockUseSingle = useSetVenueSoftTarget as unknown as jest.Mock;
const mockUseDaySlots = useVenueDaySlots as unknown as jest.Mock;
const mockUseToast = useToastStore as unknown as jest.Mock;
const mockConfirmAction = confirmAction as unknown as jest.Mock;

// 테스트 간 참조 가능하도록 모듈 스코프 스파이 선언(useSetVenueSoftTarget.test.tsx 패턴).
const singleMutate = jest.fn();
const toastSuccessSpy = jest.fn();
const toastErrorSpy = jest.fn();

beforeEach(() => {
  singleMutate.mockReset();
  toastSuccessSpy.mockReset();
  toastErrorSpy.mockReset();
  mockConfirmAction.mockReset();

  mockUseSingle.mockReturnValue({ mutate: singleMutate, isPending: false });
  mockUseDaySlots.mockReturnValue({ data: [] });
  // 셀렉터(s) 가 success/error 를 꺼내므로 안정적인 스파이를 반환(VenueCreateSheet.test.tsx 패턴).
  mockUseToast.mockImplementation((sel: (s: object) => unknown) =>
    sel({ success: toastSuccessSpy, error: toastErrorSpy, info: jest.fn() })
  );
});

function renderPanel(date = '2026-07-05') {
  return render(<VenueDayPanel venueId="v1" date={date} dateLabel="7월 5일 (일)" />);
}

it('저장 시 단건 mutate 만 호출하고 확인 다이얼로그는 뜨지 않는다', () => {
  const { getByLabelText } = renderPanel();

  fireEvent.changeText(getByLabelText('이 날 직접 지정할 목표 인원'), '5');
  fireEvent.press(getByLabelText('목표 인원 저장'));

  expect(singleMutate).toHaveBeenCalledTimes(1);
  // E5: write 경계에서 날짜키 정규화(toDateString) — venueId/date/count 매핑 검증.
  expect(singleMutate.mock.calls[0][0]).toEqual({ venueId: 'v1', date: '2026-07-05', count: 5 });
  expect(mockConfirmAction).not.toHaveBeenCalled();
});

it('요일 반복 체크박스가 렌더되지 않는다(반복 전제 벌크 재유입 금지)', () => {
  const { queryByLabelText, queryByText, getByLabelText } = renderPanel();

  // 대조군 — 패널 본문이 실제로 렌더됐다는 증거.
  expect(getByLabelText('이 날 직접 지정할 목표 인원')).not.toBeNull();

  expect(queryByLabelText('이번 달 같은 요일 전체 적용')).toBeNull();
  expect(queryByText('이번 달 같은 요일 전체 적용')).toBeNull();
});

it('상한(99) 초과 입력은 클램프된 값으로 저장한다', () => {
  const { getByLabelText } = renderPanel();

  fireEvent.changeText(getByLabelText('이 날 직접 지정할 목표 인원'), '997');
  fireEvent.press(getByLabelText('목표 인원 저장'));

  expect(singleMutate).toHaveBeenCalledTimes(1);
  expect(singleMutate.mock.calls[0][0]).toEqual({ venueId: 'v1', date: '2026-07-05', count: 99 });
});

it('월 요약 실패 시 0명으로 단정하지 않고 계획·충원 쓰기를 잠근다', () => {
  mockUseDaySlots.mockReturnValue({ data: [{ workLogId: 'wl-1' }] });
  const { queryByLabelText, getByText } = render(
    <VenueDayPanel
      venueId="v1"
      date="2026-07-05"
      dateLabel="7월 5일 (일)"
      isSummaryAvailable={false}
    />
  );

  expect(
    getByText('충원 현황을 확인 중이거나 불러오지 못해 계획 변경을 잠시 잠갔어요.')
  ).toBeTruthy();
  expect(queryByLabelText('인원 추가')).toBeNull();
  expect(queryByLabelText('시간 일괄 변경')).toBeNull();
  expect(queryByLabelText('이 날 직접 지정할 목표 인원')).toBeNull();
  expect(queryByLabelText('목표 인원 저장')).toBeNull();
});

/**
 * P0-1 회귀 가드 — 목표 입력칸은 **수동 목표**만 담는다.
 *
 * 예전에는 `cell.softTarget`(= max(수동, 공고 좌석))을 프리필해서, 공고 좌석이 더 크면
 * 그 숫자가 칸에 들어앉고 저장 한 번에 사용자의 수동 목표를 덮었다. 공고를 마감해 좌석이
 * 사라지면 있지도 않던 목표만 남아 매일 부족을 외쳤다(기준선 §5.1 "수동과 파생을 섞지 않는다").
 */
const CELL_WITH_DERIVED = {
  dateKey: '2026-07-05',
  headcount: 0,
  jobCount: 1,
  softTarget: 8, // 실효 = max(수동 2, 공고 8)
  manualTarget: 2,
  derivedRequired: 8,
  shortage: 8,
  status: 'shortage' as const,
  priorityBadge: { kind: 'shortage' as const, count: 8 },
};

it('공고 파생 좌석이 더 커도 입력칸에는 수동 목표만 프리필한다', () => {
  const { getByLabelText } = render(
    <VenueDayPanel
      venueId="v1"
      date="2026-07-05"
      dateLabel="7월 5일 (일)"
      cell={CELL_WITH_DERIVED}
    />
  );

  expect(getByLabelText('이 날 직접 지정할 목표 인원').props.value).toBe('2');
});

it('수동 목표를 바꾸지 않은 채 저장을 눌러도 파생값이 수동 목표로 저장되지 않는다', () => {
  const { getByLabelText } = render(
    <VenueDayPanel
      venueId="v1"
      date="2026-07-05"
      dateLabel="7월 5일 (일)"
      cell={CELL_WITH_DERIVED}
    />
  );

  // dirty 가 아니므로 저장 버튼은 비활성 — 눌러도 mutate 가 나가지 않는다.
  fireEvent.press(getByLabelText('목표 인원 저장'));
  expect(singleMutate).not.toHaveBeenCalled();
});

it('공고 좌석이 있으면 필요 인원이 입력값과 다른 이유를 그 자리에 설명한다', () => {
  const { getByTestId } = render(
    <VenueDayPanel
      venueId="v1"
      date="2026-07-05"
      dateLabel="7월 5일 (일)"
      cell={CELL_WITH_DERIVED}
    />
  );

  expect(getByTestId('target-source-hint')).toBeTruthy();
});
