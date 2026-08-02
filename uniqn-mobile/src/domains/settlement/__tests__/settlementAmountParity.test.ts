/**
 * 정산 금액 계산기 — 클라 구현 ↔ 서버 이식본 **짝 픽스처** 테스트.
 *
 * 배경(감사 L1 잔여): `SettlementRepository.calculateSettlementAmount`(TS)가
 * `public.fn_settlement_amount`(PL/pgSQL)로 **옮겨졌다**. 두 언어에 같은 규칙이 있으면
 * 한쪽만 고쳐질 때 "화면 금액과 지급 기록이 다른" 상태가 조용히 생긴다.
 *
 * 그래서 아래 픽스처 표는 **짝 파일과 1:1 로 같아야 한다**:
 *   supabase/tests/settlement_amount_calc.test.sql
 * 같은 입력 · 같은 기대값이며, 케이스를 한쪽에만 추가하면 양쪽의 케이스 수 단언이 깨진다.
 *
 * ⚠️ 이 파일은 `calculateSettlementAmount` 가 통과하던 체인을 그대로 재구성한다
 *    (컨테이너 분기 → getEffective* → SettlementCalculator.calculate → afterTaxPay).
 *    구현을 복제하는 게 아니라 **호출 순서를 고정**하는 것이 목적이다 —
 *    이 순서가 바뀌면 서버 이식본과 갈라진다.
 */
import { SettlementCalculator } from '../SettlementCalculator';
import { buildVenueContainerContext } from '../venueSettlementContext';
import {
  getEffectiveSalaryInfoFromRoles,
  getEffectiveAllowances,
  getEffectiveTaxSettings,
} from '../helpers';
import { getRoleSalaries } from '@/domains/workSchedule/roleSalaries';
import { getPostingSettlementContext } from '@/domains/job-posting';
import type { JobPosting } from '@/types';

// ============================================================================
// 체인 재구성 — 삭제된 calculateSettlementAmount 와 동일한 호출 순서
// ============================================================================

interface FixtureWorkLog {
  checkInTime?: string;
  checkOutTime?: string;
  role?: string;
  customRole?: string;
  customSalaryInfo?: unknown;
  customAllowances?: unknown;
  customTaxSettings?: unknown;
}

interface FixturePosting {
  status: string;
  schedule: unknown;
  roleCatalog: unknown[];
  compensation: Record<string, unknown>;
}

function clientAfterTaxPay(workLog: FixtureWorkLog, posting: FixturePosting): number {
  const ctx =
    posting.status === 'container'
      ? buildVenueContainerContext(getRoleSalaries(posting.schedule))
      : getPostingSettlementContext(posting as unknown as JobPosting);

  const wl = workLog as never;
  const salaryInfo = getEffectiveSalaryInfoFromRoles(wl, ctx.roles, ctx.defaultSalary);
  const allowances = getEffectiveAllowances(wl, ctx.allowances);
  const taxSettings = getEffectiveTaxSettings(wl, ctx.taxSettings);

  return SettlementCalculator.calculate({
    startTime: workLog.checkInTime,
    endTime: workLog.checkOutTime,
    salaryInfo,
    allowances,
    taxSettings,
  }).afterTaxPay;
}

// ============================================================================
// 픽스처 표 — 🔴 supabase/tests/settlement_amount_calc.test.sql 과 1:1
// ============================================================================

const IN = '2026-08-01T10:00:00.000Z';
const OUT_8H = '2026-08-01T18:00:00.000Z';
const OUT_7H30 = '2026-08-01T17:30:00.000Z';
const OUT_5H = '2026-08-01T15:00:00.000Z';
const OUT_1H = '2026-08-01T11:00:00.000Z';

/** 실제 prod 공고(e558ca64) 형태 — 역할별 단가 + 식비 + 제공(-1) 2종 + 3.3% */
const REAL_POSTING: FixturePosting = {
  status: 'active',
  schedule: {
    requirements: [
      { timeSlots: [{ roles: [{ role: 'dealer', count: 2 }] }] },
      { timeSlots: [{ roles: [{ role: 'floor', count: 1 }] }] },
    ],
  },
  roleCatalog: [
    { role: 'dealer', salary: { type: 'hourly', amount: 20000 } },
    { role: 'floor', salary: { type: 'hourly', amount: 30000 } },
  ],
  compensation: {
    allowances: { meal: 20000, accommodation: -1, transportation: -1, guaranteedHours: 4 },
    taxSettings: { type: 'rate', value: 3.3 },
    defaultSalary: { type: 'hourly', amount: 20000 },
  },
};

const BARE_POSTING: FixturePosting = {
  status: 'active',
  schedule: { requirements: [] },
  roleCatalog: [],
  compensation: {},
};

const CONTAINER = (roleSalaries: unknown[]): FixturePosting => ({
  status: 'container',
  schedule: { kind: 'dated', roleSalaries },
  roleCatalog: [],
  compensation: {},
});

interface Fixture {
  name: string;
  workLog: FixtureWorkLog;
  posting: FixturePosting;
  expected: number;
}

const FIXTURES: Fixture[] = [
  {
    name: '01 일반공고 dealer 8h — 단가표 20,000 + 식비 20,000, 제공(-1) 2종 제외, 3.3%',
    workLog: { checkInTime: IN, checkOutTime: OUT_8H, role: 'dealer' },
    posting: REAL_POSTING,
    expected: 174060, // 160000 + 20000 = 180000, 세금 round(180000*0.033)=5940
  },
  {
    name: '02 일반공고 floor 8h — 역할별 단가가 defaultSalary 를 이긴다',
    workLog: { checkInTime: IN, checkOutTime: OUT_8H, role: 'floor' },
    posting: REAL_POSTING,
    expected: 251420, // 240000 + 20000 = 260000, 세금 8580
  },
  {
    name: '03 단가표에 없는 역할 → defaultSalary 폴백',
    workLog: { checkInTime: IN, checkOutTime: OUT_8H, role: 'serving' },
    posting: REAL_POSTING,
    expected: 174060,
  },
  {
    name: '04 7시간 30분 — 반올림 전 원값으로 기본급을 낸다',
    workLog: { checkInTime: IN, checkOutTime: OUT_7H30, role: 'dealer' },
    posting: REAL_POSTING,
    expected: 164390, // 150000 + 20000 = 170000, 세금 5610
  },
  {
    name: '05 퇴근 시각 없음 → 수당·세금 무시하고 전 항목 0',
    workLog: { checkInTime: IN, role: 'dealer' },
    posting: REAL_POSTING,
    expected: 0,
  },
  {
    name: '06 컨테이너 — 지점 단가표 매칭(25,000/h × 5h)',
    workLog: { checkInTime: IN, checkOutTime: OUT_5H, role: 'dealer' },
    posting: CONTAINER([{ role: 'dealer', salary: { type: 'hourly', amount: 25000 } }]),
    expected: 125000,
  },
  {
    name: '07 컨테이너 — 단가표 미매칭 시 하드코딩 폴백 15,000/h',
    workLog: { checkInTime: IN, checkOutTime: OUT_5H, role: 'floor' },
    posting: CONTAINER([{ role: 'dealer', salary: { type: 'hourly', amount: 25000 } }]),
    expected: 75000,
  },
  {
    name: '08 컨테이너 — role 이 빈 문자열인 항목은 통째로 드롭된다',
    workLog: { checkInTime: IN, checkOutTime: OUT_5H, role: 'dealer' },
    posting: CONTAINER([
      { role: '', salary: { type: 'hourly', amount: 99999 } },
      { role: 'dealer', salary: { type: 'hourly', amount: 25000 } },
    ]),
    expected: 125000,
  },
  {
    name: '09 override 급여가 단가표를 이긴다 (일급은 시간 무관 전액)',
    workLog: {
      checkInTime: IN,
      checkOutTime: OUT_5H,
      role: 'dealer',
      customSalaryInfo: { type: 'daily', amount: 123000 },
    },
    posting: REAL_POSTING,
    expected: 138281, // 123000 + 20000 = 143000, 세금 round(143000*0.033)=4719
  },
  {
    name: "10 급여 타입 'other'(협의)는 기본급 0원",
    workLog: {
      checkInTime: IN,
      checkOutTime: OUT_5H,
      role: 'dealer',
      customSalaryInfo: { type: 'other', amount: 50000 },
    },
    posting: BARE_POSTING,
    expected: 0,
  },
  {
    name: '11 정액세는 클램프가 없다 → 세후 음수 허용',
    workLog: {
      checkInTime: IN,
      checkOutTime: OUT_1H,
      role: 'dealer',
      customSalaryInfo: { type: 'hourly', amount: 10000 },
      customTaxSettings: { type: 'fixed', value: 30000 },
    },
    posting: BARE_POSTING,
    expected: -20000,
  },
  {
    name: '12 taxableItems opt-out — basePay 를 과세표준에서 뺀다',
    workLog: {
      checkInTime: IN,
      checkOutTime: OUT_8H,
      role: 'dealer',
      customSalaryInfo: { type: 'hourly', amount: 10000 },
      customAllowances: { meal: 10000 },
      customTaxSettings: { type: 'rate', value: 10, taxableItems: { basePay: false } },
    },
    posting: BARE_POSTING,
    expected: 89000, // 총 90000, 과세표준 10000 → 세금 1000
  },
  {
    name: '13 taxableItems 부분 지정 — 미지정 키는 포함(opt-out 설계)',
    workLog: {
      checkInTime: IN,
      checkOutTime: OUT_8H,
      role: 'dealer',
      customSalaryInfo: { type: 'hourly', amount: 10000 },
      customAllowances: { meal: 10000 },
      customTaxSettings: { type: 'rate', value: 10, taxableItems: { transportation: false } },
    },
    posting: BARE_POSTING,
    expected: 81000, // 과세표준 90000 → 세금 9000
  },
  {
    name: '14 빈 객체 수당 override 는 공고 수당을 무시한다',
    workLog: {
      checkInTime: IN,
      checkOutTime: OUT_8H,
      role: 'dealer',
      customSalaryInfo: { type: 'hourly', amount: 10000 },
      customAllowances: {},
    },
    posting: { ...BARE_POSTING, compensation: { allowances: { meal: 50000 } } },
    expected: 80000,
  },
  {
    name: "15 role='other' + customRole 로 단가표를 찾는다",
    workLog: { checkInTime: IN, checkOutTime: OUT_5H, role: 'other', customRole: '바텐더' },
    posting: {
      status: 'active',
      schedule: {
        requirements: [
          { timeSlots: [{ roles: [{ role: 'other', customRole: '바텐더', count: 1 }] }] },
        ],
      },
      roleCatalog: [
        { role: 'other', customRole: '바텐더', salary: { type: 'hourly', amount: 40000 } },
      ],
      compensation: {},
    },
    expected: 200000,
  },
  {
    name: '16 역할 미지정(빈 문자열)은 단가표를 보지 않고 폴백으로 간다',
    workLog: { checkInTime: IN, checkOutTime: OUT_5H, role: '' },
    posting: REAL_POSTING,
    expected: 116040, // defaultSalary 20000 × 5h = 100000 + 20000 = 120000, 세금 3960
  },
];

describe('정산 금액 계산기 짝 픽스처 (클라 ↔ fn_settlement_amount)', () => {
  it.each(FIXTURES.map((f) => [f.name, f] as const))('%s', (_name, fixture) => {
    expect(clientAfterTaxPay(fixture.workLog, fixture.posting)).toBe(fixture.expected);
  });

  it('🔴 픽스처 수가 짝 pgTAP 파일과 같다 (한쪽만 추가하면 여기서 깨진다)', () => {
    // supabase/tests/settlement_amount_calc.test.sql 의 plan() 도 같은 수를 쓴다.
    expect(FIXTURES).toHaveLength(16);
  });
});
