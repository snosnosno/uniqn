/**
 * AddSlotSheet — 콜드스타트 CTA(P0-2) + 구조화 시간대 프리뷰 테스트
 *
 * (1) 확정 풀이 빈 상태(신규 운영자 첫 상태)에서 빈상태가 죽은 안내문이 아니라 행동 가능한
 *     CTA 2개를 제공하는지: "공고로 모집하기" → 공고 작성 라우트로 venueId 를 실어 이동+시트 닫힘,
 *     "전화번호로 찾기" → 전화검색 모드 전환(검색 입력 노출).
 * (2) 풀에서 인원을 고르면 자유 텍스트가 아닌 시작/종료 구조화 입력 + 익일 프리뷰(총 8시간)를 보여주는지.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { AddSlotSheet } from '../AddSlotSheet';
import { useConfirmedStaff } from '@/hooks/useConfirmedStaff';
import { useStaffPhoneSearch } from '@/hooks/useStaffPhoneSearch';

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
jest.mock('@/hooks/useStaffPhoneSearch', () => ({ useStaffPhoneSearch: jest.fn() }));

const mockUseConfirmedStaff = useConfirmedStaff as unknown as jest.Mock;
const mockUsePhoneSearch = useStaffPhoneSearch as unknown as jest.Mock;

beforeEach(() => {
  mockPush.mockReset();
  // 콜드스타트: 확정 풀 0명
  mockUseConfirmedStaff.mockReturnValue({
    staff: [],
    isLoading: false,
    addStaff: jest.fn(),
    isAddingStaff: false,
  });
  mockUsePhoneSearch.mockReturnValue({
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

it('빈 풀 빈상태에 CTA 2개(공고로 모집하기/전화번호로 찾기) 렌더', () => {
  const { getByText } = renderSheet();

  expect(getByText('공고로 모집하기')).toBeTruthy();
  expect(getByText('전화번호로 찾기')).toBeTruthy();
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

it('"전화번호로 찾기" 탭 → 전화검색 모드 전환(검색 입력 노출)', () => {
  const { getByText, getByPlaceholderText } = renderSheet();

  fireEvent.press(getByText('전화번호로 찾기'));

  expect(getByPlaceholderText('등록된 전화번호 전체 입력')).toBeTruthy();
});

it('풀에서 인원 선택 → 시작/종료 구조화 입력 + 익일 프리뷰(총 8시간) 노출', () => {
  // 확정 풀에 1명 존재 → 선택하면 배정 입력(시간대 프리뷰)이 나타난다.
  mockUseConfirmedStaff.mockReturnValue({
    staff: [{ staffId: 'staff-9', staffName: '홍길동', staffPhotoURL: null, role: 'dealer' }],
    isLoading: false,
    addStaff: jest.fn(),
    isAddingStaff: false,
  });

  const { getByText } = renderSheet();

  // 후보행(이름) 탭 → picked 설정 → 기본 시간대(18:00~02:00) 프리뷰 렌더
  fireEvent.press(getByText('홍길동'));

  // 자유 텍스트 플레이스홀더가 아니라 익일 프리뷰(총 8시간)를 보여준다.
  expect(getByText(/익일/)).toBeTruthy();
  expect(getByText(/8시간/)).toBeTruthy();
});
