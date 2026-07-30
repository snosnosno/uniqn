/**
 * 지원 제출 성공 직후 화면 가드 순서 회귀 테스트.
 *
 * @description 증상: 지원하면 "지원이 완료되었습니다" 화면이 잠깐 보이다가
 * "이미 지원한 공고입니다" 화면으로 바뀐다.
 *
 * 원인: 제출 성공 시 mutation 이 내 지원 목록 캐시를 무효화한다 → 재조회가 끝나는 순간
 * `hasApplied(job.id)` 가 true 로 뒤집힌다. 그런데 AlreadyAppliedState 가드가 제출 완료
 * 화면(`!showForm`)보다 **위**에 있어서, 방금 만든 성공 화면이 중복 지원 안내로 덮였다.
 * 사용자에게는 지원이 실패한 것처럼 읽힌다.
 *
 * 이 테스트는 그 순서를 고정한다 — 제출 완료 상태는 어떤 상태 가드보다 우선한다.
 */
import React from 'react';
import { render, act } from '@testing-library/react-native';
import ApplyScreen from '../apply';

type SubmitHandler = (
  assignments: unknown[],
  message: string | undefined,
  preQuestionAnswers: unknown[] | undefined,
  provisionConsent: { at: string; version: string }
) => Promise<void>;

const mockApplicationForm = jest.fn((_props?: unknown) => null);
const mockSubmitApplicationAsync = jest.fn();

const DATED_JOB = {
  id: 'job-dated',
  title: '주말 딜러',
  schemaVersion: 3,
  postingType: 'regular',
  status: 'active',
  schedule: { kind: 'dated' },
  contactPhone: '010-1234-5678',
};

/** 제출 성공 후 캐시가 갱신되면 true 로 뒤집히는 값 (실제 동작 재현) */
let mockHasApplied = false;

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: () => ({ id: 'job-dated' }),
}));

jest.mock('@/components/jobs', () => ({
  ApplicationForm: (props: unknown) => mockApplicationForm(props),
}));

jest.mock('@/components/headers', () => ({
  StackHeader: () => null,
}));

jest.mock('@/components/icons', () => ({
  AlertTriangleIcon: () => null,
  CheckCircleIcon: () => null,
  InformationCircleIcon: () => null,
}));

jest.mock('@/components/ui', () => ({
  Loading: () => null,
}));

jest.mock('@/components/ui/Button', () => {
  const ReactActual = jest.requireActual('react');
  const { Text, Pressable } = jest.requireActual('react-native');
  return {
    Button: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) =>
      ReactActual.createElement(
        Pressable,
        { onPress },
        ReactActual.createElement(Text, null, children)
      ),
  };
});

jest.mock('@/hooks', () => ({
  useJobDetail: () => ({
    job: DATED_JOB,
    isLoading: false,
    error: null,
    refresh: jest.fn(),
  }),
  useApplications: () => ({
    submitApplicationAsync: (...args: unknown[]) => mockSubmitApplicationAsync(...args),
    isSubmitting: false,
    hasApplied: () => mockHasApplied,
  }),
  useHasAppliedToJob: () => ({ data: false, isLoading: false, isFetching: false }),
}));

jest.mock('@/hooks/internal/sessionUserId', () => ({
  resolveSessionUserId: () => 'user-1',
}));

jest.mock('@/hooks/useJobDetail', () => ({
  getJobDetailQueryOptions: () => ({ queryKey: ['job'], queryFn: jest.fn() }),
}));

jest.mock('@/stores', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ user: { uid: 'user-1' }, isInitialized: true }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ fetchQuery: jest.fn().mockResolvedValue(DATED_JOB) }),
}));

// 마감 판정은 이 테스트의 관심사가 아니다 — 제출 경로를 열어 둔다.
jest.mock('@/utils/job-posting/dateUtils', () => ({
  getClosingStatus: () => ({ total: 0, filled: 0 }),
}));

jest.mock('@/utils/showAlert', () => ({ showAlert: jest.fn() }));
jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('ApplyScreen — 제출 성공 후 화면 가드 순서', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasApplied = false;
    mockSubmitApplicationAsync.mockResolvedValue({ id: 'app-1' });
  });

  it('제출 성공 후 캐시가 갱신돼도 지원 완료 화면이 유지된다', async () => {
    const screen = render(<ApplyScreen />);

    const formProps = mockApplicationForm.mock.calls[0]?.[0] as { onSubmit: SubmitHandler };
    expect(formProps).toBeDefined();

    await act(async () => {
      await formProps.onSubmit([], undefined, undefined, { at: '2026-07-31', version: 'v1' });
    });

    expect(screen.getByText('지원이 완료되었습니다')).toBeTruthy();

    // 여기서부터가 회귀 지점 — mutation 무효화 → 재조회 완료로 hasApplied 가 true 가 된다.
    mockHasApplied = true;
    screen.rerender(<ApplyScreen />);

    expect(screen.getByText('지원이 완료되었습니다')).toBeTruthy();
    expect(screen.queryByText('이미 지원한 공고입니다')).toBeNull();
  });
});
