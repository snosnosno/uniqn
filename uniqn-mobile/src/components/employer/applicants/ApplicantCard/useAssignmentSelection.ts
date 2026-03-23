/**
 * UNIQN Mobile - ?쇱젙 ?좏깮 而ㅼ뒪? ?? *
 * @description 吏?먯옄 移대뱶?먯꽌 ?쇱젙 ?좏깮 ?곹깭 愿由? *   + 洹몃９ ?좏깮 湲곕뒫 吏??(?곗냽/?ㅼ쨷 ?좎쭨 ?듯빀)
 * @version 1.1.0
 */

import { useState, useMemo, useCallback } from 'react';
import { getAssignmentRoles } from '@/domains/application';
import type { Assignment } from '@/types';
import { formatAssignments, createAssignmentKey, getDateFromKey } from './utils';
import { isConsecutiveDates } from '@/utils/scheduleGrouping';
import type { AssignmentDisplay, GroupedAssignmentDisplay } from './types';

// ============================================================================
// Types
// ============================================================================

export interface UseAssignmentSelectionProps {
  /** 吏?먯옄??assignments 諛곗뿴 */
  assignments?: Assignment[];
  /** 怨좎젙怨듦퀬 紐⑤뱶 (?쇱젙 ?좏깮 鍮꾪솢?깊솕) */
  isFixedMode?: boolean;
}

/** 洹몃９ ?좏깮 ?곹깭 */
export type GroupSelectionState = 'all' | 'some' | 'none';

export interface UseAssignmentSelectionReturn {
  /** ?좏깮???쇱젙 ??Set */
  selectedKeys: Set<string>;
  /** ?щ㎎???쇱젙 ?쒖떆 諛곗뿴 */
  assignmentDisplays: AssignmentDisplay[];
  /** 洹몃９?붾맂 ?쇱젙 ?쒖떆 諛곗뿴 (?곗냽/?ㅼ쨷 ?좎쭨 ?듯빀) */
  groupedAssignments: GroupedAssignmentDisplay[];
  /** 紐⑤뱺 ?쇱젙 ??諛곗뿴 */
  allAssignmentKeys: string[];
  /** ?좏깮???쇱젙 媛쒖닔 */
  selectedCount: number;
  /** ?꾩껜 ?쇱젙 媛쒖닔 */
  totalCount: number;
  /** ?쇱젙 ?좏깮/?댁젣 ?좉? (媛숈? ?좎쭨?먮뒗 ?섎굹留??좏깮) */
  toggleAssignment: (key: string) => void;
  /** 洹몃９ ?꾩껜 ?좏깮/?댁젣 ?좉? */
  toggleGroup: (groupId: string) => void;
  /** 洹몃９ ?좏깮 ?곹깭 ?뺤씤 */
  getGroupSelectionState: (groupId: string) => GroupSelectionState;
  /** ?좏깮???쇱젙??Assignment 諛곗뿴濡?諛섑솚 */
  getSelectedAssignments: () => Assignment[];
  /** ?좏깮 珥덇린??*/
  clearSelection: () => void;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * ?쇱젙 ?좏깮 ?곹깭 愿由??? *
 * @description
 * - ?쇱젙 ?좏깮/?댁젣 ?곹깭 愿由? * - 媛숈? ?좎쭨?먮뒗 ?섎굹????븷/?쒓컙留??좏깮 媛??(?먮룞 援먯껜)
 * - ?좏깮???쇱젙??Assignment 諛곗뿴濡?蹂?? *
 * @example
 * ```tsx
 * const {
 *   selectedKeys,
 *   assignmentDisplays,
 *   selectedCount,
 *   toggleAssignment,
 *   getSelectedAssignments,
 * } = useAssignmentSelection({
 *   assignments: applicant.assignments,
 *   isFixedMode: false,
 * });
 *
 * // 泥댄겕諛뺤뒪 ?좉?
 * <Pressable onPress={() => toggleAssignment(key)}>
 *   ...
 * </Pressable>
 *
 * // ?뺤젙 ???좏깮???쇱젙 ?꾨떖
 * const selected = getSelectedAssignments();
 * onConfirm(applicant, selected);
 * ```
 */
/**
 * 洹몃９ ID ?앹꽦 (timeSlot + role 議고빀)
 */
function createGroupId(timeSlot: string, role: string): string {
  return `${timeSlot}_${role}`;
}

export function useAssignmentSelection({
  assignments,
  isFixedMode = false,
}: UseAssignmentSelectionProps): UseAssignmentSelectionReturn {
  // ?쇱젙 ?좏깮 ?곹깭 (key: "date_timeSlot_role")
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Assignments ?뺣낫 ?щ㎎
  const assignmentDisplays = useMemo(() => formatAssignments(assignments), [assignments]);

  // 洹몃９?붾맂 ?쇱젙 (媛숈? timeSlot + role 臾띠쓬)
  const groupedAssignments = useMemo<GroupedAssignmentDisplay[]>(() => {
    if (assignmentDisplays.length === 0) return [];

    // 洹몃９ 留? groupId -> items
    const groupMap = new Map<string, AssignmentDisplay[]>();

    for (const display of assignmentDisplays) {
      const groupId = createGroupId(display.timeSlot, display.role);
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, []);
      }
      groupMap.get(groupId)!.push(display);
    }

    // 洹몃９ 諛곗뿴 ?앹꽦
    const groups: GroupedAssignmentDisplay[] = [];
    for (const [groupId, items] of groupMap.entries()) {
      // ?좎쭨???뺣젹
      const sortedItems = [...items].sort((a, b) => a.date.localeCompare(b.date));
      const dates = sortedItems.map((item) => item.date);
      const firstItem = sortedItems[0];

      groups.push({
        groupId,
        dateRange: {
          start: dates[0],
          end: dates[dates.length - 1],
          dates,
          totalDays: dates.length,
          isConsecutive: isConsecutiveDates(dates),
        },
        timeSlotDisplay: firstItem.timeSlotDisplay,
        roleLabel: firstItem.roleLabel,
        role: firstItem.role,
        timeSlot: firstItem.timeSlot,
        items: sortedItems,
      });
    }

    // ?쒖옉 ?좎쭨???뺣젹
    return groups.sort((a, b) => a.dateRange.start.localeCompare(b.dateRange.start));
  }, [assignmentDisplays]);

  // 紐⑤뱺 ?쇱젙 ??紐⑸줉 (??븷蹂꾨줈 遺꾨━)
  const allAssignmentKeys = useMemo(() => {
    const keys: string[] = [];
    for (const display of assignmentDisplays) {
      keys.push(createAssignmentKey(display.date, display.timeSlot, display.role));
    }
    return keys;
  }, [assignmentDisplays]);

  // ?좏깮???쇱젙 媛쒖닔
  const selectedCount = selectedKeys.size;
  const totalCount = allAssignmentKeys.length;

  /**
   * ?쇱젙 ?좉? (媛숈? ?좎쭨?먮뒗 ?섎굹留??좏깮 媛??
   *
   * @description
   * - ?대? ?좏깮????ぉ ?대┃ ?? ?댁젣
   * - ?덈줈 ?좏깮 ?? 媛숈? ?좎쭨???ㅻⅨ ??ぉ ?먮룞 ?쒓굅
   */
  const toggleAssignment = useCallback(
    (key: string) => {
      if (isFixedMode) return; // 怨좎젙怨듦퀬 紐⑤뱶?먯꽌???좏깮 遺덇?

      setSelectedKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          // ?대? ?좏깮????ぉ ?대┃ ???댁젣
          next.delete(key);
        } else {
          // ?덈줈 ?좏깮 ?? 媛숈? ?좎쭨???ㅻⅨ ??ぉ???쒓굅
          const selectedDate = getDateFromKey(key);
          // 媛숈? ?좎쭨??湲곗〈 ?좏깮 ??ぉ ?쒓굅
          for (const existingKey of prev) {
            const existingDate = getDateFromKey(existingKey);
            if (existingDate === selectedDate) {
              next.delete(existingKey);
            }
          }
          next.add(key);
        }
        return next;
      });
    },
    [isFixedMode]
  );

  /**
   * ?좏깮???쇱젙?쇰줈 Assignment 諛곗뿴 ?앹꽦 (??븷蹂꾨줈 遺꾨━)
   */
  const getSelectedAssignments = useCallback((): Assignment[] => {
    if (!assignments || isFixedMode) return [];

    const result: Assignment[] = [];
    for (const assignment of assignments) {
      const roles = getAssignmentRoles(assignment);

      for (const role of roles) {
        const selectedDates = assignment.dates.filter((date) =>
          selectedKeys.has(createAssignmentKey(date, assignment.timeSlot, role))
        );
        if (selectedDates.length > 0) {
          result.push({
            ...assignment,
            roleIds: [role], // v3.0: roleIds 諛곗뿴濡??ㅼ젙
            dates: selectedDates,
          });
        }
      }
    }
    return result;
  }, [assignments, selectedKeys, isFixedMode]);

  /**
   * 洹몃９ ?좏깮 ?곹깭 ?뺤씤
   */
  const getGroupSelectionState = useCallback(
    (groupId: string): GroupSelectionState => {
      const group = groupedAssignments.find((g) => g.groupId === groupId);
      if (!group) return 'none';

      const groupKeys = group.items.map((item) =>
        createAssignmentKey(item.date, item.timeSlot, item.role)
      );

      const selectedInGroup = groupKeys.filter((key) => selectedKeys.has(key)).length;

      if (selectedInGroup === 0) return 'none';
      if (selectedInGroup === groupKeys.length) return 'all';
      return 'some';
    },
    [groupedAssignments, selectedKeys]
  );

  /**
   * 洹몃９ ?꾩껜 ?좏깮/?댁젣 ?좉?
   *
   * @description
   * - ?꾩껜 ?좏깮 ?곹깭: ?꾩껜 ?댁젣
   * - ?쇰?/誘몄꽑???곹깭: ?꾩껜 ?좏깮
   * - 媛숈? ?좎쭨???ㅻⅨ 洹몃９ ??ぉ? ?먮룞 ?쒓굅??   */
  const toggleGroup = useCallback(
    (groupId: string) => {
      if (isFixedMode) return;

      const group = groupedAssignments.find((g) => g.groupId === groupId);
      if (!group) return;

      const state = getGroupSelectionState(groupId);

      setSelectedKeys((prev) => {
        const next = new Set(prev);

        if (state === 'all') {
          // ?꾩껜 ?댁젣
          for (const item of group.items) {
            const key = createAssignmentKey(item.date, item.timeSlot, item.role);
            next.delete(key);
          }
        } else {
          // ?꾩껜 ?좏깮 (媛숈? ?좎쭨???ㅻⅨ ??ぉ ?쒓굅)
          for (const item of group.items) {
            const key = createAssignmentKey(item.date, item.timeSlot, item.role);

            // 媛숈? ?좎쭨??湲곗〈 ?좏깮 ??ぉ ?쒓굅
            for (const existingKey of prev) {
              const existingDate = getDateFromKey(existingKey);
              if (existingDate === item.date && !next.has(key)) {
                next.delete(existingKey);
              }
            }

            next.add(key);
          }
        }

        return next;
      });
    },
    [isFixedMode, groupedAssignments, getGroupSelectionState]
  );

  /**
   * ?좏깮 珥덇린??   */
  const clearSelection = useCallback(() => {
    setSelectedKeys(new Set());
  }, []);

  return {
    selectedKeys,
    assignmentDisplays,
    groupedAssignments,
    allAssignmentKeys,
    selectedCount,
    totalCount,
    toggleAssignment,
    toggleGroup,
    getGroupSelectionState,
    getSelectedAssignments,
    clearSelection,
  };
}

export default useAssignmentSelection;
