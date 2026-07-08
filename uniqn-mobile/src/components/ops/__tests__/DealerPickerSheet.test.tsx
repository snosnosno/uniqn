/**
 * DealerPickerSheet — 1e 딜러 지정 피커 테스트.
 *
 * SelectBottomSheet(@gorhom/bottom-sheet 실물, BottomSheetModalProvider 부재로 jest 렌더 불가 —
 * probe 로 'BottomSheetModalInternalContext' cannot be null! 확인)는 VenueCreateSheet.test.tsx
 * 문형대로 가벼운 옵션 목록 렌더로 모킹한다. useOpsStaff/useAssignTableStaff 도 모킹.
 * 검증: (1) 딜러 우선 정렬, (2) 배정 해제 노출 조건(currentStaffId 유무), (3) 선택 시 mutate 인자.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { DealerPickerSheet } from '../DealerPickerSheet';
import { useOpsStaff, useAssignTableStaff } from '@/hooks/ops';
import type { OpsStaff } from '@/types/ops';

type CapturedOption = { label: string; value: string; disabled?: boolean; destructive?: boolean };
let capturedOptions: CapturedOption[] = [];

// 무거운 의존(SelectBottomSheet=@gorhom/bottom-sheet) 모킹: visible 일 때 옵션을 버튼 목록으로 렌더.
// 실제 SelectBottomSheet 와 동일하게 onSelect 후 onClose 를 호출한다.
jest.mock('@/components/ui', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    SelectBottomSheet: ({ visible, title, options, onSelect, onClose }: any) => {
      capturedOptions = options;
      if (!visible) return null;
      return (
        <View>
          {title ? <Text>{title}</Text> : null}
          {options.map((o: CapturedOption) => (
            <Pressable
              key={o.value}
              accessibilityRole="button"
              disabled={o.disabled}
              onPress={() => {
                if (o.disabled) return;
                onSelect(o.value);
                onClose();
              }}
            >
              <Text>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      );
    },
  };
});

jest.mock('@/hooks/ops', () => ({
  useOpsStaff: jest.fn(),
  useAssignTableStaff: jest.fn(),
}));

const mockUseOpsStaff = useOpsStaff as unknown as jest.Mock;
const mockUseAssignTableStaff = useAssignTableStaff as unknown as jest.Mock;

function staff(overrides: Partial<OpsStaff>): OpsStaff {
  return {
    id: `os-${overrides.staffId}`,
    tournamentId: 'trn1',
    staffId: 'u0',
    role: 'staff',
    customRole: null,
    staffName: '무명',
    staffNickname: null,
    source: 'manual',
    sourceWorkLogId: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

// 등록 순서는 일부러 딜러가 아닌 역할부터 — 정렬 로직이 실제로 동작해야 딜러가 앞으로 온다.
const roster: OpsStaff[] = [
  staff({ staffId: 'u-floor', role: 'floor', staffName: '김플로어' }),
  staff({ staffId: 'u-dealer', role: 'dealer', staffName: '이딜러' }),
  staff({ staffId: 'u-serving', role: 'serving', staffName: '박서빙' }),
];

beforeEach(() => {
  capturedOptions = [];
  mockUseOpsStaff.mockReset();
  mockUseAssignTableStaff.mockReset();
});

it('로스터를 딜러 우선으로 정렬한다(role==="dealer" 옵션이 최상단, 배정해제 옵션 제외)', () => {
  mockUseOpsStaff.mockReturnValue({ data: roster });
  mockUseAssignTableStaff.mockReturnValue({ mutate: jest.fn() });

  render(
    <DealerPickerSheet
      visible
      tournamentId="trn1"
      tableId="tb1"
      currentStaffId={null}
      onClose={jest.fn()}
    />
  );

  expect(capturedOptions[0].value).toBe('u-dealer');
  expect(capturedOptions[0].label).toContain('이딜러');
});

it('currentStaffId 가 없으면 "배정 해제" 옵션을 노출하지 않는다', () => {
  mockUseOpsStaff.mockReturnValue({ data: roster });
  mockUseAssignTableStaff.mockReturnValue({ mutate: jest.fn() });

  const { queryByText } = render(
    <DealerPickerSheet
      visible
      tournamentId="trn1"
      tableId="tb1"
      currentStaffId={null}
      onClose={jest.fn()}
    />
  );

  expect(queryByText('배정 해제')).toBeNull();
});

it('currentStaffId 가 있으면 "배정 해제"(destructive) 옵션을 최상단에 노출하고 현재 배정자에 "(현재)" 라벨을 붙인다', () => {
  mockUseOpsStaff.mockReturnValue({ data: roster });
  mockUseAssignTableStaff.mockReturnValue({ mutate: jest.fn() });

  const { getByText } = render(
    <DealerPickerSheet
      visible
      tournamentId="trn1"
      tableId="tb1"
      currentStaffId="u-dealer"
      onClose={jest.fn()}
    />
  );

  expect(getByText('배정 해제')).toBeTruthy();
  expect(capturedOptions[0]).toMatchObject({ value: '__unassign', destructive: true });
  // (T7-M1) 현재 배정자(u-dealer=이딜러) 옵션 라벨에 "(현재)" 접미 렌더 단언.
  expect(getByText(/이딜러 \(현재\)/)).toBeTruthy();
});

it('스태프 옵션 선택 시 {tableId, staffId} 로 assign mutation 을 호출한다', () => {
  const mutate = jest.fn();
  mockUseOpsStaff.mockReturnValue({ data: roster });
  mockUseAssignTableStaff.mockReturnValue({ mutate });

  const { getByText } = render(
    <DealerPickerSheet
      visible
      tournamentId="trn1"
      tableId="tb1"
      currentStaffId={null}
      onClose={jest.fn()}
    />
  );

  fireEvent.press(getByText(/이딜러/));

  expect(mutate).toHaveBeenCalledWith({ tableId: 'tb1', staffId: 'u-dealer' });
});

it('"배정 해제" 선택 시 staffId=null 로 assign mutation 을 호출한다', () => {
  const mutate = jest.fn();
  mockUseOpsStaff.mockReturnValue({ data: roster });
  mockUseAssignTableStaff.mockReturnValue({ mutate });

  const { getByText } = render(
    <DealerPickerSheet
      visible
      tournamentId="trn1"
      tableId="tb1"
      currentStaffId="u-dealer"
      onClose={jest.fn()}
    />
  );

  fireEvent.press(getByText('배정 해제'));

  expect(mutate).toHaveBeenCalledWith({ tableId: 'tb1', staffId: null });
});

it('로스터가 비어 있으면 비활성 안내 옵션만 노출한다', () => {
  mockUseOpsStaff.mockReturnValue({ data: [] });
  mockUseAssignTableStaff.mockReturnValue({ mutate: jest.fn() });

  const { getByText } = render(
    <DealerPickerSheet
      visible
      tournamentId="trn1"
      tableId="tb1"
      currentStaffId={null}
      onClose={jest.fn()}
    />
  );

  expect(getByText('등록된 로스터가 없습니다')).toBeTruthy();
  expect(capturedOptions).toEqual([
    { label: '등록된 로스터가 없습니다', value: '__none', disabled: true },
  ]);
});
