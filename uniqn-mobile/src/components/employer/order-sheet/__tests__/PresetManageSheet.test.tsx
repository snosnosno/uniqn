/**
 * PresetManageSheet — 프리셋 관리 시트 렌더 레벨 테스트.
 *
 * 순수 헬퍼만 보는 테스트로는 "버튼이 실제로 서비스까지 닿는가"를 못 잡는다(이 레포에는
 * CRITICAL 이 살아 있는데도 green 이던 이력이 있다). 그래서 훅은 실물을 쓰고
 * 서비스 모듈(`templateService`)만 모킹해 **버튼 → 서비스 호출**을 잠근다.
 *
 * 잠그는 것:
 *  1. 삭제 → confirmAction 확인 → (Undo 유예 후) deleteTemplate 서비스 호출
 *  2. 삭제 확인은 confirmAction 이어야 한다 — 시트(RN Modal) 위에서 루트 토스트는 안 보인다
 *  3. 이름 변경 → updateTemplate(templateId, { name }, userId) 서비스 호출
 *  4. 중복 이름은 서버를 부르지 않고 인라인 에러로 막는다
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PresetManageSheet } from '../sheets/PresetManageSheet';
import * as templateService from '@/services/jobs/templateService';
import { confirmAction } from '@/utils/confirmAction';
import { queryKeys } from '@/lib/queryClient';
import { UNDO_DELAY_MS } from '@/constants/undo';
import type { JobPostingTemplate } from '@/types';

// jest.setup.js 의 전역 useQuery/useMutation 모킹을 실제 구현으로 복원
jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

jest.mock('@/services/jobs/templateService');

jest.mock('@/utils/confirmAction', () => ({
  confirmAction: jest.fn(),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (s: { user: { uid: string } }) => unknown) => {
    const state = { user: { uid: 'employer-1' } };
    return selector ? selector(state) : state;
  },
}));

const mockAddToast = jest.fn();
jest.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({ addToast: mockAddToast }),
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/lib/queryClient', () => ({
  queryKeys: {
    templates: {
      all: ['templates'],
      list: (userId?: string) =>
        userId === undefined ? ['templates', 'list'] : ['templates', 'list', userId],
    },
  },
  cachingPolicies: { stable: 60 * 60 * 1000 },
}));

// SheetModal 실물 대신 자식 통과 스텁(레포 관례: BlindPresetSheet.test.tsx:19-24).
jest.mock('@/components/ui/SheetModal', () => ({
  SheetModal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => {
    const { View } = require('react-native');
    return visible ? <View>{children}</View> : null;
  },
}));

const mockDeleteTemplate = templateService.deleteTemplate as jest.Mock;
const mockUpdateTemplate = templateService.updateTemplate as jest.Mock;
const mockGetTemplates = templateService.getTemplates as jest.Mock;
const mockConfirmAction = confirmAction as jest.Mock;

/** 확인 다이얼로그에서 사용자가 '삭제' 를 누른 상황. */
function acceptConfirm() {
  mockConfirmAction.mockImplementation((options: { onConfirm: () => void }) => {
    options.onConfirm();
  });
}

const LIST_KEY = queryKeys.templates.list('employer-1');

function makeTemplate(id: string, name: string): JobPostingTemplate {
  return {
    id,
    userId: 'employer-1',
    name,
    description: null,
    createdAt: null,
    updatedAt: null,
    templateData: { title: `${name} 공고` },
    usageCount: 0,
  };
}

function setup(seed: JobPostingTemplate[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(LIST_KEY, seed);
  const view = render(
    <QueryClientProvider client={queryClient}>
      <PresetManageSheet visible onClose={jest.fn()} />
    </QueryClientProvider>
  );
  return { queryClient, ...view };
}

beforeEach(() => {
  jest.useFakeTimers();
  mockAddToast.mockClear();
  mockDeleteTemplate.mockReset().mockResolvedValue(undefined);
  mockUpdateTemplate.mockReset().mockResolvedValue(undefined);
  mockGetTemplates.mockReset().mockResolvedValue([]);
  // 기본값은 "사용자가 확인하지 않음" — 각 테스트가 필요할 때만 acceptConfirm() 으로 승인한다.
  mockConfirmAction.mockReset().mockImplementation(() => undefined);
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('PresetManageSheet', () => {
  it('저장된 프리셋 목록을 행으로 보여준다', () => {
    const { getByText } = setup([makeTemplate('a', '주말 딜러')]);
    expect(getByText('주말 딜러')).toBeTruthy();
  });

  it('프리셋이 없으면 만드는 방법을 안내한다', () => {
    const { getByText } = setup([]);
    expect(getByText(/저장된 프리셋이 없어요/)).toBeTruthy();
  });

  it('삭제 → confirmAction 확인 → deleteTemplate 서비스까지 닿는다', () => {
    acceptConfirm();

    const { getByLabelText } = setup([makeTemplate('a', '주말 딜러')]);

    act(() => {
      fireEvent.press(getByLabelText('주말 딜러 삭제'));
    });

    // 확인 다이얼로그가 실제로 걸렸는지 — 시트(RN Modal) 위에서는 토스트 Undo 가 보이지
    // 않으므로 confirmAction 이 유일한 안전장치다. 빠지면 편도 삭제가 된다.
    expect(mockConfirmAction).toHaveBeenCalled();
    expect(mockDeleteTemplate).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(UNDO_DELAY_MS);
    });

    expect(mockDeleteTemplate).toHaveBeenCalledWith('a', 'employer-1');
  });

  it('삭제 확인을 취소하면 서비스를 부르지 않는다', () => {
    // mockConfirmAction 기본값 = onConfirm 미호출(사용자 취소)
    const { getByLabelText } = setup([makeTemplate('a', '주말 딜러')]);

    act(() => {
      fireEvent.press(getByLabelText('주말 딜러 삭제'));
      jest.advanceTimersByTime(UNDO_DELAY_MS);
    });

    expect(mockDeleteTemplate).not.toHaveBeenCalled();
  });

  it('이름 변경 → updateTemplate(templateId, { name }, userId) 로 부분 갱신한다', async () => {
    const { getByLabelText } = setup([makeTemplate('a', '주말 딜러')]);

    fireEvent.press(getByLabelText('주말 딜러 이름 변경'));
    fireEvent.changeText(getByLabelText('프리셋 이름 입력'), '  주중 플로어  ');

    await act(async () => {
      fireEvent.press(getByLabelText('이름 변경 저장'));
    });

    expect(mockUpdateTemplate).toHaveBeenCalledWith('a', { name: '주중 플로어' }, 'employer-1');
  });

  it('다른 프리셋과 같은 이름이면 서버를 부르지 않고 인라인 에러로 막는다', async () => {
    const { getByLabelText, getByText } = setup([
      makeTemplate('a', '주말 딜러'),
      makeTemplate('b', '평일 플로어'),
    ]);

    fireEvent.press(getByLabelText('주말 딜러 이름 변경'));
    fireEvent.changeText(getByLabelText('프리셋 이름 입력'), '평일 플로어');

    await act(async () => {
      fireEvent.press(getByLabelText('이름 변경 저장'));
    });

    expect(mockUpdateTemplate).not.toHaveBeenCalled();
    // 토스트는 시트 뒤에 가려 보이지 않는다 → 사유는 행 안 인라인 텍스트로 떠야 한다.
    expect(getByText('같은 이름의 프리셋이 이미 있습니다.')).toBeTruthy();
  });

  it('2자 미만 이름은 서버를 부르지 않고 인라인 에러로 막는다 (저장 경로와 같은 스키마)', async () => {
    const { getByLabelText, getByText } = setup([makeTemplate('a', '주말 딜러')]);

    fireEvent.press(getByLabelText('주말 딜러 이름 변경'));
    fireEvent.changeText(getByLabelText('프리셋 이름 입력'), '가');

    await act(async () => {
      fireEvent.press(getByLabelText('이름 변경 저장'));
    });

    expect(mockUpdateTemplate).not.toHaveBeenCalled();
    expect(getByText(/2자 이상/)).toBeTruthy();
  });
});
