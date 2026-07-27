import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import CreateJobPostingScreen from '../create';
import type { JobPosting } from '@/types/jobPosting';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';
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
let mockCapturedSubmit: ((values: OrderSheetValues) => Promise<void>) | undefined;

jest.mock('expo-router', () => ({
  useRouter: () => ({ canGoBack: () => false, back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ profile: { phone: '010-1111-2222' } }),
}));

const mockUseMyJobPostings = jest.fn();
const mockCreateMutateAsync = jest.fn();
jest.mock('@/hooks/useJobManagement', () => ({
  useCreateJobPosting: () => ({ mutateAsync: mockCreateMutateAsync, isPending: false }),
  useMyJobPostings: () => mockUseMyJobPostings(),
}));

jest.mock('@/hooks/useUnsavedChangesGuard', () => ({
  useUnsavedChangesGuard: () => ({ markClean: jest.fn() }),
}));

// B5 지점 선택 칩 — 활성 워크스페이스/지점 목록 훅(TanStack Query·store)을 목으로 대체해
// QueryClient 요구를 피하고 칩 노출/비노출 경로를 테스트별로 갈아끼운다.
// 기본값(beforeEach)은 워크스페이스 미보유 = 칩 비노출로, createdAt 회귀 테스트 범위 밖 유지.
const mockUseActiveWorkspace = jest.fn();
jest.mock('@/hooks/workspace', () => ({
  useActiveWorkspace: () => mockUseActiveWorkspace(),
}));

const mockUseVenueContainers = jest.fn();
jest.mock('@/hooks/workSchedule', () => ({
  useVenueContainers: () => mockUseVenueContainers(),
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
  // 주입해 jest.mock 팩토리에서 참조 에러가 난다. props만 캡처하고 null 반환.
  // onSubmit 캡처 = 주문서 폼(1008줄·react-hook-form)을 태우지 않고 제출 경로만 호출하는 손잡이.
  OrderSheetScreen: (props: {
    presets: OrderSheetPreset[];
    onSubmit: (values: OrderSheetValues) => Promise<void>;
  }) => {
    mockCapturedPresets = props.presets;
    mockCapturedSubmit = props.onSubmit;
    return null;
  },
}));

const posting = (id: string, createdAt: string): JobPosting =>
  ({ id, createdAt }) as unknown as JobPosting;

describe('CreateJobPostingScreen — createdAt ISO string 회귀', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCapturedPresets = [];
    mockCapturedSubmit = undefined;
    // 칩 비노출(워크스페이스 미보유) — 이 describe의 회귀 범위 밖 요소 배제
    mockUseActiveWorkspace.mockReturnValue({ activeWorkspace: undefined });
    mockUseVenueContainers.mockReturnValue({ data: [] });
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

/**
 * B5 회귀: "대회는 지점 선택이 조용히 증발한다".
 *
 * applySelectedVenue 의 인자 축소(postingType 제거)는 인자 **개수**만 고정할 뿐, 호출부에서
 * 어떤 **값**이 흐르는지는 고정하지 못한다. create.tsx 를
 * `applySelectedVenue(input, values.postingType === 'tournament' ? undefined : selectedVenueId)`
 * 로 되돌려도 인자 2개 그대로라 tsc·헬퍼 단위 테스트(venueSelection.test.ts)가 전부 녹색이다.
 * B4(jobManagementService.venueAutolink)도 지점 0/1개 자동연결만 덮어 이 분기(지점 2개+ ·
 * 사용자 칩 선택)는 커버되지 않는다 — 그래서 제출 경로에서 input.venueId 를 직접 못박는다.
 */
describe('CreateJobPostingScreen — 대회 지점칩 선택의 값 흐름(B5)', () => {
  const venues = [
    { id: 'venue-1', name: '강남점' },
    { id: 'venue-2', name: '홍대점' },
  ];

  const tournamentValues = {
    title: '대회 딜러',
    postingType: 'tournament',
    scheduleGroups: [],
  } as unknown as OrderSheetValues;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCapturedPresets = [];
    mockCapturedSubmit = undefined;
    mockUseMyJobPostings.mockReturnValue({ data: [] });
    // 지점 2개 이상 + 라우트 venueId 없음 → 칩 노출 조건 충족
    mockUseActiveWorkspace.mockReturnValue({ activeWorkspace: { id: 'workspace-1' } });
    mockUseVenueContainers.mockReturnValue({ data: venues });
    mockCreateMutateAsync.mockResolvedValue({ id: 'jp-1' });
  });

  it('대회 + 지점 2개 이상에서 칩으로 고른 지점이 제출 input.venueId 로 흐른다', async () => {
    const { getByLabelText } = render(<CreateJobPostingScreen />);

    fireEvent.press(getByLabelText('지점 홍대점'));

    await act(async () => {
      await mockCapturedSubmit?.(tournamentValues);
    });

    expect(mockCreateMutateAsync).toHaveBeenCalledTimes(1);
    const passed = mockCreateMutateAsync.mock.calls[0]?.[0] as { input: { venueId?: string } };
    expect(passed.input.venueId).toBe('venue-2');
  });

  it('대회 + 지점 2개 이상에서 칩을 안 고르면 venueId 없이 제출된다(B4 미연결 허용)', async () => {
    render(<CreateJobPostingScreen />);

    await act(async () => {
      await mockCapturedSubmit?.(tournamentValues);
    });

    const passed = mockCreateMutateAsync.mock.calls[0]?.[0] as { input: { venueId?: string } };
    expect(passed.input.venueId).toBeUndefined();
  });
});
