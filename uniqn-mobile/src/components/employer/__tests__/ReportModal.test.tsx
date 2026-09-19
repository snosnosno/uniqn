import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReportModal } from '../ReportModal';
import { uploadReportEvidence } from '@/services/admin/reportService';
import type { LocalReportEvidence } from '@/types/report';

const mockAddToast = jest.fn();

// jest.setup.js 의 전역 useQuery/useMutation 스텁을 실제 구현으로 복원한다.
// 스텁 상태에서는 mutateAsync 가 항상 undefined 를 돌려줘 "업로드 결과가 evidenceUrls 로 실린다"는
// 계약을 아무것도 증명하지 못한다 — 그래서 이 파일은 실제 QueryClient 를 쓴다.
jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

jest.mock('@/services/admin/reportService', () => ({
  uploadReportEvidence: jest.fn(),
  getReportEvidenceSignedUrl: jest.fn(),
}));

// 실제 Modal 은 footer 를 스크롤 영역 밖 형제로 렌더한다 — mock 도 같은 계약을 지켜야
// 액션 버튼이 사라지지 않는다(2026-07-25 footer prop 전환 시 이 mock 이 먼저 깨졌다).
jest.mock('../../ui/Modal', () => ({
  Modal: ({
    visible,
    children,
    footer,
  }: {
    visible: boolean;
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) =>
    visible ? (
      <>
        {children}
        {footer}
      </>
    ) : null,
}));

jest.mock('../../ui/Button', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    Button: ({ children, onPress, disabled, accessibilityLabel }: any) => (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});

jest.mock('../../ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../../ui/Badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../../icons', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const MockIcon = () => <View />;

  return {
    AlertTriangleIcon: MockIcon,
    CheckIcon: MockIcon,
    AlertCircleIcon: MockIcon,
    UserIcon: MockIcon,
    BriefcaseIcon: MockIcon,
  };
});

// 첨부 picker 는 expo-image-picker(네이티브 권한/갤러리)에 의존하므로 테스트용 대역으로 바꾼다.
// 검증 대상은 "선택된 파일이 제출 경로를 타고 evidenceUrls 로 도달하는가"이지 갤러리 UI 가 아니다.
jest.mock('@/components/support/InquiryAttachmentPicker', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    InquiryAttachmentPicker: ({
      value,
      onChange,
      disabled,
    }: {
      value: unknown[];
      onChange: (next: unknown[]) => void;
      disabled?: boolean;
    }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="테스트-증빙-추가"
        disabled={disabled}
        onPress={() =>
          onChange([
            ...value,
            {
              uri: 'file:///evidence-1.jpg',
              mime: 'image/jpeg',
              size: 1024,
              fileName: 'evidence-1.jpg',
            },
          ])
        }
      >
        <Text>테스트-증빙-추가 ({value.length})</Text>
      </Pressable>
    ),
  };
});

jest.mock('@/stores/toastStore', () => ({
  useToastStore: (selector: (state: { addToast: typeof mockAddToast }) => unknown) =>
    selector({ addToast: mockAddToast }),
}));

const mockUpload = uploadReportEvidence as jest.MockedFunction<typeof uploadReportEvidence>;

const EXPECTED_PICKED_FILE: LocalReportEvidence = {
  uri: 'file:///evidence-1.jpg',
  mime: 'image/jpeg',
  size: 1024,
  fileName: 'evidence-1.jpg',
};

const UPLOADED_PATH = '11111111-2222-3333-4444-555555555555/sub-1/1700000000000-abcd1234.jpg';

function renderModal(onSubmit: jest.Mock) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <ReportModal
        visible={true}
        onClose={jest.fn()}
        mode="employee"
        target={{ id: 'owner-1', name: '구인자' }}
        jobPostingId="job-1"
        onSubmit={onSubmit}
      />
    </QueryClientProvider>
  );
}

/** 유형 선택 + 최소 길이 설명 입력까지 채워 제출 직전 상태로 만든다. */
function fillRequiredFields(utils: ReturnType<typeof renderModal>) {
  // 유형 옵션은 `${label} - ${description}` 을 accessibilityLabel 로 갖는다(ReportTypeOption).
  fireEvent.press(utils.getByLabelText('허위 공고 - 실제와 다른 근무 조건, 허위 정보 게재'));
  fireEvent.changeText(
    utils.getByLabelText('신고 상세 설명'),
    '공고에 적힌 시급과 실제 지급액이 달랐습니다.'
  );
}

describe('ReportModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a validation toast instead of failing silently when submitted without a report type', async () => {
    const { getByText } = renderModal(jest.fn());

    fireEvent.press(getByText('신고하기'));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'error',
        message: '신고 유형을 선택해주세요.',
      });
    });
  });

  it('증빙을 첨부하지 않으면 업로드를 건너뛰고 빈 evidenceUrls 로 제출한다', async () => {
    const onSubmit = jest.fn();
    const utils = renderModal(onSubmit);

    fillRequiredFields(utils);
    fireEvent.press(utils.getByText('신고하기'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    expect(mockUpload).not.toHaveBeenCalled();
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      type: 'false_posting',
      reporterType: 'employee',
      targetId: 'owner-1',
      evidenceUrls: [],
    });
  });

  it('첨부한 증빙을 먼저 업로드하고 그 Storage 경로를 evidenceUrls 로 실어 제출한다', async () => {
    mockUpload.mockResolvedValueOnce([UPLOADED_PATH]);

    const onSubmit = jest.fn();
    const utils = renderModal(onSubmit);

    fillRequiredFields(utils);
    fireEvent.press(utils.getByLabelText('테스트-증빙-추가'));
    fireEvent.press(utils.getByText('신고하기'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    expect(mockUpload).toHaveBeenCalledWith([EXPECTED_PICKED_FILE]);
    expect(onSubmit.mock.calls[0][0].evidenceUrls).toEqual([UPLOADED_PATH]);
  });

  it('증빙 업로드가 실패하면 신고를 생성하지 않는다 (접수 후 롤백 금지)', async () => {
    mockUpload.mockRejectedValueOnce(new Error('upload failed'));

    const onSubmit = jest.fn();
    const utils = renderModal(onSubmit);

    fillRequiredFields(utils);
    fireEvent.press(utils.getByLabelText('테스트-증빙-추가'));
    fireEvent.press(utils.getByText('신고하기'));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'error',
        message: '증빙 사진 업로드에 실패했어요. 신고가 접수되지 않았어요.',
      });
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
