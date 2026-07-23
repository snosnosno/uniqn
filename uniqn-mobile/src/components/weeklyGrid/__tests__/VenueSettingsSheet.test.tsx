/**
 * VenueSettingsSheet — 지점 역할별 단가표 관리 시트 (JIT 급여 설계 §C, 접점 3)
 *
 * (1) 등록된 역할 행을 라벨+단가로 렌더.
 * (2) 행 삭제 → salary:null 로 mutate(다음 배치 때 JIT 가 다시 물어봄).
 * (3) 빈 단가표는 온보딩 빈 상태(인지+가치+행동)를 노출.
 *
 * SheetModal(RNModal+reanimated)은 형제 시트 테스트(AddSlotSheet)처럼 목.
 * 저장은 실물 훅(useSetVenueRoleSalary)을 쓰되 서비스 경계(gridWriteService.setVenueRoleSalary)를
 * 목해 호출 인자를 검증한다 — jest.setup.js 의 전역 react-query 스텁은 실제 구현으로 복원.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
jest.mock('@/services/weeklyGrid/gridWriteService', () => ({
  setVenueRoleSalary: (...args: unknown[]) => mockSetVenueRoleSalary(...args),
}));

// 토스트 안내는 이 테스트 범위 밖 — 스토어 경계에서 목
const mockAddToast = jest.fn();
jest.mock('@/stores/toastStore', () => ({ useToastStore: () => ({ addToast: mockAddToast }) }));

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
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mockSetVenueRoleSalary.mockClear();
  mockAddToast.mockClear();
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

it('행 삭제 → salary:null 로 mutate', async () => {
  const { getByLabelText } = renderSheet(
    <VenueSettingsSheet visible onClose={jest.fn()} container={container as never} />
  );
  fireEvent.press(getByLabelText('딜러 단가 삭제'));
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
