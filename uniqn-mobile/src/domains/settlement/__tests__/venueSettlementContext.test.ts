/**
 * 지점(컨테이너) 정산 컨텍스트 회귀 테스트.
 *
 * 지키는 불변식: **지점 정산 화면이 보여준 금액과 정산 확정이 저장하는 금액이 같다.**
 *
 * 이 파일이 존재하는 이유는 두 경로가 실제로 갈라져 있었기 때문이다.
 *  - 읽기(settlementVenueQuery)는 `container.roleSalaries` 로 단가를 해소했고
 *  - 쓰기(SettlementRepository.calculateSettlementAmount)는 `getPostingSettlementContext`
 *    를 써서 `schedule.requirements[]` 를 훑었다. 컨테이너엔 requirements 가 없어
 *    roles 가 빈 배열이 되고, 단가표가 통째로 무시된 채 폴백(시급 15,000원)으로 계산됐다.
 * canonical 금액은 호출자가 넘긴 amount 를 덮어쓰므로 화면이 옳아도 소용이 없었다.
 */
import {
  buildVenueContainerContext,
  getEffectiveSalaryInfoFromRoles,
  DEFAULT_SALARY_INFO,
} from '@/domains/settlement';
import { getPostingSettlementContext } from '@/domains/job-posting';
import { getRoleSalaries } from '@/domains/workSchedule/roleSalaries';
import type { JobPosting } from '@/types';
import type { WorkLogWithOverrides } from '@/services/work/settlement/types';

const VENUE_DEALER_RATE = 20000;

/** 지점 컨테이너 — requirements 가 없고 단가표는 schedule.roleSalaries 에 있다. */
function makeContainer(): JobPosting {
  return {
    id: 'venue-1',
    title: '스노의 지점',
    status: 'container',
    roleCatalog: [],
    compensation: {},
    schedule: {
      kind: 'dated',
      requirements: [],
      roleSalaries: [{ role: 'dealer', salary: { type: 'hourly', amount: VENUE_DEALER_RATE } }],
    },
  } as unknown as JobPosting;
}

/** 지점에 직접 배치된 딜러 근무 1건(4시간). 근무별 급여 override 는 없다. */
function makeWorkLog(): WorkLogWithOverrides {
  return {
    id: 'wl-1',
    role: 'dealer',
    checkInTime: '2026-08-01T10:00:00.000Z',
    checkOutTime: '2026-08-01T14:00:00.000Z',
  } as unknown as WorkLogWithOverrides;
}

describe('지점 컨테이너 정산 컨텍스트', () => {
  it('컨테이너 단가표를 급여 해소에 반영한다 (읽기·쓰기 공용 경로)', () => {
    const context = buildVenueContainerContext(getRoleSalaries(makeContainer().schedule));

    const salary = getEffectiveSalaryInfoFromRoles(
      makeWorkLog(),
      context.roles,
      context.defaultSalary
    );

    expect(salary.amount).toBe(VENUE_DEALER_RATE);
    expect(salary.type).toBe('hourly');
  });

  it('단가표가 비어 있으면 폴백 단가로 해소한다', () => {
    const context = buildVenueContainerContext([]);

    const salary = getEffectiveSalaryInfoFromRoles(
      makeWorkLog(),
      context.roles,
      context.defaultSalary
    );

    expect(salary.amount).toBe(DEFAULT_SALARY_INFO.amount);
  });

  it('회귀 근거 — 공고용 해소기를 컨테이너에 쓰면 단가표가 무시된다', () => {
    // 이 테스트가 깨진다면 컨테이너 스키마가 바뀐 것이다. 그때는 위 두 테스트가
    // 여전히 통과하는지부터 확인할 것 — 불변식은 "화면 금액 == 저장 금액" 이지
    // "공고 해소기가 실패한다" 가 아니다.
    const postingContext = getPostingSettlementContext(makeContainer());

    expect(postingContext.roles).toHaveLength(0);

    const wrongSalary = getEffectiveSalaryInfoFromRoles(
      makeWorkLog(),
      postingContext.roles,
      postingContext.defaultSalary
    );

    // 단가표(20,000)가 아니라 폴백(15,000)이 나온다 = 화면과 저장이 갈라지던 지점.
    expect(wrongSalary.amount).not.toBe(VENUE_DEALER_RATE);
    expect(wrongSalary.amount).toBe(DEFAULT_SALARY_INFO.amount);
  });
});
