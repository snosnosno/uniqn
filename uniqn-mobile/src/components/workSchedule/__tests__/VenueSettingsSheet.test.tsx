/**
 * VenueSettingsSheet — 지점 역할별 단가표 관리 시트 (JIT 급여 설계 §C, 접점 3)
 *
 * (1) 등록된 역할 행을 라벨+단가로 렌더.
 * (2) 행 삭제 → 확인(confirmAction) 후에만 salary:null 로 mutate(다음 배치 때 JIT 가 다시 물어봄).
 * (3) 빈 단가표는 온보딩 빈 상태(인지+가치+행동)를 노출.
 * (4) 폼 상태(편집/추가)는 닫기·지점 변경을 넘어 잔존하지 않는다(stale 오기록 차단).
 * (5) 추가 폼은 저장 외에 취소로도 벗어날 수 있다.
 *
 * SheetModal(RNModal+reanimated)은 형제 시트 테스트(AddSlotSheet)처럼 목.
 * 저장은 실물 훅(useSetVenueRoleSalary)을 쓰되 서비스 경계(gridWriteService.setVenueRoleSalary)를
 * 목해 호출 인자를 검증한다 — jest.setup.js 의 전역 react-query 스텁은 실제 구현으로 복원.
 * 삭제 확인(confirmAction)은 형제 테스트(VenueDayPanel) 관용구대로 목해 onConfirm 을 직접 호출.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { confirmAction } from '@/utils/confirmAction';
import { VenueSettingsSheet } from '../VenueSettingsSheet';

// jest.setup.js 전역 react-query 스텁(useMutation no-op) 복원 — 실물 mutateAsync 로 서비스 호출 검증
jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

// 무거운 의존(SheetModal=RNModal+reanimated) 목: visible 일 때 children/footer/overlay 렌더
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

// 저장 경로: 서비스 경계를 목해 (venueId, input) 인자를 검증(실물 훅이 spread 를 담당)
// (jest.mock 팩토리는 `mock` 접두 변수만 참조 허용)
const mockSetVenueRoleSalary = jest.fn().mockResolvedValue(undefined);
jest.mock('@/services/workSchedule/gridWriteService', () => ({
  setVenueRoleSalary: (...args: unknown[]) => mockSetVenueRoleSalary(...args),
}));

// 토스트 안내는 이 테스트 범위 밖 — 스토어 경계에서 목
const mockAddToast = jest.fn();
jest.mock('@/stores/toastStore', () => ({ useToastStore: () => ({ addToast: mockAddToast }) }));

// 삭제 확인 다이얼로그는 목 — onConfirm 을 테스트에서 직접 발화해 확인-통과 흐름 검증
jest.mock('@/utils/confirmAction', () => ({ confirmAction: jest.fn() }));
const mockConfirmAction = confirmAction as unknown as jest.Mock;

const container = {
  id: 'v1',
  name: '강남점',
  workspaceId: 'w1',
  ownerId: 'u1',
  venueId: 'v1',
  kind: 'dated',
  softTargets: {},
  roleSalaries: [
    { role: 'dealer', salary: { type: 'hourly', amount: 20000 } },
    { role: 'other', customRole: '칩 러너', salary: { type: 'daily', amount: 150000 } },
  ],
};

function renderSheet(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return render(ui, { wrapper });
}

beforeEach(() => {
  mockSetVenueRoleSalary.mockClear();
  mockAddToast.mockClear();
  mockConfirmAction.mockReset();
});

it('등록된 역할 행을 라벨+단가로 렌더한다', () => {
  const { getByText } = renderSheet(
    <VenueSettingsSheet visible onClose={jest.fn()} container={container as never} />
  );
  expect(getByText('딜러')).toBeTruthy();
  expect(getByText('시급 20,000원')).toBeTruthy();
  expect(getByText('칩 러너')).toBeTruthy();
  expect(getByText('일급 150,000원')).toBeTruthy();
});

it('행 삭제는 확인을 거친 뒤 salary:null 로 mutate', async () => {
  const { getByLabelText } = renderSheet(
    <VenueSettingsSheet visible onClose={jest.fn()} container={container as never} />
  );
  fireEvent.press(getByLabelText('딜러 단가 삭제'));

  // 확인 다이얼로그가 뜨고, 확인 전에는 삭제가 실행되지 않는다.
  expect(mockConfirmAction).toHaveBeenCalledTimes(1);
  expect(mockSetVenueRoleSalary).not.toHaveBeenCalled();
  const opts = mockConfirmAction.mock.calls[0][0];
  expect(opts.message).toContain('딜러');

  // 확인 → 실제 삭제 실행.
  opts.onConfirm();
  await waitFor(() =>
    expect(mockSetVenueRoleSalary).toHaveBeenCalledWith('v1', {
      role: 'dealer',
      customRole: undefined,
      salary: null,
    })
  );
});

it('빈 단가표는 온보딩 빈 상태(인지+가치+행동)를 보여준다', () => {
  const { getByText } = renderSheet(
    <VenueSettingsSheet
      visible
      onClose={jest.fn()}
      container={{ ...container, roleSalaries: [] } as never}
    />
  );
  expect(getByText(/아직 설정된 단가가 없어요/)).toBeTruthy();
  expect(getByText(/배치할 때 자동으로 물어봐요/)).toBeTruthy();
});

it('시트를 닫았다 다시 열면 편집 폼 상태가 리셋된다', () => {
  const { getByLabelText, queryByText, rerender } = renderSheet(
    <VenueSettingsSheet visible onClose={jest.fn()} container={container as never} />
  );
  // 편집 진입 → 저장 버튼(편집 폼 마커) 노출.
  fireEvent.press(getByLabelText('딜러 단가 수정'));
  expect(queryByText('단가 저장')).toBeTruthy();

  // 닫았다가(visible=false) 다시 연다(visible=true).
  rerender(
    <VenueSettingsSheet visible={false} onClose={jest.fn()} container={container as never} />
  );
  rerender(<VenueSettingsSheet visible onClose={jest.fn()} container={container as never} />);

  // 편집 폼이 잔존하지 않는다.
  expect(queryByText('단가 저장')).toBeNull();
});

it('지점(container)이 바뀌면 편집 폼 상태가 리셋된다', () => {
  const { getByLabelText, queryByText, rerender } = renderSheet(
    <VenueSettingsSheet visible onClose={jest.fn()} container={container as never} />
  );
  fireEvent.press(getByLabelText('딜러 단가 수정'));
  expect(queryByText('단가 저장')).toBeTruthy();

  // 다른 지점으로 교체 — 잔존 editDraft 가 새 지점에 프리필되면 안 된다.
  const other = { ...container, id: 'v2', name: '역삼점' };
  rerender(<VenueSettingsSheet visible onClose={jest.fn()} container={other as never} />);

  expect(queryByText('단가 저장')).toBeNull();
});

it('추가 폼은 취소로 벗어날 수 있다', () => {
  const { getByText, getByLabelText, queryByText } = renderSheet(
    <VenueSettingsSheet visible onClose={jest.fn()} container={container as never} />
  );
  // 추가 폼 진입 → 제출 버튼(폼 마커) 노출.
  fireEvent.press(getByText('역할 추가'));
  expect(queryByText('단가 추가')).toBeTruthy();

  // 취소 → 폼이 닫히고 진입 버튼으로 복귀.
  fireEvent.press(getByLabelText('역할 추가 취소'));
  expect(queryByText('단가 추가')).toBeNull();
  expect(getByText('역할 추가')).toBeTruthy();
});
