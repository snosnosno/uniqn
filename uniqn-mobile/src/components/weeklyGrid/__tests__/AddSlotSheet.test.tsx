/**
 * AddSlotSheet — 콜드스타트 CTA(P0-2) + 출근시간 단일 입력/미정 테스트(Task 8b)
 *
 * (1) 확정 풀이 빈 상태(신규 운영자 첫 상태)에서 빈상태가 죽은 안내문이 아니라 행동 가능한
 *     CTA 2개를 제공하는지: "공고로 모집하기" → 공고 작성 라우트로 venueId 를 실어 이동+시트 닫힘,
 *     "닉네임으로 찾기" → 닉네임검색 모드 전환(검색 입력 노출).
 * (2) 풀에서 인원을 고르면 종료 필드·익일 프리뷰가 아니라 **출근시간(start) 단일 필드 + 미정 토글**을
 *     보여주는지(형제 AddStaffModal·지원/확정 모델과 정합). 미정 토글 시 트리거가 '미정'으로 전환되는지.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { AddSlotSheet } from '../AddSlotSheet';
import { useConfirmedStaff } from '@/hooks/useConfirmedStaff';
import { useStaffNicknameSearch } from '@/hooks/useStaffNicknameSearch';

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

const mockUseConfirmedStaff = useConfirmedStaff as unknown as jest.Mock;
const mockUseNicknameSearch = useStaffNicknameSearch as unknown as jest.Mock;

beforeEach(() => {
  mockPush.mockReset();
  // 콜드스타트: 확정 풀 0명
  mockUseConfirmedStaff.mockReturnValue({
    staff: [],
    isLoading: false,
    addStaff: jest.fn(),
    isAddingStaff: false,
  });
  mockUseNicknameSearch.mockReturnValue({
    reset: jest.fn(),
    search: jest.fn(),
    isSearching: false,
    searched: false,
    results: [],
  });
});

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

  // 후보행(이름) 탭 → picked 설정 → 출근시간 필드(기본 18:00 = 오후 6:00) 렌더
  fireEvent.press(getByText('홍길동'));

  // 출근시간 라벨 + 기본 시각 표시. 종료 필드/익일 프리뷰는 이 화면에서 제거됨.
  expect(getByText('출근 시간')).toBeTruthy();
  expect(getByText('오후 6:00')).toBeTruthy();
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
  // 토글 전: 미정 라벨(체크박스)만 1개, 구체 시각 노출.
  expect(getAllByText('미정')).toHaveLength(1);
  expect(getByText('오후 6:00')).toBeTruthy();

  // '미정' 체크박스 탭 → 트리거도 '미정' 표시(라벨+트리거 = 2개), 구체 시각 숨김.
  fireEvent.press(getByText('미정'));
  expect(getAllByText('미정')).toHaveLength(2);
  expect(queryByText('오후 6:00')).toBeNull();
});
