/**
 * 표시 전용 급여 해소 — 합의 없는 폴백 단가를 금액처럼 보여주지 않는다 (감사 3-1)
 *
 * @description 기존 해소기(`getRoleSalaryFromSettlementSource`)는 **모든 분기에서**
 *   `defaultSalary ?? DEFAULT_SALARY_INFO(시급 15,000원)` 를 반환해 undefined 가 불가능했다.
 *   그래서 소비처의 `?? null`·`if (!salary)` 가드가 전부 죽은 코드였고, 스태프는
 *   합의한 적 없는 15,000원 기준 '총 정산 금액'을 받을 돈으로 믿게 됐다.
 *   (같은 행을 사장 화면은 '기본 단가 적용' 경고 배지로 표시 — 한쪽엔 미정, 한쪽엔 확정)
 *
 * 🔑 구분이 핵심이다. `defaultSalary` 는 두 가지가 섞여 있었다.
 *   ① 구인자가 '전 역할 동일 급여'로 **설정한 값** → 합의된 금액이므로 계속 보여준다.
 *   ② 아무 근거가 없어 시스템이 메운 `DEFAULT_SALARY_INFO` → 합의가 아니므로 감춘다.
 *   둘을 같이 지우면 정당하게 합의된 급여까지 사라진다(반대 방향 회귀).
 *
 * ⚠️ 계산 계층은 건드리지 않는다 — `getRoleSalaryFromRoles`/`calculateSettlementBreakdown`
 *   소비처들(settlementCalculation·settlementQuery)은 null 가드가 없어 크래시한다.
 *   폴백 제거는 **표시 계층 한정**이다.
 */

import {
  getDisplayRoleSalaryFromSettlementSource,
  getRoleSalaryFromSettlementSource,
} from '../helpers';
import { buildVenueContainerContext } from '../venueSettlementContext';
import { DEFAULT_SALARY_INFO } from '@/utils/settlement/constants';

type SettlementSource = Parameters<typeof getDisplayRoleSalaryFromSettlementSource>[0];

const DEALER_RATE = { type: 'hourly' as const, amount: 22000 };

describe('getDisplayRoleSalaryFromSettlementSource', () => {
  it('역할 단가표에 있으면 그 단가를 반환한다', () => {
    const source = {
      roles: [{ role: 'dealer', salary: DEALER_RATE }],
    } as unknown as SettlementSource;

    expect(getDisplayRoleSalaryFromSettlementSource(source, 'dealer')).toEqual(DEALER_RATE);
  });

  it('구인자가 설정한 공고 기본급(전 역할 동일)은 합의된 금액이므로 그대로 반환한다', () => {
    const source = {
      roles: [],
      defaultSalary: { type: 'hourly', amount: 10000 },
    } as unknown as SettlementSource;

    expect(getDisplayRoleSalaryFromSettlementSource(source, 'dealer')).toEqual({
      type: 'hourly',
      amount: 10000,
    });
  });

  it('🔴 근거가 전혀 없으면 null 을 반환한다 — 15,000원으로 메우지 않는다', () => {
    const source = { roles: [] } as unknown as SettlementSource;

    expect(getDisplayRoleSalaryFromSettlementSource(source, 'dealer')).toBeNull();
  });

  it('🔴 정산 컨텍스트 자체가 없으면 null 을 반환한다', () => {
    expect(getDisplayRoleSalaryFromSettlementSource(undefined, 'dealer')).toBeNull();
  });

  it('🔴 단가표에 내 역할이 없으면 null 을 반환한다 (다른 역할 단가를 빌려오지 않는다)', () => {
    const source = {
      roles: [{ role: 'dealer', salary: DEALER_RATE }],
    } as unknown as SettlementSource;

    expect(getDisplayRoleSalaryFromSettlementSource(source, 'floor')).toBeNull();
  });

  it('customRole(기타 역할)도 단가표와 매칭한다', () => {
    const source = {
      roles: [{ role: 'other', customRole: '매니저', salary: { type: 'daily', amount: 200000 } }],
    } as unknown as SettlementSource;

    expect(getDisplayRoleSalaryFromSettlementSource(source, 'other', '매니저')).toEqual({
      type: 'daily',
      amount: 200000,
    });
  });

  it('계산용 해소기는 그대로 폴백을 유지한다 (계산 계층 무회귀)', () => {
    const source = { roles: [] } as unknown as SettlementSource;

    // 표시는 null 이지만 계산은 여전히 숫자를 낸다 — 두 계층의 계약이 다르다.
    expect(getDisplayRoleSalaryFromSettlementSource(source, 'dealer')).toBeNull();
    expect(getRoleSalaryFromSettlementSource(source, 'dealer')).toEqual(DEFAULT_SALARY_INFO);
  });
});

describe('buildVenueContainerContext — 폴백 단가 명시 주입 제거', () => {
  it('🔴 컨테이너 컨텍스트에 DEFAULT_SALARY_INFO 를 주입하지 않는다', () => {
    // 주입이 남아 있으면 표시 해소기가 그것을 "구인자가 설정한 기본급"으로 오인해
    // 지점 직속 배치 근무가 계속 15,000원으로 보인다.
    expect(buildVenueContainerContext([]).defaultSalary).toBeUndefined();
  });

  it('단가표가 있으면 그대로 싣는다 (무회귀)', () => {
    const roleSalaries = [{ role: 'dealer', salary: DEALER_RATE }];

    expect(buildVenueContainerContext(roleSalaries as never).roles).toEqual(roleSalaries);
  });
});
