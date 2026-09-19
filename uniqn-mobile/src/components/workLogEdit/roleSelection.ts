/**
 * roleSelection — 역할 선택 한 쌍과 그 **접기 규칙 한 벌**
 *
 * 🔴 이 모듈이 따로 있는 이유는 **접기가 두 곳에서 쓰이기 때문**이다: 칩의 선택 표식(`SlotRoleChips`)
 *    과 패치 생성(`workLogEditPayload`). 두 곳이 각자 정규화하면 규칙이 갈리는 입력에서
 *    **표준 칩도 이름 칩도 선택되지 않는** 상태가 만들어진다(실제로 그렇게 회귀했다 —
 *    `role='dealer'` + `custom_role='바리스타'` 표류 행에서 선택 표식이 하나도 없었다).
 *    새 규칙을 만들지 말고 여기 것을 쓸 것.
 */
import type { StaffRole } from '@/types';

/**
 * 역할 선택 = (표준 직무, 기타 이름) **한 쌍**.
 *
 * 🔴 불변식: `role !== 'other'` 이면 `customRole` 은 `null` 이다. 칩은 이 쌍을 통째로만 만들어
 *    내므로 서버가 거부하는 모순 조합(판정표 ③)이 UI 단계에서 사라진다.
 *    ⚠️ 다만 **DB 에서 읽어 온 값은 이 불변식을 만족하지 않을 수 있다** — `work_logs` 에
 *    (role, custom_role) 정합을 강제하는 CHECK 제약이 없어 표류 행이 존재할 수 있다.
 *    그래서 화면에 들일 때 `foldRoleSelection` 을 한 번 통과시킨다.
 */
export interface SlotRoleSelection {
  role: StaffRole;
  /** `other` 역할의 이름. 표준 직무에서는 null. */
  customRole: string | null;
}

/**
 * 이름 정규화 — btrim 후 빈 문자열은 **없음(null)** 이다.
 *
 * 🔑 서버와 같은 규칙이다(`btrim(...) = '' → NULL`, 마이그 20260807120000:255-258). 여기서
 *    구분하면 "보낼 때는 다른데 저장되면 같은" 두 표현이 생긴다.
 * ⚠️ 역할 축은 보지 않는다 — 그건 `foldRoleSelection` 의 일이다.
 */
export function trimmedCustomRole(customRole: string | null | undefined): string | null {
  const trimmed = (customRole ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * 선택 접기 — 표준 역할이면 이름을 **버린다**.
 *
 * 반환값은 불변식을 만족한다: `customRole` 이 non-null 이면 `role` 은 반드시 `'other'` 다.
 * 그래서 접힌 값끼리 비교하면 "표준 칩과 이름 칩 중 정확히 하나"가 선택된다.
 */
export function foldRoleSelection(selection: SlotRoleSelection): SlotRoleSelection {
  const custom = trimmedCustomRole(selection.customRole);
  if (selection.role === 'other' && custom !== null) {
    return { role: 'other', customRole: custom };
  }
  return { role: selection.role, customRole: null };
}

/**
 * 접힌 선택 → 정원 판정용 역할키. `selectPostingRoleAvailability` 의 `item.key` 와 **같은 축**이다
 * (이름 붙은 other 는 이름 문자열, 그 외는 역할 키).
 */
export function roleSelectionKey(selection: SlotRoleSelection): string {
  const folded = foldRoleSelection(selection);
  return folded.customRole ?? folded.role;
}
