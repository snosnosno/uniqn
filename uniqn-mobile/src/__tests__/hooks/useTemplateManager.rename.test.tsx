/**
 * useTemplateManager 이름 축 검증.
 * - useRenameTemplate → updateTemplate 부분 갱신({ name })으로만 저장
 * - 저장 경로의 중복 이름 차단은 "막기"에서 끝나지 않고 회피 이름을 넣어 준다
 * - 저장 경로에도 이름 스키마(2자·XSS)가 걸린다 (예전엔 무검증이었다)
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRenameTemplate, useTemplateManager } from '@/hooks/useTemplateManager';
import * as templateService from '@/services/jobs/templateService';
import { queryKeys } from '@/lib/queryClient';
import { INITIAL_JOB_POSTING_DRAFT } from '@/types/jobPostingDraft';
import type { JobPostingTemplate } from '@/types';

// jest.setup.js 의 전역 useQuery/useMutation 모킹을 실제 구현으로 복원
jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

jest.mock('@/services/jobs/templateService');

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

const mockSaveTemplate = templateService.saveTemplate as jest.Mock;
const mockUpdateTemplate = templateService.updateTemplate as jest.Mock;
const mockGetTemplates = templateService.getTemplates as jest.Mock;

const LIST_KEY = queryKeys.templates.list('employer-1');

function makeTemplate(id: string, name: string): JobPostingTemplate {
  return {
    id,
    userId: 'employer-1',
    name,
    description: null,
    createdAt: null,
    updatedAt: null,
    templateData: {},
    usageCount: 0,
  };
}

function wrapperWith(seed: JobPostingTemplate[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(LIST_KEY, seed);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return wrapper;
}

beforeEach(() => {
  mockAddToast.mockClear();
  mockSaveTemplate.mockReset().mockResolvedValue('new-id');
  mockUpdateTemplate.mockReset().mockResolvedValue(undefined);
  mockGetTemplates.mockReset().mockResolvedValue([]);
});

describe('useRenameTemplate', () => {
  it('이름만 부분 갱신한다 (templateData 를 함께 보내지 않는다)', async () => {
    const { result } = renderHook(() => useRenameTemplate(), {
      wrapper: wrapperWith([makeTemplate('a', 'A')]),
    });

    await act(async () => {
      await result.current.mutateAsync({ templateId: 'a', name: '새 이름' });
    });

    expect(mockUpdateTemplate).toHaveBeenCalledWith('a', { name: '새 이름' }, 'employer-1');
  });
});

describe('useTemplateManager 저장 이름 축', () => {
  it('중복 이름이면 저장하지 않고 회피 이름을 입력란에 채워 준다', async () => {
    const { result } = renderHook(() => useTemplateManager(), {
      wrapper: wrapperWith([makeTemplate('a', '주말 딜러')]),
    });

    act(() => {
      result.current.openTemplateModal();
      result.current.setTemplateName('주말 딜러');
    });

    await act(async () => {
      await result.current.handleSaveTemplate(INITIAL_JOB_POSTING_DRAFT);
    });

    expect(mockSaveTemplate).not.toHaveBeenCalled();
    // 막기만 하면 사용자가 매번 새 이름을 지어내야 한다 — 다음 행동을 손에 쥐여 준다.
    expect(result.current.templateName).toBe('주말 딜러 (2)');
    // 모달은 열린 채로 둔다 — 닫으면 이름 입력이 초기화돼 처음부터 다시 쳐야 한다.
    expect(result.current.isTemplateModalOpen).toBe(true);
  });

  it('회피 이름 그대로 다시 저장하면 통과한다', async () => {
    const { result } = renderHook(() => useTemplateManager(), {
      wrapper: wrapperWith([makeTemplate('a', '주말 딜러')]),
    });

    act(() => {
      result.current.setTemplateName('주말 딜러 (2)');
    });

    await act(async () => {
      await result.current.handleSaveTemplate(INITIAL_JOB_POSTING_DRAFT);
    });

    expect(mockSaveTemplate).toHaveBeenCalledTimes(1);
    expect((mockSaveTemplate.mock.calls[0][0] as { name: string }).name).toBe('주말 딜러 (2)');
  });

  it('2자 미만 이름은 저장 서비스까지 가지 않는다 (저장 경로 무검증 회귀 방지)', async () => {
    const { result } = renderHook(() => useTemplateManager(), {
      wrapper: wrapperWith([]),
    });

    act(() => {
      result.current.setTemplateName('가');
    });

    await act(async () => {
      await result.current.handleSaveTemplate(INITIAL_JOB_POSTING_DRAFT);
    });

    expect(mockSaveTemplate).not.toHaveBeenCalled();
  });

  it('XSS 패턴 이름은 저장 서비스까지 가지 않는다', async () => {
    const { result } = renderHook(() => useTemplateManager(), {
      wrapper: wrapperWith([]),
    });

    act(() => {
      result.current.setTemplateName('<script>alert(1)</script>');
    });

    await act(async () => {
      await result.current.handleSaveTemplate(INITIAL_JOB_POSTING_DRAFT);
    });

    expect(mockSaveTemplate).not.toHaveBeenCalled();
  });
});
