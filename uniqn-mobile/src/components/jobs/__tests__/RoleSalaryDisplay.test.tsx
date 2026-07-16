/**
 * 급여 표기 중복 제거(8-2) 출력 불변 회귀.
 *
 * RoleSalaryDisplay 는 자체 급여 포맷("라벨 금액원", ₩ 없음, 'other'→'협의')을
 * 쓴다. 내부 라벨 상수·숫자 포맷을 공용 유틸로 교체하되 화면 문자열은
 * 바이트 단위로 불변이어야 한다. 아래 단언은 교체 전 출력을 기록한 것.
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { RoleSalaryDisplay, SalarySummary } from '../RoleSalaryDisplay';

describe('RoleSalaryDisplay 급여 표기 (출력 불변)', () => {
  it('동일 급여 전체 표기: "라벨 금액원" (₩ 없음)', () => {
    render(<RoleSalaryDisplay useSameSalary defaultSalary={{ type: 'hourly', amount: 15000 }} />);
    expect(screen.getByText('시급 15,000원')).toBeTruthy();
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
    expect(screen.getByText('시급 15,000원')).toBeTruthy();
    expect(screen.getByText('일급 120,000원')).toBeTruthy();
  });

  it("'other' 타입은 금액 없이 '협의'", () => {
    render(<RoleSalaryDisplay useSameSalary defaultSalary={{ type: 'other', amount: 0 }} />);
    expect(screen.getByText('협의')).toBeTruthy();
  });
});

describe('SalarySummary 급여 요약 (short 표기 출력 불변)', () => {
  it('단일 금액 short: "금액원"', () => {
    render(
      <SalarySummary
        roles={[
          { role: 'dealer', salary: { type: 'hourly', amount: 15000 } },
          { role: 'floor', salary: { type: 'hourly', amount: 15000 } },
        ]}
      />
    );
    expect(screen.getByText('15,000원')).toBeTruthy();
  });

  it('범위 short: "최소원 ~ 최대원"', () => {
    render(
      <SalarySummary
        roles={[
          { role: 'dealer', salary: { type: 'hourly', amount: 10000 } },
          { role: 'floor', salary: { type: 'hourly', amount: 20000 } },
        ]}
      />
    );
    expect(screen.getByText('10,000원 ~ 20,000원')).toBeTruthy();
  });
});
