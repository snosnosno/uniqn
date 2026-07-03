/**
 * VenueDayPanel — 목표 인원 저장의 단건/요일반복(벌크) 분기 배선 검증
 *
 * "이번 달 같은 요일 전체 적용" 체크박스가 저장 경로를 가르는지 검증한다:
 *  - off(기본): useSetVenueSoftTarget(단건) 만 호출, 벌크 미호출.
 *  - on: getSameWeekdayDatesInMonth 결과를 오늘 이후로 필터 → Alert.alert 확인 다이얼로그를 띄우고,
 *    destructive 버튼(text=`N일에 적용`)의 onPress 에서만 useSetVenueSoftTargetBulk 호출(임페커블 룰12).
 *  - on + 남은 날짜 0(과거만): Alert 없이 에러 토스트만.
 *  - on + 비정상 날짜: parseDateString 가드로 Alert/두 변이 모두 미발동 + 에러 토스트.
 *
 * 변이/조회 훅과 자식 시트는 목(경로만 검증), Checkbox/Input/Button 은 실물로 두어 실제
 * 사용자 입력 경로(체크 토글·목표 입력·저장 탭)를 그대로 태운다. Alert 는 jest.spyOn 으로 가로채
 * 확인 다이얼로그가 뜨는 것과 destructive onPress 가 벌크를 트리거하는 것을 분리 검증한다.
 */
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import React from 'react';
import { VenueDayPanel } from '../VenueDayPanel';
import {
  useSetVenueSoftTarget,
  useSetVenueSoftTargetBulk,
  useVenueDaySlots,
} from '@/hooks/weeklyGrid';
import { getSameWeekdayDatesInMonth } from '@/domains/weeklyGrid';
import { useToastStore } from '@/stores/toastStore';

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

// 자식 시트/상세는 이 테스트 관심 밖 — null 컴포넌트로 대체(무거운 의존 차단).
jest.mock('../VenueDayDetail', () => ({ VenueDayDetail: () => null }));
jest.mock('../AddSlotSheet', () => ({ AddSlotSheet: () => null }));
jest.mock('../EditSlotSheet', () => ({ EditSlotSheet: () => null }));

const mockUseSingle = useSetVenueSoftTarget as unknown as jest.Mock;
const mockUseBulk = useSetVenueSoftTargetBulk as unknown as jest.Mock;
const mockUseDaySlots = useVenueDaySlots as unknown as jest.Mock;
const mockGetSameWeekday = getSameWeekdayDatesInMonth as unknown as jest.Mock;
const mockUseToast = useToastStore as unknown as jest.Mock;

// 테스트 간 참조 가능하도록 모듈 스코프 스파이 선언(useSetVenueSoftTarget.test.tsx 패턴).
const singleMutate = jest.fn();
const bulkMutate = jest.fn();
const toastSuccessSpy = jest.fn();
const toastErrorSpy = jest.fn();

// Alert 확인 다이얼로그를 가로챈다(실제 네이티브 alert 미발동, buttons 콜백 직접 호출용).
// jest.config restoreMocks:true 가 매 테스트 후 spy 를 원복하므로 beforeEach 에서 매번 재설치한다.
let alertSpy: jest.SpyInstance;

// Alert.alert(title, message, buttons) 의 buttons 타입 — destructive 버튼 onPress 를 직접 호출한다.
type AlertButton = { text?: string; style?: string; onPress?: () => void };

beforeEach(() => {
  singleMutate.mockReset();
  bulkMutate.mockReset();
  toastSuccessSpy.mockReset();
  toastErrorSpy.mockReset();
  mockGetSameWeekday.mockReset();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

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

it('요일 반복 off(기본): 저장 시 단건 mutate 만 호출(벌크·Alert 미발동)', () => {
  const { getByLabelText } = renderPanel();

  fireEvent.changeText(getByLabelText('이 날 목표 인원'), '5');
  fireEvent.press(getByLabelText('목표 인원 저장'));

  expect(singleMutate).toHaveBeenCalledTimes(1);
  // E5: write 경계에서 날짜키 정규화(toDateString) — venueId/date/count 매핑 검증.
  expect(singleMutate.mock.calls[0][0]).toEqual({ venueId: 'v1', date: '2026-07-05', count: 5 });
  expect(bulkMutate).not.toHaveBeenCalled();
  expect(alertSpy).not.toHaveBeenCalled();
});

it('요일 반복 on: 저장 시 Alert 확인 다이얼로그(즉시 벌크 아님) → destructive onPress 에서 과거 제외 dates 로 벌크 호출', () => {
  // 필터(d >= today)를 통과하도록 먼 미래 날짜만 반환 → 실제 시스템 날짜와 무관하게 전부 잔존.
  const futureDates = ['2099-01-04', '2099-01-11', '2099-01-18'];
  mockGetSameWeekday.mockReturnValue(futureDates);

  const { getByLabelText } = renderPanel();

  fireEvent.press(getByLabelText('이번 달 같은 요일 전체 적용'));
  fireEvent.changeText(getByLabelText('이 날 목표 인원'), '5');
  fireEvent.press(getByLabelText('목표 인원 저장'));

  // 저장 즉시엔 확인 다이얼로그만 — 벌크는 아직 미호출(룰12: 조용한 덮어쓰기 방지).
  expect(bulkMutate).not.toHaveBeenCalled();
  expect(alertSpy).toHaveBeenCalledTimes(1);

  // destructive 버튼(두 번째)의 onPress 를 직접 호출해야 실제 벌크 저장이 발동한다.
  const buttons = alertSpy.mock.calls[0][2] as AlertButton[];
  expect(buttons[1]?.text).toBe('3일에 적용');
  expect(buttons[1]?.style).toBe('destructive');
  buttons[1]?.onPress?.();

  expect(bulkMutate).toHaveBeenCalledTimes(1);
  expect(bulkMutate.mock.calls[0][0]).toEqual({ venueId: 'v1', dates: futureDates, count: 5 });
  expect(singleMutate).not.toHaveBeenCalled();
});

it('요일 반복 on + 남은 날짜 0(과거만 반환): Alert·두 변이 미발동 + 에러 토스트', () => {
  // 전부 오늘 이전 → 필터 후 0건 → 확인 다이얼로그 없이 에러 토스트로 종료.
  mockGetSameWeekday.mockReturnValue(['2020-01-04', '2020-01-11']);

  const { getByLabelText } = renderPanel();

  fireEvent.press(getByLabelText('이번 달 같은 요일 전체 적용'));
  fireEvent.changeText(getByLabelText('이 날 목표 인원'), '5');
  fireEvent.press(getByLabelText('목표 인원 저장'));

  expect(alertSpy).not.toHaveBeenCalled();
  expect(bulkMutate).not.toHaveBeenCalled();
  expect(singleMutate).not.toHaveBeenCalled();
  expect(toastErrorSpy).toHaveBeenCalled();
});

it('요일 반복 on + 비정상 날짜: parseDateString 가드로 Alert·두 변이 미발동 + 에러 토스트', () => {
  const { getByLabelText } = renderPanel('invalid');

  fireEvent.press(getByLabelText('이번 달 같은 요일 전체 적용'));
  fireEvent.changeText(getByLabelText('이 날 목표 인원'), '5');
  fireEvent.press(getByLabelText('목표 인원 저장'));

  expect(alertSpy).not.toHaveBeenCalled();
  expect(singleMutate).not.toHaveBeenCalled();
  expect(bulkMutate).not.toHaveBeenCalled();
  expect(toastErrorSpy).toHaveBeenCalled();
});
