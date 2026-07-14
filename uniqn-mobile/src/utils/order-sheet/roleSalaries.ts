/**
 * UNIQN Mobile - 역할별 급여 자동 프리필 (설계 §S2.3, 순수 함수)
 *
 * @description timeSlots의 고유 역할 중 roleSalaries 미커버 역할에 기본값 엔트리를 추가한다.
 * timeSlots에서 사라진 역할 엔트리는 제거하지 않고 잔류(고아 잔류 — CEO-2/Eng-M3: 제거하면
 * "직접 수정→역할 잠깐 제거→재추가" 시 사용자 금액이 침묵 리셋된다. 쓰기 경로는 toRoleCatalog가
 * timeSlots 기준으로만 전사하므로 고아는 무해). 호출은 confirm 핸들러(이벤트)에서만 — effect 금지(F3).
 */
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';
import {
  DEFAULT_ROLE_HOURLY,
  DEFAULT_ROLE_HOURLY_FALLBACK,
  DEFAULT_SALARY_BY_TYPE,
} from '@/constants/jobPosting';

type OrderSheetTimeSlots = OrderSheetValues['scheduleGroups'][number]['timeSlots'];
type OrderSheetRoleSalaries = OrderSheetValues['roleSalaries'];
type OrderSheetSalaryType = OrderSheetValues['salary']['type'];

/** 고유 역할 참조(기타는 customRole 단위) — 시트가 uniqueRoles로 직접 전달할 때 사용 */
export interface RoleSalaryRoleRef {
  role: OrderSheetRoleSalaries[number]['role'];
  customRole?: string;
}

const roleSalaryKey = (role: string, customRole?: string) =>
  role === 'other' ? `other:${customRole ?? ''}` : role;

/** 역할·타입별 기본 금액 — 시급만 역할 차등, 일/월급 균일, 협의는 금액 없음(0) */
export function defaultAmountForRole(role: string, type: OrderSheetSalaryType): number {
  if (type === 'other') return 0;
  if (type === 'hourly') return DEFAULT_ROLE_HOURLY[role] ?? DEFAULT_ROLE_HOURLY_FALLBACK;
  return DEFAULT_SALARY_BY_TYPE[type];
}

/**
 * 고유 역할 목록 기준 프리필 — 미커버 역할에 기본값 엔트리를 뒤에 추가(기존 순서·금액 보존).
 * 추가분이 없으면 입력 배열 참조를 그대로 반환한다(호출부 변경 감지용).
 */
export function syncRoleSalariesForRoles(
  roles: readonly RoleSalaryRoleRef[],
  roleSalaries: OrderSheetRoleSalaries,
  type: OrderSheetSalaryType
): OrderSheetRoleSalaries {
  const covered = new Set(roleSalaries.map((rs) => roleSalaryKey(rs.role, rs.customRole)));
  const additions: OrderSheetRoleSalaries = [];
  for (const r of roles) {
    const key = roleSalaryKey(r.role, r.customRole);
    if (covered.has(key)) continue;
    covered.add(key);
    additions.push({
      role: r.role,
      ...(r.role === 'other' && r.customRole !== undefined ? { customRole: r.customRole } : {}),
      salary: { type, amount: defaultAmountForRole(r.role, type) },
    });
  }
  return additions.length > 0 ? [...roleSalaries, ...additions] : roleSalaries;
}

/** timeSlots에서 고유 역할을 추출해 프리필한다 (설계 시그니처 — 화면 confirm 핸들러·매퍼용) */
export function syncRoleSalaries(
  timeSlots: OrderSheetTimeSlots,
  roleSalaries: OrderSheetRoleSalaries,
  type: OrderSheetSalaryType
): OrderSheetRoleSalaries {
  const roles: RoleSalaryRoleRef[] = [];
  for (const slot of timeSlots) {
    for (const r of slot.roles) {
      roles.push(r);
    }
  }
  return syncRoleSalariesForRoles(roles, roleSalaries, type);
}
