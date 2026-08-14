/**
 * venueSettlementContext — 지점(컨테이너) 정산 컨텍스트의 단일 소스.
 *
 * 왜 별도 파일인가: 지점 직속 배치 근무의 급여 근거는 **컨테이너의 역할별 단가표**
 * (`schedule.roleSalaries`)다. 그런데 일반 공고의 급여 근거는 `schedule.requirements[]`
 * → `getPostingSettlementContext()` 가 읽는다. 컨테이너에는 requirements 가 없으므로
 * 공고용 해소기를 컨테이너에 그대로 쓰면 **roles 가 빈 배열**이 되어 단가표가 통째로 무시되고
 * 폴백 단가(시급 15,000원)로 계산된다.
 *
 * 🔴 이게 실제로 화면과 저장값을 갈라놓고 있었다:
 *    - 읽기(지점 정산 화면)는 `container.roleSalaries` 로 계산해 예: 20,000원/h 를 보여주고
 *    - 쓰기(settleWorkLogWithTransaction)는 canonical 재계산에서 15,000원/h 를 써서
 *      **사장이 본 금액과 다른 금액이 확정·지급 기록으로 남는다.**
 *    canonical 재계산은 호출자가 넘긴 amount 를 덮어쓰므로 화면이 옳아도 소용이 없다.
 *
 * 그래서 읽기·쓰기가 같은 함수를 통과하게 만든다. 한쪽만 고치면 다음에 또 갈라진다.
 */
import type { JobRoleStats, PostingRoleCatalogEntry, PostingSettlementContext } from '@/types';

/**
 * 정산 금액 해소가 실제로 읽는 최소 형태. 공고 컨텍스트(roles=JobRoleStats[])와
 * 컨테이너 단가표(roles=PostingRoleCatalogEntry[])를 함께 수용한다 —
 * 해소기는 role/customRole/salary 만 읽으므로 count/filled 는 필요 없다.
 */
export type SettlementResolutionContext = {
  roles: JobRoleStats[] | PostingRoleCatalogEntry[];
  defaultSalary?: PostingSettlementContext['defaultSalary'];
  allowances?: PostingSettlementContext['allowances'];
  taxSettings?: PostingSettlementContext['taxSettings'];
};

/**
 * 컨테이너 단가표 → 정산 컨텍스트.
 *
 * allowances/taxSettings 를 undefined 로 두는 것은 누락이 아니다 — 지점 직속 배치는
 * 공고가 없어 공고 수당·세금 설정이 존재하지 않는다. 근무별 override
 * (customAllowances/customTaxSettings)만 `getEffectiveAllowances`/`getEffectiveTaxSettings`
 * 가 얹는다.
 */
export function buildVenueContainerContext(
  roleSalaries: PostingRoleCatalogEntry[] | undefined
): SettlementResolutionContext {
  return {
    // 🔑 폴백 단가(시급 15,000원)를 **명시 주입하지 않는다**(감사 3-1).
    //    주입해 두면 표시 해소기(getDisplayRoleSalaryFromSettlementSource)가 그것을
    //    "구인자가 설정한 기본급"으로 오인해, 합의된 적 없는 금액을 스태프에게
    //    확정 금액으로 보여준다. 계산 계층은 getRoleSalaryFromRoles 내부에서
    //    여전히 같은 폴백을 적용하므로 **금액 산출 결과는 바뀌지 않는다**.
    roles: roleSalaries ?? [],
    defaultSalary: undefined,
    allowances: undefined,
    taxSettings: undefined,
  };
}
