/**
 * PayoutLedger — S1 C4 상금 지급 완료 토글(undo-first) 배선 회귀.
 * PrizeCorrectSheet(SheetModal 계열)는 가벼운 모킹으로 대체하고 props 배선만 확인한다.
 * 훅(useOpsPrizes/useOpsParticipants/useSetPrizePaid)은 전량 mock — 순수 UI 동작만 단언.
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { PayoutLedger } from '../PayoutLedger';
import { useOpsPrizes, useOpsParticipants, useSetPrizePaid } from '@/hooks/ops';
import type { OpsParticipant, OpsPrize, OpsTournament } from '@/types/ops';

jest.mock('@/hooks/ops', () => ({
  useOpsPrizes: jest.fn(),
  useOpsParticipants: jest.fn(),
  useSetPrizePaid: jest.fn(),
}));

// 행 탭 → 정정 시트 진입(회귀) 확인용 경량 모킹.
let sheetProps: Record<string, unknown> | null = null;
jest.mock('../PrizeCorrectSheet', () => {
  const { Text } = require('react-native');
  return {
    PrizeCorrectSheet: (props: Record<string, unknown>) => {
      sheetProps = props;
      const p = props.participant as { id: string } | null;
      return props.visible && p ? <Text>{`정정시트-${p.id}`}</Text> : null;
    },
  };
});

const mockUseOpsPrizes = useOpsPrizes as unknown as jest.Mock;
const mockUseOpsParticipants = useOpsParticipants as unknown as jest.Mock;
const mockUseSetPrizePaid = useSetPrizePaid as unknown as jest.Mock;

const prize = (rank: number, amount: number): OpsPrize =>
  ({ id: `z${rank}`, tournamentId: 't1', rank, amount }) as OpsPrize;

const part = (over: Partial<OpsParticipant>): OpsParticipant =>
  ({
    id: 'p',
    tournamentId: 't1',
    name: '무명',
    entryNumber: 1,
    viewToken: null,
    status: 'busted',
    chips: 0,
    rebuys: 0,
    addOns: 0,
    reentries: 0,
    knockouts: 0,
    finishPosition: null,
    prizeAmount: null,
    prizePaidAt: null,
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as OpsParticipant;

const TOURNAMENT = { id: 't1', bountyCost: null } as OpsTournament;

// 1위 앨리스(미지급) · 2위 밥(지급완료) · 3위 찰리(상금 미배정 — 토글 미노출 대상)
const PARTS: OpsParticipant[] = [
  part({ id: 'a', name: '앨리스', finishPosition: 1, prizeAmount: 1000000, prizePaidAt: null }),
  part({
    id: 'b',
    name: '밥',
    finishPosition: 2,
    prizeAmount: 500000,
    prizePaidAt: '2026-07-17T00:00:00.000Z',
  }),
  part({ id: 'c', name: '찰리', finishPosition: 3, prizeAmount: null, prizePaidAt: null }),
];

let mockMutate: jest.Mock;

function setup(over?: { isPending?: boolean; variables?: unknown }) {
  mockMutate = jest.fn();
  mockUseOpsPrizes.mockReturnValue({
    prizes: [prize(1, 1000000), prize(2, 500000)],
    isLoading: false,
  });
  mockUseOpsParticipants.mockReturnValue({ participants: PARTS, isLoading: false });
  mockUseSetPrizePaid.mockReturnValue({
    mutate: mockMutate,
    isPending: over?.isPending ?? false,
    variables: over?.variables,
  });
}

beforeEach(() => {
  sheetProps = null;
  jest.clearAllMocks();
});

it('상금 배정된 미지급 행: 지급 토글 → mutate({paid:true}) 호출·확인 다이얼로그 없음', () => {
  const alertSpy = jest.spyOn(Alert, 'alert');
  setup();
  const { getByLabelText } = render(<PayoutLedger tournament={TOURNAMENT} />);

  fireEvent.press(getByLabelText('1위 지급 완료'));

  expect(mockMutate).toHaveBeenCalledTimes(1);
  expect(mockMutate).toHaveBeenCalledWith({ participantId: 'a', paid: true });
  expect(alertSpy).not.toHaveBeenCalled();
});

it('지급 완료 행: 지급 토글 → mutate({paid:false}) 로 왕복 해제', () => {
  setup();
  const { getByLabelText } = render(<PayoutLedger tournament={TOURNAMENT} />);

  fireEvent.press(getByLabelText('2위 지급 완료'));

  expect(mockMutate).toHaveBeenCalledWith({ participantId: 'b', paid: false });
});

it('상금 미배정 행(prizeAmount null): 토글 미노출 — RPC 거부 상태 선차단', () => {
  setup();
  const { queryByLabelText } = render(<PayoutLedger tournament={TOURNAMENT} />);

  expect(queryByLabelText('3위 지급 완료')).toBeNull();
});

it('행 본문 탭 → PrizeCorrectSheet 진입(회귀 없음)', () => {
  setup();
  const { getByText } = render(<PayoutLedger tournament={TOURNAMENT} />);

  fireEvent.press(getByText('1위 · 앨리스'));

  expect(getByText('정정시트-a')).toBeTruthy();
  expect(sheetProps).toMatchObject({ visible: true });
  expect(mockMutate).not.toHaveBeenCalled(); // 행 탭이 지급 mutate 를 유발하지 않음
});

it('pending 중인 행 토글은 disabled(연타 무시)·다른 행은 정상 동작', () => {
  setup({ isPending: true, variables: { participantId: 'a', paid: true } });
  const { getByLabelText } = render(<PayoutLedger tournament={TOURNAMENT} />);

  // 진행 중인 앨리스(a) 행 — 연타해도 재호출 없음
  fireEvent.press(getByLabelText('1위 지급 완료'));
  expect(mockMutate).not.toHaveBeenCalled();

  // pending 은 해당 행 한정 — 밥(b) 행은 여전히 눌림
  fireEvent.press(getByLabelText('2위 지급 완료'));
  expect(mockMutate).toHaveBeenCalledWith({ participantId: 'b', paid: false });
});
