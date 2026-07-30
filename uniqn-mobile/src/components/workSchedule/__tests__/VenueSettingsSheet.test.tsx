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
import { ValidationError, ERROR_CODES } from '@/errors';
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
const mockUpdateVenueContainer = jest.fn().mockResolvedValue(undefined);
jest.mock('@/services/workSchedule/gridWriteService', () => ({
  setVenueRoleSalary: (...args: unknown[]) => mockSetVenueRoleSalary(...args),
  updateVenueContainer: (...args: unknown[]) => mockUpdateVenueContainer(...args),
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
  location: { name: '강남역 2번 출구' },
  contactPhone: '02-123-4567',
  description: null,
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
  mockUpdateVenueContainer.mockClear();
  mockAddToast.mockClear();
  mockConfirmAction.mockReset();
});

// S1 — 지점 정보 섹션. 이 값들이 배치된 스태프의 근무 상세에 그대로 보인다.
describe('지점 정보 섹션(S1)', () => {
  it('저장된 지점명·장소·연락처로 프리필한다', () => {
    const { getByDisplayValue } = renderSheet(
      <VenueSettingsSheet visible onClose={jest.fn()} container={container as never} />
    );
    expect(getByDisplayValue('강남점')).toBeTruthy();
    expect(getByDisplayValue('강남역 2번 출구')).toBeTruthy();
    expect(getByDisplayValue('02-123-4567')).toBeTruthy();
  });

  it('바뀐 값이 없으면 저장이 발사되지 않는다(불필요한 쓰기·알림 방지)', async () => {
    const { getByText } = renderSheet(
      <VenueSettingsSheet visible onClose={jest.fn()} container={container as never} />
    );
    fireEvent.press(getByText('지점 정보 저장'));

    await waitFor(() => expect(mockUpdateVenueContainer).not.toHaveBeenCalled());
  });

  it('지점명을 고치면 trim 된 값으로 서비스가 호출된다', async () => {
    const { getByDisplayValue, getByText } = renderSheet(
      <VenueSettingsSheet visible onClose={jest.fn()} container={container as never} />
    );
    fireEvent.changeText(getByDisplayValue('강남점'), '  홀덤펍 강남점  ');
    fireEvent.press(getByText('지점 정보 저장'));

    await waitFor(() => expect(mockUpdateVenueContainer).toHaveBeenCalledTimes(1));
    expect(mockUpdateVenueContainer).toHaveBeenCalledWith('v1', {
      name: '홀덤펍 강남점',
      location: { name: '강남역 2번 출구' },
      contactPhone: '02-123-4567',
    });
  });

  // 서버 규약상 ''=제거다. 사용자가 칸을 비운 행위가 undefined 로 뭉개지면 조용히 안 지워진다.
  it('연락처를 비우면 빈 문자열(=제거 신호)로 보낸다', async () => {
    const { getByDisplayValue, getByText } = renderSheet(
      <VenueSettingsSheet visible onClose={jest.fn()} container={container as never} />
    );
    fireEvent.changeText(getByDisplayValue('02-123-4567'), '');
    fireEvent.press(getByText('지점 정보 저장'));

    await waitFor(() => expect(mockUpdateVenueContainer).toHaveBeenCalledTimes(1));
    expect(mockUpdateVenueContainer.mock.calls[0][1].contactPhone).toBe('');
  });

  // 🔴 서버 사유가 도달하는지 확인하려면 **실물 AppError** 를 던져야 한다. 평문 객체에
  //    `isAppError: true` 를 얹으면 브랜드 검사(__isAppError)를 통과하지 못해 폴백 분기만 타고,
  //    폴백 문구에도 '지점'이 들어 있어서 매핑이 통째로 없어도 green 이 된다(vacuous).
  //    그래서 실물 ValidationError + 폴백 문구에 없는 문자열로 단언한다.
  it('동명 지점 등 서버 사유는 뭉개지 않고 그대로 안내한다', async () => {
    mockUpdateVenueContainer.mockRejectedValueOnce(
      new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: '같은 이름의 지점이 이미 있습니다',
      })
    );
    const { getByDisplayValue, getByText } = renderSheet(
      <VenueSettingsSheet visible onClose={jest.fn()} container={container as never} />
    );
    fireEvent.changeText(getByDisplayValue('강남점'), '홍대점');
    fireEvent.press(getByText('지점 정보 저장'));

    await waitFor(() => expect(mockAddToast).toHaveBeenCalled());
    expect(mockAddToast.mock.calls.at(-1)?.[0].message).toBe('같은 이름의 지점이 이미 있습니다');
  });

  it('사유를 모르는 실패는 일반 안내로 내려간다(대조군)', async () => {
    mockUpdateVenueContainer.mockRejectedValueOnce(new Error('boom'));
    const { getByDisplayValue, getByText } = renderSheet(
      <VenueSettingsSheet visible onClose={jest.fn()} container={container as never} />
    );
    fireEvent.changeText(getByDisplayValue('강남점'), '홍대점');
    fireEvent.press(getByText('지점 정보 저장'));

    await waitFor(() => expect(mockAddToast).toHaveBeenCalled());
    expect(mockAddToast.mock.calls.at(-1)?.[0].message).toBe(
      '지점 정보 저장에 실패했어요. 잠시 후 다시 시도해주세요.'
    );
  });
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
