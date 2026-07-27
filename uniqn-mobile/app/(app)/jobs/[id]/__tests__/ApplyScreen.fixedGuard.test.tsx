/**
 * 지원 라우트의 고정(fixed) 공고 차단 가드.
 *
 * @description 제품 정책은 "고정(장기) 공고는 앱 내 지원 대신 연락처로 직접 문의"이고
 * 이를 사용자 가이드(`public/guide.html`)로 공표하고 있다. 그런데 두 공고 상세 화면의
 * CTA 만 막고 있어서 `/(app)/jobs/{id}/apply` 라우트 자체는 열려 있었다 —
 * `isSupportedReleasePosting` 이 `schedule.kind === 'fixed'` 를 **명시적으로 통과**시키기
 * 때문이다(`jobPostingVisibility.ts`). 딥링크·URL 직접 입력으로 정책이 뚫렸다.
 *
 * ⚠️ `jobPostingVisibility` 는 **모킹하지 않는다** — 이 구멍의 원인이 그 술어의 실제 동작이라
 * 목으로 가리면 회귀를 못 잡는다.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import ApplyScreen from '../apply';

const mockApplicationForm = jest.fn((_props?: unknown) => null);
const mockReplace = jest.fn();
const mockOpenURL = jest.fn();

const FIXED_JOB = {
  id: 'job-fixed',
  title: '상시 딜러 모집',
  schemaVersion: 3,
  postingType: 'fixed',
  status: 'active',
  schedule: { kind: 'fixed' },
  contactPhone: '010-1234-5678',
};

const DATED_JOB = {
  id: 'job-dated',
  title: '주말 딜러',
  schemaVersion: 3,
  postingType: 'regular',
  status: 'active',
  schedule: { kind: 'dated' },
  contactPhone: '010-1234-5678',
};

let mockJob: Record<string, unknown> = FIXED_JOB;
let mockHasApplied = false;

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
  useLocalSearchParams: () => ({ id: 'job-1' }),
}));

jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: (...args: unknown[]) => mockOpenURL(...args),
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
  PhoneIcon: () => null,
}));

jest.mock('@/components/ui', () => ({
  Loading: () => null,
}));

jest.mock('@/components/ui/Button', () => {
  const ReactActual = jest.requireActual('react');
  const { Text, Pressable } = jest.requireActual('react-native');
  return {
    Button: ({
      children,
      onPress,
      disabled,
    }: {
      children: React.ReactNode;
      onPress?: () => void;
      disabled?: boolean;
    }) =>
      ReactActual.createElement(
        Pressable,
        { onPress, disabled, accessibilityState: { disabled: !!disabled } },
        ReactActual.createElement(Text, null, children)
      ),
  };
});

jest.mock('@/hooks', () => ({
  useJobDetail: () => ({
    job: mockJob,
    isLoading: false,
    error: null,
    refresh: jest.fn(),
  }),
  useApplications: () => ({
    submitApplicationAsync: jest.fn(),
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
  useQueryClient: () => ({ fetchQuery: jest.fn() }),
}));

jest.mock('@/utils/showAlert', () => ({ showAlert: jest.fn() }));
jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('ApplyScreen — 고정 공고 차단 가드', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockJob = FIXED_JOB;
    mockHasApplied = false;
  });

  it('고정 공고는 지원 폼을 렌더하지 않는다 (딥링크 우회 차단)', () => {
    render(<ApplyScreen />);

    expect(mockApplicationForm).not.toHaveBeenCalled();
  });

  it('고정 공고는 공표된 정책 문구와 전화 문의 행동을 제시한다', () => {
    const screen = render(<ApplyScreen />);

    // public/guide.html 의 공표 문구와 같은 축: "앱 내 지원 대신 연락처로 직접 문의"
    expect(screen.getByText(/연락처로 직접 문의/)).toBeTruthy();
    expect(screen.getByText('전화 문의')).toBeTruthy();
  });

  it('연락처가 없으면 전화 문의를 비활성으로 표시한다 (죽은 버튼 금지)', () => {
    mockJob = { ...FIXED_JOB, contactPhone: undefined };

    const screen = render(<ApplyScreen />);

    expect(screen.getByText('전화 문의 (연락처 미등록)')).toBeTruthy();
    expect(screen.queryByText('전화 문의')).toBeNull();
  });

  it('dated 공고는 그대로 지원 폼을 렌더한다 (가드 과잉 차단 회귀 방지)', () => {
    mockJob = DATED_JOB;

    render(<ApplyScreen />);

    expect(mockApplicationForm).toHaveBeenCalled();
  });

  it('이미 지원한 고정 공고(레거시 행)는 지원 상태 안내를 우선한다', () => {
    mockHasApplied = true;

    const screen = render(<ApplyScreen />);

    expect(screen.getByText('이미 지원한 공고입니다')).toBeTruthy();
    expect(mockApplicationForm).not.toHaveBeenCalled();
  });
});
