/**
 * RoleSalaryDisplay 급여 표기 회귀.
 *
 * 처음(8-2, #263)엔 리팩터링 중 화면 문자열이 흔들리지 않게 자체 포맷("라벨 금액원", ₩ 없음)을
 * 바이트 단위로 고정했다. 그 결과 지원 화면만 "시급 20,000원", 공고 상세·홈 카드·스케줄은
 * "시급 ₩20,000" 으로 갈라져 보였다(UX 감사 I). 이제 정본 `formatSalary`/`formatCurrency`
 * (impeccable §19) 출력을 고정한다. 'other'→'협의' 는 그대로다.
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { RoleSalaryDisplay, SalarySummary } from '../RoleSalaryDisplay';

describe('RoleSalaryDisplay 급여 표기 (출력 불변)', () => {
  it('동일 급여 전체 표기: "라벨 ₩금액" (정본 formatSalary)', () => {
    render(<RoleSalaryDisplay useSameSalary defaultSalary={{ type: 'hourly', amount: 15000 }} />);
    expect(screen.getByText('시급 ₩15,000')).toBeTruthy();
  });

  it('역할별 전체 표기 (compact=false)', () => {
    render(
      <RoleSalaryDisplay
        roles={[
          { role: 'dealer', salary: { type: 'hourly', amount: 15000 } },
          { role: 'floor', salary: { type: 'daily', amount: 120000 } },
        ]}
      />
    );
    expect(screen.getByText('시급 ₩15,000')).toBeTruthy();
    expect(screen.getByText('일급 ₩120,000')).toBeTruthy();
  });

  it("'other' 타입은 금액 없이 '협의'", () => {
    render(<RoleSalaryDisplay useSameSalary defaultSalary={{ type: 'other', amount: 0 }} />);
    expect(screen.getByText('협의')).toBeTruthy();
  });
});

describe('SalarySummary 급여 요약 (short 표기 출력 불변)', () => {
  it('단일 금액 short: "₩금액"', () => {
    render(
      <SalarySummary
        roles={[
          { role: 'dealer', salary: { type: 'hourly', amount: 15000 } },
          { role: 'floor', salary: { type: 'hourly', amount: 15000 } },
        ]}
      />
    );
    expect(screen.getByText('₩15,000')).toBeTruthy();
  });

  it('범위 short: "₩최소 ~ ₩최대"', () => {
    render(
      <SalarySummary
        roles={[
          { role: 'dealer', salary: { type: 'hourly', amount: 10000 } },
          { role: 'floor', salary: { type: 'hourly', amount: 20000 } },
        ]}
      />
    );
    expect(screen.getByText('₩10,000 ~ ₩20,000')).toBeTruthy();
  });
});
