/**
 * useTemplateManager 삭제(Undo 옵티미스틱) 동작 검증.
 * - 타이머 만료 시 실제 DELETE 커밋
 * - 되돌리기 시 취소 + 복원
 * - [P2] 언마운트 시 진행 중 삭제 flush (타이머 누수 방지)
 * - [P2] 연속 삭제 시 한 항목 복원이 다른 삭제 대기 항목을 되살리지 않음 (스냅샷 경쟁)
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTemplateManager } from '@/hooks/useTemplateManager';
import * as templateService from '@/services/jobs/templateService';
import { queryKeys } from '@/lib/queryClient';
import type { JobPostingTemplate } from '@/types';

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
      detail: (id: string) => ['templates', 'detail', id],
    },
  },
  cachingPolicies: { stable: 60 * 60 * 1000 },
}));

const mockDeleteTemplate = templateService.deleteTemplate as jest.Mock;
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

function setup(seed: JobPostingTemplate[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(LIST_KEY, seed);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const view = renderHook(() => useTemplateManager(), { wrapper });
  return { queryClient, ...view };
}

function ids(queryClient: QueryClient): string[] {
  return (queryClient.getQueryData<JobPostingTemplate[]>(LIST_KEY) ?? []).map((t) => t.id);
}

function findUndo(name: string): (() => void) | undefined {
  const call = [...mockAddToast.mock.calls]
    .reverse()
    .find((c) => c[0]?.action && c[0]?.message?.includes(`'${name}'`));
  return call?.[0]?.action?.onPress;
}

beforeEach(() => {
  jest.useFakeTimers();
  mockAddToast.mockClear();
  mockDeleteTemplate.mockReset().mockResolvedValue(undefined);
  mockGetTemplates.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('useTemplateManager 삭제 Undo', () => {
  it('타이머 만료 후 실제 DELETE 를 커밋한다', async () => {
    const { result, queryClient } = setup([makeTemplate('a', 'A'), makeTemplate('b', 'B')]);

    await act(async () => {
      await result.current.handleDeleteTemplate('a', 'A');
    });

    expect(ids(queryClient)).toEqual(['b']);
    expect(mockDeleteTemplate).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockDeleteTemplate).toHaveBeenCalledWith('a', 'employer-1');
  });

  it('되돌리기 시 DELETE 를 취소하고 복원한다', async () => {
    const { result, queryClient } = setup([makeTemplate('a', 'A'), makeTemplate('b', 'B')]);

    await act(async () => {
      await result.current.handleDeleteTemplate('a', 'A');
    });

    const undo = findUndo('A');
    expect(undo).toBeDefined();
    act(() => undo!());

    expect(ids(queryClient)).toEqual(['a', 'b']);

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockDeleteTemplate).not.toHaveBeenCalled();
  });

  it('[P2] 언마운트 시 진행 중인 삭제를 flush 한다 (타이머 누수 방지)', async () => {
    const { result, unmount } = setup([makeTemplate('a', 'A'), makeTemplate('b', 'B')]);

    await act(async () => {
      await result.current.handleDeleteTemplate('a', 'A');
    });
    expect(mockDeleteTemplate).not.toHaveBeenCalled();

    await act(async () => {
      unmount();
    });

    expect(mockDeleteTemplate).toHaveBeenCalledWith('a', 'employer-1');
  });

  it('[P2] 연속 삭제 후 한 항목 복원이 다른 삭제 대기 항목을 되살리지 않는다', async () => {
    const { result, queryClient } = setup([
      makeTemplate('a', 'A'),
      makeTemplate('b', 'B'),
      makeTemplate('c', 'C'),
    ]);

    await act(async () => {
      await result.current.handleDeleteTemplate('a', 'A');
    });
    await act(async () => {
      await result.current.handleDeleteTemplate('b', 'B');
    });

    expect(ids(queryClient)).toEqual(['c']);

    // A 되돌리기 → A 만 복원되고 B 는 삭제 대기 유지(되살아나면 안 됨)
    const undoA = findUndo('A');
    expect(undoA).toBeDefined();
    act(() => undoA!());

    expect(ids(queryClient)).toEqual(['a', 'c']);
  });
});
