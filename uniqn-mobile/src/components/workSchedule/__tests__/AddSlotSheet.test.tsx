/**
 * AddSlotSheet — 콜드스타트 CTA(P0-2) + 출근시간 단일 입력/미정 테스트(Task 8b)
 *
 * (1) 확정 풀이 빈 상태(신규 운영자 첫 상태)에서 빈상태가 죽은 안내문이 아니라 행동 가능한
 *     CTA 2개를 제공하는지: "공고로 모집하기" → 공고 작성 라우트로 venueId 를 실어 이동+시트 닫힘,
 *     "닉네임으로 찾기" → 닉네임검색 모드 전환(검색 입력 노출).
 * (2) 풀에서 인원을 고르면 종료 필드·익일 프리뷰가 아니라 **출근시간(start) 단일 필드 + 미정 토글**을
 *     보여주는지(형제 AddStaffModal·지원/확정 모델과 정합). 미정 토글 시 트리거가 '미정'으로 전환되는지.
 */
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { AddSlotSheet } from '../AddSlotSheet';
import { defaultVenueSalaryDraft } from '../RoleSalaryField';
import { useConfirmedStaff } from '@/hooks/useConfirmedStaff';
import { useStaffNicknameSearch } from '@/hooks/useStaffNicknameSearch';
import { useVenueContainer, useSetVenueRoleSalary } from '@/hooks/workSchedule';
import { useToastStore } from '@/stores/toastStore';

// 무거운 의존(SheetModal=RNModal+reanimated) 모킹: visible 일 때 children+footer+overlay 렌더
jest.mock('@/components/ui/SheetModal', () => {
  const { View } = require('react-native');
  return {
    SheetModal: ({ visible, children, footer, overlay }: any) =>
      visible ? (
        <View>
          {children}
          {footer}
          {overlay}
        </View>
      ) : null,
  };
});

// 휠 피커(reanimated) 비활성 — 이 테스트는 프리뷰/CTA 만 다룬다
jest.mock('@/components/ui/TimeWheelPicker', () => ({
  TimeWheelPicker: () => null,
}));

// 전역 expo-router 목은 매 호출 새 jest.fn 을 반환 → 검증 가능한 모듈 스코프 스파이로 대체
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// useQueryClient 는 전역 목에 없음(실물) → Provider 없이 렌더 가능하도록 대체
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('@/hooks/useConfirmedStaff', () => ({ useConfirmedStaff: jest.fn() }));
jest.mock('@/hooks/useStaffNicknameSearch', () => ({ useStaffNicknameSearch: jest.fn() }));
// JIT 급여 접점: 컨테이너 단가표 읽기 + 단가 저장 변이 + 토스트 안내를 훅/스토어 경계에서 대체
// (실물 useQuery 는 Provider 를 요구하므로 barrel 훅을 직접 목).
jest.mock('@/hooks/workSchedule', () => ({
  useVenueContainer: jest.fn(),
  useSetVenueRoleSalary: jest.fn(),
}));
jest.mock('@/stores/toastStore', () => ({ useToastStore: jest.fn() }));

const mockUseConfirmedStaff = useConfirmedStaff as unknown as jest.Mock;
const mockUseNicknameSearch = useStaffNicknameSearch as unknown as jest.Mock;
const mockUseVenueContainer = useVenueContainer as unknown as jest.Mock;
const mockUseSetVenueRoleSalary = useSetVenueRoleSalary as unknown as jest.Mock;
const mockUseToastStore = useToastStore as unknown as jest.Mock;

// 호출 순서·인자 검증을 위한 모듈 스코프 스파이(매 테스트 리셋).
const addStaffMock = jest.fn();
const setRoleSalaryMock = jest.fn();
const addToastMock = jest.fn();

beforeEach(() => {
  mockPush.mockReset();
  addStaffMock.mockReset().mockResolvedValue(undefined);
  setRoleSalaryMock.mockReset().mockResolvedValue(undefined);
  addToastMock.mockReset();
  // 콜드스타트: 확정 풀 0명
  mockUseConfirmedStaff.mockReturnValue({
    staff: [],
    isLoading: false,
    addStaff: addStaffMock,
    isAddingStaff: false,
  });
  mockUseNicknameSearch.mockReturnValue({
    reset: jest.fn(),
    search: jest.fn(),
    isSearching: false,
    searched: false,
    results: [],
  });
  // 기본 단가표: dealer 만 설정됨(serving 등은 미설정 → JIT 대상). isFetched=true = 조회 확정 상태
  // (JIT 노출 판정은 컨테이너 조회 도착 후에만 — needsJitSalary 의 isFetched 게이트).
  mockUseVenueContainer.mockReturnValue({
    data: { roleSalaries: [{ role: 'dealer', salary: { type: 'hourly', amount: 20000 } }] },
    isFetched: true,
  });
  mockUseSetVenueRoleSalary.mockReturnValue({ mutateAsync: setRoleSalaryMock });
  mockUseToastStore.mockReturnValue({ addToast: addToastMock });
});

/** 확정 풀에 1명(기본 역할 미지정 — 역할 칩으로 직접 선택) 세팅. */
function setPoolWithOneStaff() {
  mockUseConfirmedStaff.mockReturnValue({
    staff: [{ staffId: 'staff-9', staffName: '홍길동', staffPhotoURL: null, role: undefined }],
    isLoading: false,
    addStaff: addStaffMock,
    isAddingStaff: false,
  });
}

function renderSheet(onClose = jest.fn()) {
  return {
    onClose,
    ...render(<AddSlotSheet visible onClose={onClose} containerId="venue-1" date="2026-07-05" />),
  };
}

it('빈 풀 빈상태에 CTA 2개(공고로 모집하기/닉네임으로 찾기) 렌더', () => {
  const { getByText } = renderSheet();

  expect(getByText('공고로 모집하기')).toBeTruthy();
  expect(getByText('닉네임으로 찾기')).toBeTruthy();
});

it('"공고로 모집하기" 탭 → 공고 작성 라우트로 venueId+date 전달 + 시트 닫힘', () => {
  const { getByText, onClose } = renderSheet();

  fireEvent.press(getByText('공고로 모집하기'));

  // P2-1: 그리드 선택일(date)을 동봉해 create 초기 draft 프리필(buildGridPrefillDraft)로 이어진다.
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(employer)/my-postings/create',
    params: { venueId: 'venue-1', date: '2026-07-05' },
  });
  expect(onClose).toHaveBeenCalled();
});

it('"닉네임으로 찾기" 탭 → 닉네임검색 모드 전환(검색 입력 노출)', () => {
  const { getByText, getByPlaceholderText } = renderSheet();

  fireEvent.press(getByText('닉네임으로 찾기'));

  expect(getByPlaceholderText('닉네임 입력 (2자 이상)')).toBeTruthy();
});

it('풀에서 인원 선택 → 출근시간 단일 필드(기본 오후 6:00) 노출, 종료 필드·익일 프리뷰 없음', () => {
  // 확정 풀에 1명 존재 → 선택하면 배정 입력(출근시간 필드)이 나타난다.
  mockUseConfirmedStaff.mockReturnValue({
    staff: [{ staffId: 'staff-9', staffName: '홍길동', staffPhotoURL: null, role: 'dealer' }],
    isLoading: false,
    addStaff: jest.fn(),
    isAddingStaff: false,
  });

  const { getByText, queryByText } = renderSheet();

  // 후보행(이름) 탭 → picked 설정 → 출근시간 필드 렌더
  fireEvent.press(getByText('홍길동'));

  // 출근시간 라벨 + **빈 값**. 프리필을 되살리면 고른 적 없는 시간이 확정된다(결정 4 · §J).
  expect(getByText('출근 시간')).toBeTruthy();
  expect(getByText('시간 선택')).toBeTruthy();
  expect(queryByText('오후 6:00')).toBeNull();
  expect(queryByText('종료')).toBeNull();
  expect(queryByText(/익일/)).toBeNull();
});

it('출근시간 미정 토글 → 트리거가 "미정"으로 전환(구체 시각 숨김)', () => {
  mockUseConfirmedStaff.mockReturnValue({
    staff: [{ staffId: 'staff-9', staffName: '홍길동', staffPhotoURL: null, role: 'dealer' }],
    isLoading: false,
    addStaff: jest.fn(),
    isAddingStaff: false,
  });

  const { getByText, getAllByText, queryByText } = renderSheet();

  fireEvent.press(getByText('홍길동'));
  // 토글 전: 미정 라벨(체크박스)만 1개, 트리거는 빈 값('시간 선택').
  expect(getAllByText('미정')).toHaveLength(1);
  expect(getByText('시간 선택')).toBeTruthy();

  // '미정' 체크박스 탭 → 트리거도 '미정' 표시(라벨+트리거 = 2개).
  fireEvent.press(getByText('미정'));
  expect(getAllByText('미정')).toHaveLength(2);
  expect(queryByText('시간 선택')).toBeNull();
});

it('시간을 고르지도 미정을 체크하지도 않으면 추가할 수 없다(저장 게이트)', () => {
  setPoolWithOneStaff();
  const { getByText } = renderSheet();

  fireEvent.press(getByText('홍길동'));
  fireEvent.press(getByText('🍸 서빙'));
  // 역할까지 골랐지만 시간 축은 미결정 — '추가' 를 눌러도 아무 일도 일어나지 않아야 한다.
  fireEvent.press(getByText('추가'));

  expect(addStaffMock).not.toHaveBeenCalled();
});

// ── JIT 급여 접점(Task 6): 미설정 역할만 그 자리서 묻고, 단가 먼저 저장 후 슬롯 추가 ──

it('미설정 역할(serving) 선택 시 JIT 단가 필드가 나타난다', () => {
  setPoolWithOneStaff();
  const { getByText } = renderSheet();

  fireEvent.press(getByText('홍길동'));
  fireEvent.press(getByText('🍸 서빙'));

  // 단가표에 serving 없음 → RoleSalaryField 캡션('서빙 단가 미설정 …') 노출.
  expect(getByText(/서빙 단가 미설정/)).toBeTruthy();
});

it('설정된 역할(dealer) 선택 시 JIT 필드가 없다', () => {
  setPoolWithOneStaff();
  const { getByText, queryByText } = renderSheet();

  fireEvent.press(getByText('홍길동'));
  fireEvent.press(getByText('🃏 딜러'));

  // 단가표에 dealer 이미 설정됨 → JIT 미노출.
  expect(queryByText(/단가 미설정/)).toBeNull();
});

it('컨테이너 조회 도착 전(isFetched=false)에는 JIT 필드가 오노출되지 않는다', () => {
  // 로딩 창: data 아직 없음(roleSalaries=[] 로 hasRoleSalary=false) → 기존엔 미설정처럼 오노출.
  // isFetched 게이트로 조회 확정 전에는 JIT 를 띄우지 않는다(MEDIUM 회귀 가드).
  mockUseVenueContainer.mockReturnValue({ data: undefined, isFetched: false });
  setPoolWithOneStaff();
  const { getByText, queryByText } = renderSheet();

  fireEvent.press(getByText('홍길동'));
  fireEvent.press(getByText('🍸 서빙'));

  expect(queryByText(/단가 미설정/)).toBeNull();
});

it('추가 시 단가 먼저 저장 후 슬롯 추가(호출 순서)', async () => {
  setPoolWithOneStaff();
  const { getByText } = renderSheet();

  fireEvent.press(getByText('홍길동'));
  fireEvent.press(getByText('🍸 서빙'));
  // 저장 게이트 통과 — 시간 축을 명시 결정해야 '추가'가 활성화된다(결정 4 · §J).
  fireEvent.press(getByText('미정'));
  fireEvent.press(getByText('추가'));

  await waitFor(() => expect(addStaffMock).toHaveBeenCalled());

  // 단가 저장은 기본 드래프트(시급 20,000)로, 슬롯 추가보다 먼저 호출된다.
  expect(setRoleSalaryMock).toHaveBeenCalledWith({
    venueId: 'venue-1',
    role: 'serving',
    customRole: undefined,
    salary: defaultVenueSalaryDraft('serving'),
  });
  expect(setRoleSalaryMock.mock.invocationCallOrder[0]).toBeLessThan(
    addStaffMock.mock.invocationCallOrder[0]
  );
});

it('단가 저장 실패해도 슬롯 추가는 진행되고 토스트로 안내한다', async () => {
  setPoolWithOneStaff();
  setRoleSalaryMock.mockRejectedValueOnce(new Error('fail'));
  const { getByText } = renderSheet();

  fireEvent.press(getByText('홍길동'));
  fireEvent.press(getByText('🍸 서빙'));
  // 저장 게이트 통과 — 시간 축을 명시 결정해야 '추가'가 활성화된다(결정 4 · §J).
  fireEvent.press(getByText('미정'));
  fireEvent.press(getByText('추가'));

  // 단가 저장이 실패해도 배치는 계속 진행되고, info 토스트로 재안내한다(설계 §B).
  await waitFor(() => expect(addStaffMock).toHaveBeenCalled());
  expect(addToastMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'info' }));
});

it("'기타' 역할 커스텀명 키 입력이 수정한 JIT 단가를 되돌리지 않는다", () => {
  // 회귀: [roleKey, customRole] 의존 effect 가 커스텀명 키 입력마다 jitDraft 를 기본값으로 되돌려
  // 사용자가 수정한 단가가 조용히 소실됐다. 재시드는 roleKey 변경 시에만 일어나야 한다.
  setPoolWithOneStaff();
  const { getByText, getByPlaceholderText, getByLabelText } = renderSheet();

  fireEvent.press(getByText('홍길동'));
  fireEvent.press(getByText('✏️ 기타'));

  // 커스텀명 입력 → JIT 필드 노출(기타는 단가표 미설정 → needsJitSalary).
  fireEvent.changeText(getByPlaceholderText('예: 칩 러너'), 'VIP');

  // 기본 시급 20,000 → +1,000 스텝으로 21,000 으로 수정.
  fireEvent.press(getByLabelText('금액 올리기'));
  expect(getByText('21,000원')).toBeTruthy();

  // 커스텀명을 이어서 입력(키 입력마다 effect 발화) → 수정한 21,000 이 유지되어야 한다.
  fireEvent.changeText(getByPlaceholderText('예: 칩 러너'), 'VIP룸');
  expect(getByText('21,000원')).toBeTruthy();
});
