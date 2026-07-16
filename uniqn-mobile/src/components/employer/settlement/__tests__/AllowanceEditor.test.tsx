/**
 * AllowanceEditor — 총 수당 합산 출력 특성(characterization) 테스트
 *
 * Phase2b(9-3) 계약: 컴포넌트 로컬 재구현(calculateTotalAllowance)을
 * 도메인 정본 calculateAllowanceAmount 로 교체하되 표시 출력은 불변이어야 한다.
 * 교체 전 현재 합산 출력을 잠그고(이 테스트), 교체 후에도 동일 출력을 확인한다.
 *
 * 합산 규칙: 금액 항목만 합산, PROVIDED_FLAG(제공)은 금액에서 제외, additional 포함.
 */
import { render } from '@testing-library/react-native';
import React from 'react';
import { AllowanceEditor } from '../AllowanceEditor';
import { type Allowances, PROVIDED_FLAG, formatCurrency } from '@/utils/settlement';

describe('AllowanceEditor — 총 수당 합산 출력 특성', () => {
  it('금액 항목만 합산하고 제공(PROVIDED_FLAG)은 제외하며 additional 을 포함한다', () => {
    const allowances: Allowances = {
      meal: 10000,
      transportation: PROVIDED_FLAG, // 제공 → 금액 합산 제외
      accommodation: 20000,
      additional: 5000,
    };
    // 합산 = 10000 + 20000 + 5000 = 35000 (transportation 제외)
    const { getByText } = render(<AllowanceEditor allowances={allowances} onChange={jest.fn()} />);

    // 총 수당 표시가 정본 합산(35000)과 일치
    expect(getByText(formatCurrency(35000))).toBeTruthy();
    // 제공 1개(transportation) 요약도 함께 노출
    expect(getByText(/1개 항목 제공/)).toBeTruthy();
  });

  it('제공 항목만 있으면 금액 합산은 0 이지만 제공 개수 요약을 노출한다', () => {
    const allowances: Allowances = {
      meal: PROVIDED_FLAG,
      transportation: PROVIDED_FLAG,
    };
    const { queryByText, getByText } = render(
      <AllowanceEditor allowances={allowances} onChange={jest.fn()} />
    );

    // 금액 합산 0 → 금액 텍스트는 렌더되지 않음
    expect(queryByText(formatCurrency(0))).toBeNull();
    // 제공 2개 요약은 노출
    expect(getByText(/2개 항목 제공/)).toBeTruthy();
  });
});
