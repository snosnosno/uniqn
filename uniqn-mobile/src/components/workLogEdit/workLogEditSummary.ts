/**
 * workLogEditSummary — 접힘 섹션의 한 줄 요약
 *
 * 🔑 "접힌 줄은 숨김이 아니라 **읽기**다"(설계 §3-1). 확인만 하려는 사용자는 펼칠 필요가 없어야
 *    하고, 값이 없을 때도 빈 칸이 아니라 `미정` 처럼 **정보가 되는 말**이 서야 한다.
 *
 * 🔑 요약은 **값 부분만** 담는다. `CollapsibleSection` 이 제목을 이미 그리므로 요약에까지 제목을
 *    넣으면 화면에 `출근 예정   출근 예정 미정` 으로 두 번 나온다. 설계 §3-1 의
 *    `출근 예정 미정` / `역할 미지정` 은 제목 + 요약이 **합쳐진 줄**을 가리킨 표현이다.
 */
import { SLOT_COLOR_CHIPS } from '@/domains/workSchedule';
import { STAFF_ROLE_LABELS, type StaffRole } from '@/types/role';

/** 요약 항목 구분자. */
const SEPARATOR = ' · ';

/** 퇴역 팔레트 토큰은 이름이 없다 — 칩 라벨 대신 무엇인지 설명한다. */
const LEGACY_COLOR_LABEL = '지난 팔레트 색';

/**
 * ⚠️ 출근 예정용 요약 함수는 **의도적으로 없다.** 예정 축은 접지 않기로 **사용자가 결정했고**
 *    (2026-08-06 — `WorkLogEditSheet` 상단 주석에 근거), `WorkTimeFields` 안에서 실적과 한
 *    덩어리로 항상 보이므로 요약을 소비할 자리가 없다. 빈 상태 문구(§3-1)는 그 컴포넌트의
 *    예정 행이 '미정'으로 직접 말한다. 예정이 접히는 구조로 되돌아가면 그때 되살린다.
 */

/** 색 토큰 → 사람이 읽는 이름. 화이트리스트 밖 값(자유 hex 등)은 표기하지 않는다. */
function colorLabel(color: string | null): string | null {
  if (!color) return null;
  const chip = SLOT_COLOR_CHIPS.find((candidate) => candidate.token === color);
  if (chip) return chip.label;
  return LEGACY_COLOR_LABEL;
}

/**
 * 역할 + 구분 색 요약.
 *
 * 🔑 `other` 는 `customRole` 과 짝이다. 이 시트는 커스텀 이름을 **고칠 수 없지만**(RPC 패치에
 *    담을 키가 없다 — Task 3 확정), 지금 무엇으로 저장돼 있는지는 읽히게 한다. 안 그러면
 *    `바리스타` 로 저장된 스태프가 목록에서만 이름을 갖고 편집 화면에서는 그냥 `기타` 가 된다.
 */
export function buildRoleSummary(
  role: StaffRole,
  customRole: string | null,
  color: string | null
): string {
  const parts: string[] = [STAFF_ROLE_LABELS[role]];

  const custom = (customRole ?? '').trim();
  if (role === 'other' && custom !== '') parts.push(custom);

  const label = colorLabel(color);
  if (label) parts.push(label);

  return parts.join(SEPARATOR);
}
