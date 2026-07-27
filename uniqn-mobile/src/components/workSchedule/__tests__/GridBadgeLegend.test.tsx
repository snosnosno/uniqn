/**
 * GridBadgeLegend — 셀 뱃지 범례(P0-3) 테스트
 *
 * 캘린더 셀의 압축 뱃지(!N/+N/✓N)가 무슨 뜻인지 화면에서 학습 가능해야 한다.
 * (1) 3종(부족/공고/배치) 글리프+라벨 병기 렌더, (2) 스크린리더용 통합 라벨 제공을 검증한다.
 */
import { render } from '@testing-library/react-native';
import React from 'react';
import { GridBadgeLegend } from '../GridBadgeLegend';

it('범례 3항목(부족/공고/배치)을 글리프+라벨 병기로 렌더', () => {
  const { getByText } = render(<GridBadgeLegend />);

  expect(getByText('!')).toBeTruthy();
  expect(getByText('+')).toBeTruthy();
  expect(getByText('✓')).toBeTruthy();
  expect(getByText('부족')).toBeTruthy();
  expect(getByText('공고')).toBeTruthy();
  expect(getByText('배치')).toBeTruthy();
});

it('스크린리더용 통합 라벨 제공(부족·공고·배치 순서)', () => {
  const { getByLabelText } = render(<GridBadgeLegend />);

  expect(getByLabelText(/범례.*부족.*공고.*배치/)).toBeTruthy();
});
