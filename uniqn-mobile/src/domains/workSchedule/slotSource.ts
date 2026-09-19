/**
 * slotSource — 근무표 사람 줄의 출처 판정 (순수 함수, 구인자 IA S4)
 *
 * "공고는 근무표를 채우는 도구"라는 관계가 화면에서 보이려면 줄마다 어디서 왔는지 달려 있어야
 * 한다. 이게 없어서 사장은 근무표의 사람이 어느 공고로 뽑혔는지 알 방법이 없었다.
 *
 * - 컨테이너 직속 배치(`isContainer`, job_posting_id = 지점) → `직접 배치`
 * - 공고에서 확정 → `{공고 제목} 공고에서`
 * - 제목을 못 읽었으면(다른 팀 공고·삭제·조회 실패·로딩 중) → `공고에서`.
 *   제목을 추정하거나 id 를 보여주지 않는다 — 모르는 것은 모른다고 둔다.
 */

export type SlotSource =
  | { kind: 'direct' }
  | { kind: 'posting'; jobPostingId: string; title: string | null };

/** 출처 판정에 필요한 슬롯 필드만. `VenueDaySlot` 이 이 모양을 만족한다. */
export interface SlotSourceInput {
  jobPostingId: string;
  isContainer: boolean;
}

export function resolveSlotSource(
  slot: SlotSourceInput,
  titles: ReadonlyMap<string, string>
): SlotSource {
  if (slot.isContainer) {
    return { kind: 'direct' };
  }
  const title = titles.get(slot.jobPostingId)?.trim();
  return { kind: 'posting', jobPostingId: slot.jobPostingId, title: title ? title : null };
}

export function slotSourceLabel(source: SlotSource): string {
  if (source.kind === 'direct') {
    return '직접 배치';
  }
  return source.title ? `${source.title} 공고에서` : '공고에서';
}

/** 제목을 조회할 공고 id — 컨테이너 직속은 공고가 아니므로 뺀다. 순서 유지·중복 제거. */
export function collectSourcePostingIds(slots: readonly SlotSourceInput[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const slot of slots) {
    if (slot.isContainer || !slot.jobPostingId || seen.has(slot.jobPostingId)) continue;
    seen.add(slot.jobPostingId);
    ids.push(slot.jobPostingId);
  }
  return ids;
}
