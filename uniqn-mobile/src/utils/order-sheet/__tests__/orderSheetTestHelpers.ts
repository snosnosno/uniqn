/**
 * 주문서 테스트 헬퍼 — scheduleGroups 폼 계약(S1) 픽스처 유틸
 *
 * singleGroup: 구(dates+timeSlots 평탄) 픽스처를 단일 그룹 형태로 기계 포팅(설계 Eng-L2 —
 * 신구 등가성 회귀의 기준). jest testMatch(*.test.*)에 안 걸리는 순수 헬퍼 모듈.
 */
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';

type ScheduleGroups = OrderSheetValues['scheduleGroups'];
type GroupTimeSlots = ScheduleGroups[number]['timeSlots'];

export const singleGroup = (
  dates: string[],
  timeSlots: GroupTimeSlots,
  grouped = false
): ScheduleGroups => [{ dates, timeSlots, grouped }];

/** draft/values의 하네스 생성 id(scheduleGroups·timeSlots·templateTimeSlots·roles·requirements)만 제거.
 *  알려지지 않은 깊이의 id는 의미 있는 필드일 수 있어 throw — 침묵 통과 금지(S3 T1 이월).
 *  templateTimeSlots는 mappers.ts:210이 requirements[].timeSlots와 동일한 toPostingTimeSlots(generateId)로
 *  slot·role id를 부여하는 생성 경로라 화이트리스트에 포함한다(S4 실측 — 미포함 시 dated draft에서 throw). */
export function stripKnownGeneratedIds(obj: unknown): unknown {
  const KNOWN_PARENTS = new Set([
    'scheduleGroups',
    'timeSlots',
    'templateTimeSlots',
    'roles',
    'requirements',
  ]);
  const walk = (node: unknown, parentArrayKey: string | null): unknown => {
    if (Array.isArray(node)) return node.map((v) => walk(v, parentArrayKey));
    if (node && typeof node === 'object') {
      return Object.fromEntries(
        Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => {
          if (k === 'id') {
            if (parentArrayKey && KNOWN_PARENTS.has(parentArrayKey)) return [];
            throw new Error(
              `예상 밖 id 경로: ${parentArrayKey ?? '(root)'} — stripIds 화이트리스트 재검토`
            );
          }
          return [[k, walk(v, Array.isArray(v) ? k : null)]];
        })
      );
    }
    return node;
  };
  return walk(obj, null);
}
