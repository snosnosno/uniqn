/**
 * TablesTab — 1e "딜러 지정" 액션 배선 회귀.
 * 무거운 의존(SelectBottomSheet=@gorhom/bottom-sheet 실물은 BottomSheetModalProvider 부재로
 * jest 렌더 불가 — probe 로 확인됨)과 RedrawModal(BottomSheet 동일 계열)은 가벼운 모킹으로 대체한다.
 * DealerPickerSheet 는 이 테스트에서 "배선"(visible/tableId/currentStaffId 전달)만 검증하고,
 * 정렬·해제옵션·mutate 인자 등 자체 로직은 DealerPickerSheet.test.tsx 가 전담한다.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { TablesTab } from '../TablesTab';
import {
  useOpsTournament,
  useOpsTables,
  useOpsSeats,
  useOpsParticipants,
  useOpsStaff,
  useAddTable,
  useSetTableLock,
  useSetTablePriority,
  useCloseTable,
  useAssignSeat,
  useMoveSeat,
  useFreeSeat,
} from '@/hooks/ops';
import type { OpsTable, OpsStaff } from '@/types/ops';

jest.mock('@/components/ui', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    // OpsParticipantActionSheet 가 소비 — 자식 통과 스텁(좌석 진입 액션시트 배선).
    SheetModal: ({ visible, children }: any) => (visible ? <View>{children}</View> : null),
    SelectBottomSheet: ({ visible, title, options, onSelect, onClose }: any) =>
      visible ? (
        <View>
          {title ? <Text>{title}</Text> : null}
          {options.map((o: any) => (
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
      ) : null,
  };
});

jest.mock('../RedrawModal', () => ({ RedrawModal: () => null }));

let dealerPickerProps: Record<string, unknown> | null = null;
jest.mock('../DealerPickerSheet', () => {
  const { Text } = require('react-native');
  return {
    DealerPickerSheet: (props: Record<string, unknown>) => {
      dealerPickerProps = props;
      return props.visible ? <Text>{`딜러피커열림-${props.tableId}`}</Text> : null;
    },
  };
});

jest.mock('@/hooks/ops', () => ({
  useOpsTournament: jest.fn(),
  useOpsTables: jest.fn(),
  useOpsSeats: jest.fn(),
  useOpsParticipants: jest.fn(),
  useOpsStaff: jest.fn(),
  useAddTable: jest.fn(),
  useSetTableLock: jest.fn(),
  useSetTablePriority: jest.fn(),
  useCloseTable: jest.fn(),
  useAssignSeat: jest.fn(),
  useMoveSeat: jest.fn(),
  useFreeSeat: jest.fn(),
  // 좌석 진입 액션시트(OpsParticipantActionSheet)가 호출하는 mutation 훅 — 렌더 시 undefined 방지.
  useAddRebuy: jest.fn(() => ({ mutate: jest.fn() })),
  useAddAddon: jest.fn(() => ({ mutate: jest.fn() })),
  useBustParticipant: jest.fn(() => ({ mutate: jest.fn() })),
  useReenterParticipant: jest.fn(() => ({ mutate: jest.fn() })),
  useUndoBust: jest.fn(() => ({ mutate: jest.fn() })),
}));

const mockUseOpsTournament = useOpsTournament as unknown as jest.Mock;
const mockUseOpsTables = useOpsTables as unknown as jest.Mock;
const mockUseOpsSeats = useOpsSeats as unknown as jest.Mock;
const mockUseOpsParticipants = useOpsParticipants as unknown as jest.Mock;
const mockUseOpsStaff = useOpsStaff as unknown as jest.Mock;
const mockUseAddTable = useAddTable as unknown as jest.Mock;
const mockUseSetTableLock = useSetTableLock as unknown as jest.Mock;
const mockUseSetTablePriority = useSetTablePriority as unknown as jest.Mock;
const mockUseCloseTable = useCloseTable as unknown as jest.Mock;
const mockUseAssignSeat = useAssignSeat as unknown as jest.Mock;
const mockUseMoveSeat = useMoveSeat as unknown as jest.Mock;
const mockUseFreeSeat = useFreeSeat as unknown as jest.Mock;

const TABLE: OpsTable = {
  id: 'tb1',
  tournamentId: 'trn1',
  tableNo: 1,
  name: null,
  status: 'open',
  assignedStaffId: 'u-dealer',
  lockType: 'none',
  priority: null,
  position: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

const ROSTER: OpsStaff[] = [
  {
    id: 'os1',
    tournamentId: 'trn1',
    staffId: 'u-dealer',
    role: 'dealer',
    customRole: null,
    staffName: '이딜러',
    staffNickname: null,
    source: 'manual',
    sourceWorkLogId: null,
    createdAt: '2026-07-01T00:00:00.000Z',
  },
];

function setupHooks(tableOverrides?: Partial<OpsTable>): OpsTable {
  const table = { ...TABLE, ...tableOverrides };
  mockUseOpsTournament.mockReturnValue({
    tournament: { id: 'trn1', status: 'active', bountyCost: null },
  });
  mockUseOpsTables.mockReturnValue({ tables: [table], isLoading: false });
  mockUseOpsSeats.mockReturnValue({ seats: [] });
  mockUseOpsParticipants.mockReturnValue({ participants: [] });
  mockUseOpsStaff.mockReturnValue({ data: ROSTER });
  mockUseAddTable.mockReturnValue({ mutate: jest.fn(), isPending: false });
  mockUseSetTableLock.mockReturnValue({ mutate: jest.fn() });
  mockUseSetTablePriority.mockReturnValue({ mutate: jest.fn() });
  mockUseCloseTable.mockReturnValue({ mutate: jest.fn() });
  mockUseAssignSeat.mockReturnValue({ mutate: jest.fn() });
  mockUseMoveSeat.mockReturnValue({ mutate: jest.fn() });
  mockUseFreeSeat.mockReturnValue({ mutate: jest.fn() });
  return table;
}

beforeEach(() => {
  dealerPickerProps = null;
  jest.clearAllMocks();
});

it('테이블 상세의 "딜러 지정" 버튼을 누르면 DealerPickerSheet 를 tableId/currentStaffId 와 함께 연다', () => {
  const table = setupHooks();

  const { getByText, getByLabelText } = render(<TablesTab tournamentId="trn1" />);

  // 목록 뷰 → 행 프레스로 상세 진입
  fireEvent.press(getByText('테이블 1'));

  // 잠금/우선순위 문형 복제로 추가된 "딜러 지정" 액션 진입점
  fireEvent.press(getByLabelText('딜러 지정'));

  expect(dealerPickerProps).toMatchObject({
    visible: true,
    tournamentId: 'trn1',
    tableId: table.id,
    currentStaffId: 'u-dealer',
  });
  expect(getByText(`딜러피커열림-${table.id}`)).toBeTruthy();
});

it('assignedStaffId 가 없으면 딜러 버튼에 "미지정"을 표시하고 currentStaffId=null 로 연다', () => {
  setupHooks({ assignedStaffId: null });

  const { getByText, getByLabelText } = render(<TablesTab tournamentId="trn1" />);
  fireEvent.press(getByText('테이블 1'));

  expect(getByText('미지정')).toBeTruthy();

  fireEvent.press(getByLabelText('딜러 지정'));
  expect(dealerPickerProps).toMatchObject({ currentStaffId: null });
});

it('로스터에 있는 딜러가 배정되면 버튼에 해당 이름을 표시한다', () => {
  setupHooks();

  const { getByText } = render(<TablesTab tournamentId="trn1" />);
  fireEvent.press(getByText('테이블 1'));

  expect(getByText('이딜러')).toBeTruthy();
});
