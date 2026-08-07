import React from 'react';
import { render } from '@testing-library/react-native';
import CreateJobPostingScreen from '../create';
import { draftToValues } from '@/utils/order-sheet/mappers';
import { buildJobPostingDraft } from '@/utils/job-posting/submission';
import type { JobPosting } from '@/types/jobPosting';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';
import type { OrderSheetPreset } from '@/components/employer/order-sheet/PresetCarousel';

/**
 * 회귀: "마지막 공고" 프리셋이 `grouped:true` 를 몰래 들여온다.
 *
 * 지난 공고가 "8/1~8/2 통째로 지원받기"였다면, 프리셋은 날짜만 비우고 `grouped` 는 그대로 넘긴다.
 * 날짜가 비어 있는 동안엔 조건 카드가 토글을 아예 렌더하지 않아(`dates.length > 1` 방어) 증상이
 * 숨고, 사장이 새 날짜(9/5·9/6)를 고르는 순간 켠 적 없는 "통째로 지원받기"가 켜진 채 등장한다.
 * 그대로 등록하면 하루만 가능한 지원자가 전원 지원 불가가 된다.
 *
 * 형제 생산자 `templateToValues`(mappers.ts)는 같은 이유로 이미 `grouped:false` 를 넣는다 —
 * 이 테스트는 나머지 한 생산자(create.tsx 프리셋 조립)를 같은 계약에 묶는다.
 *
 * ⚠️ `@/utils/order-sheet/mappers` 와 `@/utils/job-posting/submission` 은 **모킹하지 않는다** —
 *    공고 → draft → 폼값 파이프라인이 실제로 `grouped:true` 를 만들어 내야 회귀가 유효하다.
 *    (형제 파일 CreateJobPostingScreen.test.tsx 는 이 둘을 목으로 덮어 이 결함을 못 잡는다.)
 */

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

// 지점 칩 비노출(워크스페이스 미보유) — 이 회귀의 범위 밖 요소 배제
jest.mock('@/hooks/workspace', () => ({
  useActiveWorkspace: () => ({ activeWorkspace: undefined }),
}));

jest.mock('@/hooks/workSchedule', () => ({
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

jest.mock('@/components/headers', () => ({ StackHeader: () => null }));

jest.mock('@/components/employer/job-form/modals/TemplateModal', () => ({
  TemplateModal: () => null,
}));

jest.mock('@/components/employer/order-sheet/OrderSheetScreen', () => ({
  // JSX/createElement 금지 — nativewind babel 변환이 out-of-scope _ReactNativeCSSInterop 를
  // 주입해 jest.mock 팩토리에서 참조 에러가 난다. props 만 캡처하고 null 반환.
  OrderSheetScreen: (props: { presets: OrderSheetPreset[] }) => {
    mockCapturedPresets = props.presets;
    return null;
  },
}));

const dealerSlot = [{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }];
const floorSlot = [{ startTime: '21:00', roles: [{ role: 'floor', count: 1 }] }];

/**
 * 지난 공고 — 8/1~8/2 는 "통째로 지원받기"(isGrouped), 8/5 는 단독 모집.
 * 8/5 그룹이 **대조군**이다(원래 grouped:false 였던 그룹·시간대는 프리셋에서 그대로 남아야 한다).
 */
const lastPosting = (): JobPosting =>
  ({
    id: 'jp-last',
    createdAt: '2026-08-03T00:00:00.000Z',
    postingType: 'regular',
    title: '주말 딜러 구합니다',
    description: '',
    location: { name: '라운더스 홀덤펍', district: '서울 강남구' },
    contactPhone: '010-1234-5678',
    tags: [],
    workDate: '2026-08-01',
    schedule: {
      kind: 'dated',
      primaryDate: '2026-08-01',
      allDates: ['2026-08-01', '2026-08-02', '2026-08-05'],
      requirements: [
        { date: '2026-08-01', isGrouped: true, timeSlots: dealerSlot },
        { date: '2026-08-02', isGrouped: true, timeSlots: dealerSlot },
        { date: '2026-08-05', timeSlots: floorSlot },
      ],
    },
    roleCatalog: [],
    compensation: { mode: 'shared', defaultSalary: { type: 'hourly', amount: 20000 } },
    questions: { items: [] },
  }) as unknown as JobPosting;

describe('CreateJobPostingScreen — "마지막 공고" 프리셋의 좀비 묶음지원 토글', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCapturedPresets = [];
    mockUseMyJobPostings.mockReturnValue({ data: [lastPosting()] });
  });

  it('원천 공고는 실제로 grouped:true 그룹을 복원한다 (vacuous green 배제용 사전 관측)', () => {
    const values = draftToValues(buildJobPostingDraft(lastPosting())) as OrderSheetValues;
    expect(values.scheduleGroups).toHaveLength(2);
    expect(values.scheduleGroups[0]?.dates).toEqual(['2026-08-01', '2026-08-02']);
    expect(values.scheduleGroups[0]?.grouped).toBe(true);
    expect(values.scheduleGroups[1]?.grouped).toBe(false);
  });

  it('프리셋은 날짜와 함께 grouped 도 끈다 — 켠 적 없는 "통째로 지원받기" 유입 차단', () => {
    render(<CreateJobPostingScreen />);

    const groups = mockCapturedPresets[0]?.values.scheduleGroups ?? [];
    // 대조군 1 — 프리셋이 실제로 조립됐고 그룹 구조가 보존됐다는 증거
    expect(mockCapturedPresets[0]?.id).toBe('last');
    expect(groups).toHaveLength(2);

    // 핵심 단언 — grouped:true 였던 그룹이 프리셋에서는 꺼져 있어야 한다
    expect(groups[0]?.grouped).toBe(false);
    // 대조군 2 — 원래 false 였던 그룹은 그대로 false
    expect(groups[1]?.grouped).toBe(false);

    // 대조군 3 — 날짜만 비우고 조건(시간대·역할)은 손대지 않는다("전부 지워서 통과" 배제)
    expect(groups.every((g) => g.dates.length === 0)).toBe(true);
    expect(groups[0]?.timeSlots?.[0]?.startTime).toBe('19:00');
    expect(groups[0]?.timeSlots?.[0]?.roles?.[0]?.role).toBe('dealer');
    expect(groups[1]?.timeSlots?.[0]?.startTime).toBe('21:00');
    expect(groups[1]?.timeSlots?.[0]?.roles?.[0]?.role).toBe('floor');
  });
});
