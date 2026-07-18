/**
 * VenueDayPanel — 필요 인원 저장의 단건/요일반복(벌크) 분기 배선 검증
 *
 * "이번 달 같은 요일 전체 적용" 체크박스가 저장 경로를 가르는지 검증한다:
 *  - off(기본): useSetVenueSoftTarget(단건) 만 호출, 벌크 미호출.
 *  - on: getSameWeekdayDatesInMonth 결과를 오늘 이후로 필터 → confirmAction 확인 다이얼로그를 띄우고,
 *    onConfirm 에서만 useSetVenueSoftTargetBulk 호출(임페커블 룰12).
 *  - on + 남은 날짜 0(과거만): 확인 없이 에러 토스트만.
 *  - on + 비정상 날짜: parseDateString 가드로 확인/두 변이 모두 미발동 + 에러 토스트.
 *
 * 확인 다이얼로그는 raw Alert.alert 이 아닌 confirmAction 경유여야 한다 — RN Web 에서
 * Alert.alert 은 no-op 이라 웹에선 벌크 저장이 조용히 죽는다(confirmAction 이 web=window.confirm 분기).
 *
 * 변이/조회 훅과 자식 시트는 목(경로만 검증), Checkbox/Input/Button 은 실물로 두어 실제
 * 사용자 입력 경로(체크 토글·목표 입력·저장 탭)를 그대로 태운다.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { VenueDayPanel } from '../VenueDayPanel';
import {
  useSetVenueSoftTarget,
  useSetVenueSoftTargetBulk,
  useVenueDaySlots,
} from '@/hooks/weeklyGrid';
import { getSameWeekdayDatesInMonth } from '@/domains/weeklyGrid';
import { useToastStore } from '@/stores/toastStore';
import { confirmAction } from '@/utils/confirmAction';

// 변이/조회 훅 목(경로 검증용) — 이 화면이 쓰는 세 훅만 대체.
jest.mock('@/hooks/weeklyGrid', () => ({
  useSetVenueSoftTarget: jest.fn(),
  useSetVenueSoftTargetBulk: jest.fn(),
  useVenueDaySlots: jest.fn(),
}));

// computeShortage 등 순수 로직은 실물 유지, getSameWeekdayDatesInMonth 만 대체(요일 반복 대상 날짜 주입).
jest.mock('@/domains/weeklyGrid', () => ({
  ...jest.requireActual('@/domains/weeklyGrid'),
  getSameWeekdayDatesInMonth: jest.fn(),
}));

jest.mock('@/stores/toastStore', () => ({ useToastStore: jest.fn() }));
jest.mock('@/stores/authStore', () => ({ useUser: jest.fn(() => ({ uid: 'u1' })) }));

// 확인 다이얼로그 유틸 목 — 웹/네이티브 분기는 confirmAction 자체 책임, 여기선 호출 계약만 검증.
jest.mock('@/utils/confirmAction', () => ({ confirmAction: jest.fn() }));

// 자식 시트/상세는 이 테스트 관심 밖 — null 컴포넌트로 대체(무거운 의존 차단).
jest.mock('../VenueDayDetail', () => ({ VenueDayDetail: () => null }));
jest.mock('../AddSlotSheet', () => ({ AddSlotSheet: () => null }));
jest.mock('../EditSlotSheet', () => ({ EditSlotSheet: () => null }));

const mockUseSingle = useSetVenueSoftTarget as unknown as jest.Mock;
const mockUseBulk = useSetVenueSoftTargetBulk as unknown as jest.Mock;
const mockUseDaySlots = useVenueDaySlots as unknown as jest.Mock;
const mockGetSameWeekday = getSameWeekdayDatesInMonth as unknown as jest.Mock;
const mockUseToast = useToastStore as unknown as jest.Mock;
const mockConfirmAction = confirmAction as unknown as jest.Mock;

// 테스트 간 참조 가능하도록 모듈 스코프 스파이 선언(useSetVenueSoftTarget.test.tsx 패턴).
const singleMutate = jest.fn();
const bulkMutate = jest.fn();
const toastSuccessSpy = jest.fn();
const toastErrorSpy = jest.fn();

// confirmAction 호출 계약 타입 — onConfirm 을 직접 호출해 "확인 후에만 벌크" 를 분리 검증한다.
type ConfirmActionOptions = {
  title: string;
  message: string;
  confirmText: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
};

beforeEach(() => {
  singleMutate.mockReset();
  bulkMutate.mockReset();
  toastSuccessSpy.mockReset();
  toastErrorSpy.mockReset();
  mockGetSameWeekday.mockReset();
  mockConfirmAction.mockReset();

  mockUseSingle.mockReturnValue({ mutate: singleMutate, isPending: false });
  mockUseBulk.mockReturnValue({ mutate: bulkMutate, isPending: false });
  mockUseDaySlots.mockReturnValue({ data: [] });
  // 셀렉터(s) 가 success/error 를 꺼내므로 안정적인 스파이를 반환(VenueCreateSheet.test.tsx 패턴).
  mockUseToast.mockImplementation((sel: (s: object) => unknown) =>
    sel({ success: toastSuccessSpy, error: toastErrorSpy, info: jest.fn() })
  );
});

function renderPanel(date = '2026-07-05') {
  return render(<VenueDayPanel venueId="v1" date={date} dateLabel="7월 5일 (일)" />);
}

it('요일 반복 off(기본): 저장 시 단건 mutate 만 호출(벌크·확인 미발동)', () => {
  const { getByLabelText } = renderPanel();

  fireEvent.changeText(getByLabelText('이 날 필요 인원'), '5');
  fireEvent.press(getByLabelText('필요 인원 저장'));

  expect(singleMutate).toHaveBeenCalledTimes(1);
  // E5: write 경계에서 날짜키 정규화(toDateString) — venueId/date/count 매핑 검증.
  expect(singleMutate.mock.calls[0][0]).toEqual({ venueId: 'v1', date: '2026-07-05', count: 5 });
  expect(bulkMutate).not.toHaveBeenCalled();
  expect(mockConfirmAction).not.toHaveBeenCalled();
});

it('요일 반복 on: 저장 시 confirmAction 확인(즉시 벌크 아님) → onConfirm 에서 과거 제외 dates 로 벌크 호출', () => {
  // 필터(d >= today)를 통과하도록 먼 미래 날짜만 반환 → 실제 시스템 날짜와 무관하게 전부 잔존.
  const futureDates = ['2099-01-04', '2099-01-11', '2099-01-18'];
  mockGetSameWeekday.mockReturnValue(futureDates);

  const { getByLabelText } = renderPanel();

  fireEvent.press(getByLabelText('이번 달 같은 요일 전체 적용'));
  fireEvent.changeText(getByLabelText('이 날 필요 인원'), '5');
  fireEvent.press(getByLabelText('필요 인원 저장'));

  // 저장 즉시엔 확인 다이얼로그만 — 벌크는 아직 미호출(룰12: 조용한 덮어쓰기 방지).
  expect(bulkMutate).not.toHaveBeenCalled();
  expect(mockConfirmAction).toHaveBeenCalledTimes(1);

  // 확인 라벨은 수치 포함(룰11: 파괴적 액션은 결과를 라벨에 명시), destructive 플래그 필수.
  const options = mockConfirmAction.mock.calls[0][0] as ConfirmActionOptions;
  expect(options.title).toBe('요일 전체 적용');
  expect(options.confirmText).toBe('3일에 적용');
  expect(options.destructive).toBe(true);

  // onConfirm 을 직접 호출해야 실제 벌크 저장이 발동한다.
  options.onConfirm();

  expect(bulkMutate).toHaveBeenCalledTimes(1);
  expect(bulkMutate.mock.calls[0][0]).toEqual({ venueId: 'v1', dates: futureDates, count: 5 });
  expect(singleMutate).not.toHaveBeenCalled();
});

it('요일 반복 on + 남은 날짜 0(과거만 반환): 확인·두 변이 미발동 + 에러 토스트', () => {
  // 전부 오늘 이전 → 필터 후 0건 → 확인 다이얼로그 없이 에러 토스트로 종료.
  mockGetSameWeekday.mockReturnValue(['2020-01-04', '2020-01-11']);

  const { getByLabelText } = renderPanel();

  fireEvent.press(getByLabelText('이번 달 같은 요일 전체 적용'));
  fireEvent.changeText(getByLabelText('이 날 필요 인원'), '5');
  fireEvent.press(getByLabelText('필요 인원 저장'));

  expect(mockConfirmAction).not.toHaveBeenCalled();
  expect(bulkMutate).not.toHaveBeenCalled();
  expect(singleMutate).not.toHaveBeenCalled();
  expect(toastErrorSpy).toHaveBeenCalled();
});

it('요일 반복 on + 비정상 날짜: parseDateString 가드로 확인·두 변이 미발동 + 에러 토스트', () => {
  const { getByLabelText } = renderPanel('invalid');

  fireEvent.press(getByLabelText('이번 달 같은 요일 전체 적용'));
  fireEvent.changeText(getByLabelText('이 날 필요 인원'), '5');
  fireEvent.press(getByLabelText('필요 인원 저장'));

  expect(mockConfirmAction).not.toHaveBeenCalled();
  expect(singleMutate).not.toHaveBeenCalled();
  expect(bulkMutate).not.toHaveBeenCalled();
  expect(toastErrorSpy).toHaveBeenCalled();
});
