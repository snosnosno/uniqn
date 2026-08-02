/**
 * ReportEvidenceGallery — 관리자 증빙 열람 렌더 테스트
 *
 * 잠그는 계약:
 *  (1) Storage 경로는 **열람 시점에 서명 URL 로 교환**되어 이미지에 실린다
 *      (경로를 그대로 uri 에 넣으면 비공개 버킷이라 아무것도 안 보인다)
 *  (2) 과거 데이터의 http(s) 절대 URL 은 서명하지 않고 그대로 쓴다
 *  (3) 증빙이 없으면 아무것도 렌더하지 않는다
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReportEvidenceGallery } from '../ReportEvidenceGallery';
import { getReportEvidenceSignedUrl } from '@/services/admin/reportService';

// jest.setup.js 의 useQuery 스텁은 항상 data:undefined 를 주므로 실제 구현으로 복원한다.
jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

jest.mock('@/services/admin/reportService', () => ({
  getReportEvidenceSignedUrl: jest.fn(),
  uploadReportEvidence: jest.fn(),
}));

jest.mock('expo-image', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    Image: ({ source }: { source: { uri: string } }) => <Text>{`img:${source.uri}`}</Text>,
  };
});

jest.mock('@/components/icons', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { XIcon: () => <View /> };
});

const mockSign = getReportEvidenceSignedUrl as jest.Mock;

const EVIDENCE_PATH = '11111111-2222-3333-4444-555555555555/sub-1/1700000000000-abcd1234.jpg';

function renderGallery(refs: string[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <ReportEvidenceGallery refs={refs} />
    </QueryClientProvider>
  );
}

describe('ReportEvidenceGallery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Storage 경로는 서명 URL 로 교환해 이미지에 싣는다', async () => {
    mockSign.mockResolvedValueOnce('https://signed.example/evidence-1.jpg?token=abc');

    const { findByText } = renderGallery([EVIDENCE_PATH]);

    expect(await findByText('img:https://signed.example/evidence-1.jpg?token=abc')).toBeTruthy();
    expect(mockSign).toHaveBeenCalledWith(EVIDENCE_PATH);
  });

  it('과거 데이터의 절대 URL 은 서명하지 않고 그대로 쓴다', async () => {
    const { findByText } = renderGallery(['https://cdn.example.com/legacy.jpg']);

    expect(await findByText('img:https://cdn.example.com/legacy.jpg')).toBeTruthy();
    await waitFor(() => expect(mockSign).not.toHaveBeenCalled());
  });

  it('증빙이 없으면 아무것도 렌더하지 않는다', () => {
    const { queryByText } = renderGallery([]);

    expect(queryByText(/증빙 사진/)).toBeNull();
    expect(mockSign).not.toHaveBeenCalled();
  });
});
