import React from 'react';
import { render } from '@testing-library/react-native';
import CreateJobPostingScreen from '../create';
import type { JobPosting } from '@/types/jobPosting';
import type { OrderSheetPreset } from '@/components/employer/order-sheet/PresetCarousel';

/**
 * 회귀: 공고 작성 화면 진입 시 "TypeError: p.createdAt?.getTime is not a function" 크래시.
 *
 * 근본 원인 — JobPosting.createdAt은 타입상 Date지만 런타임은 timestampSchema(common.ts)가
 * 통일한 ISO 8601 string이다. "마지막 공고" 프리셋 선별(create.tsx lastPosting)이 문자열에
 * .getTime()을 직접 호출해 크래시했다. toDate()로 변환 후 비교하도록 수정.
 *
 * ⚠️ toDate는 의도적으로 모킹하지 않는다 — 실제 변환 로직을 통과시켜야 회귀가 유효하다.
 */

const mockBuildJobPostingDraft = jest.fn(() => ({}) as unknown);
let mockCapturedPresets: OrderSheetPreset[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ canGoBack: () => false, back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ profile: { phone: '010-1111-2222' } }),
}));

const mockUseMyJobPostings = jest.fn();
jest.mock('@/hooks/useJobManagement', () => ({
  useCreateJobPosting: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useMyJobPostings: () => mockUseMyJobPostings(),
}));

jest.mock('@/hooks/useUnsavedChangesGuard', () => ({
  useUnsavedChangesGuard: () => ({ markClean: jest.fn() }),
}));

// B5 지점 선택 칩 — 활성 워크스페이스/지점 목록 훅(TanStack Query·store)은 이 회귀 테스트 범위 밖.
// 워크스페이스 미보유로 고정해 칩 비노출 경로만 통과시킨다(QueryClient 요구 회피).
jest.mock('@/hooks/workspace', () => ({
  useActiveWorkspace: () => ({ activeWorkspace: undefined }),
}));

jest.mock('@/hooks/weeklyGrid', () => ({
  useVenueContainers: () => ({ data: [] }),
}));

jest.mock('@/hooks/useTemplateManager', () => ({
  useTemplateManager: () => ({
    templates: [],
    isTemplateModalOpen: false,
    openTemplateModal: jest.fn(),
    closeTemplateModal: jest.fn(),
    templateName: '',
    templateDescription: '',
    setTemplateName: jest.fn(),
    setTemplateDescription: jest.fn(),
    handleSaveTemplate: jest.fn(),
    isSavingTemplate: false,
  }),
}));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({ addToast: jest.fn() }),
}));

jest.mock('@/components/headers', () => ({
  StackHeader: () => null,
}));

jest.mock('@/components/employer/job-form/modals/TemplateModal', () => ({
  TemplateModal: () => null,
}));

jest.mock('@/utils/job-posting/submission', () => ({
  buildJobPostingDraft: (...args: unknown[]) => mockBuildJobPostingDraft(...(args as [])),
}));

jest.mock('@/utils/order-sheet/mappers', () => ({
  draftToValues: () => ({ title: '마지막 공고', scheduleGroups: [] }),
  formValuesToDraft: () => ({}),
  gridParamsToValues: () => ({}),
  primaryScheduleInfo: () => ({ primaryDate: null, startTime: null, totalDates: 0 }),
  templateToValues: () => ({}),
  valuesToCreateInput: () => ({}),
  valuesToDraft: () => ({}),
}));

jest.mock('@/components/employer/order-sheet/OrderSheetScreen', () => ({
  // JSX/createElement 금지 — nativewind babel 변환이 out-of-scope _ReactNativeCSSInterop를
  // 주입해 jest.mock 팩토리에서 참조 에러가 난다. presets만 캡처하고 null 반환.
  OrderSheetScreen: (props: { presets: OrderSheetPreset[] }) => {
    mockCapturedPresets = props.presets;
    return null;
  },
}));

const posting = (id: string, createdAt: string): JobPosting =>
  ({ id, createdAt }) as unknown as JobPosting;

describe('CreateJobPostingScreen — createdAt ISO string 회귀', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCapturedPresets = [];
  });

  it('createdAt이 ISO string인 공고 목록에서도 크래시 없이 렌더된다', () => {
    mockUseMyJobPostings.mockReturnValue({
      data: [posting('A', '2026-07-10T00:00:00.000Z'), posting('B', '2026-07-16T00:00:00.000Z')],
    });
    expect(() => render(<CreateJobPostingScreen />)).not.toThrow();
  });

  it('문자열 createdAt 최댓값(최신)을 "마지막 공고" 프리셋 소스로 선별한다', () => {
    mockUseMyJobPostings.mockReturnValue({
      data: [posting('A', '2026-07-10T00:00:00.000Z'), posting('B', '2026-07-16T00:00:00.000Z')],
    });
    render(<CreateJobPostingScreen />);
    // 최신(B)이 buildJobPostingDraft로 넘어가야 한다.
    expect(mockBuildJobPostingDraft).toHaveBeenCalledWith(expect.objectContaining({ id: 'B' }));
    expect(mockCapturedPresets).toHaveLength(1);
    expect(mockCapturedPresets[0]?.id).toBe('last');
  });

  it('공고 목록이 비면 프리셋 없이 렌더된다(무회귀)', () => {
    mockUseMyJobPostings.mockReturnValue({ data: [] });
    render(<CreateJobPostingScreen />);
    expect(mockBuildJobPostingDraft).not.toHaveBeenCalled();
    expect(mockCapturedPresets).toHaveLength(0);
  });
});
