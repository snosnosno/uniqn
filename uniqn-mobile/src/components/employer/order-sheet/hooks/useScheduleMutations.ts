/**
 * 주문서 일정 뮤테이션 — 커밋·고지·되돌리기를 한자리에 모은다.
 *
 * `OrderSheetScreen.tsx` 에서 그대로 옮겼다(기능 보존 추출, 800줄 상한 복귀).
 * 이 화면의 **모든 일정 쓰기**가 `commitGroups` 를 지나고, 정규화가 사장이 지시하지 않은 일을
 * 했을 때의 고지는 `notifyScheduleChange` 하나가 책임진다 — 그 두 계약이 이 훅의 존재 이유다.
 */
import { useCallback, useRef, type MutableRefObject } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { UNDO_DELAY_MS } from '@/constants/undo';
import { logger } from '@/utils/logger';
import {
  normalizeScheduleGroups,
  setRunGrouped,
} from '@/utils/order-sheet/normalizeScheduleGroups';
import { applyConditionToDates, applyDateSelection } from '@/utils/order-sheet/scheduleCardEdits';
import {
  diagnoseScheduleChange,
  type ScheduleChangeContext,
} from '@/utils/order-sheet/scheduleNotices';
import type { OrderSheetFormValues, OrderSheetValues } from '@/schemas/orderSheet.schema';
import { resolveGroupIndexByDates, summarizeGroupDates } from '../orderRowMeta';
import {
  cloneSlots,
  type GroupTimeSlots,
  type ScheduleGroups,
  type SlotsTarget,
} from '../orderSheetTypes';

interface ToastAction {
  label: string;
  onPress: () => void;
}

interface ToastInput {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
  action?: ToastAction;
}

export interface UseScheduleMutationsParams {
  form: UseFormReturn<OrderSheetFormValues, unknown, OrderSheetValues>;
  addToast: (toast: ToastInput) => void;
  /** 연쇄 예약 취소 — 뮤테이션이 예약된 타깃을 무효화하므로 쓰기 전에 거둔다. */
  clearPendingSwap: () => void;
  /** 커밋 직후 역할별 급여 프리필 동기화(§S2.3). */
  applyRoleSalarySync: (nextGroups: ScheduleGroups) => void;
}

export interface UseScheduleMutationsResult {
  handleDeleteCard: (cardIndex: number) => void;
  handleDatesConfirm: (dates: string[]) => void;
  handleSlotsConfirm: (
    target: SlotsTarget,
    picked: string[],
    nextSlots: GroupTimeSlots
  ) => number | null;
  handleToggleRun: (cardIndex: number, run: string[], on: boolean) => void;
  /**
   * 승계 고지의 "다른 조건으로" 액션이 부를 진입점 — 화면이 `openException` 을 여기에 꽂는다.
   *
   * 🔑 ref 인 이유는 **선언 순환**이다. 고지는 뮤테이션 안에서 나가는데 그 액션의 목적지는
   *    시트를 여는 일이고, 시트 열기는 이 훅 바깥(연쇄 상태)이 소유한다.
   */
  openExceptionRef: MutableRefObject<((cardIndex: number) => void) | null>;
}

export function useScheduleMutations({
  form,
  addToast,
  clearPendingSwap,
  applyRoleSalarySync,
}: UseScheduleMutationsParams): UseScheduleMutationsResult {
  /** 폼 그룹 커밋 단일 경로 — 정규화·급여 동기화·시드 계약을 한자리에 모은다.
   *  화면의 모든 일정 뮤테이션이 여기를 지난다(정규화를 잊는 실수를 구조적으로 차단). */
  const commitGroups = useCallback(
    (next: ScheduleGroups) => {
      // 빈 시드 계약(§8.4) — 결과가 완전히 비면 초기 상태(mappers.initialOrderSheetValues)와
      // 같은 빈 그룹 1개를 남긴다. 정규화 자체는 fixed(scheduleGroups=[])를 깨지 않으려고
      // 시드하지 않으므로, 시드는 이 화면 계층의 책임이다.
      const seeded: ScheduleGroups =
        next.length > 0 ? next : [{ dates: [], timeSlots: [], grouped: false }];
      form.setValue('scheduleGroups', seeded, { shouldDirty: true, shouldValidate: true });
      applyRoleSalarySync(seeded);
      return seeded;
    },
    [form, applyRoleSalarySync]
  );

  /** 폼 그룹 스냅샷(깊은복사) — Undo 복원용 */
  const snapshotGroups = useCallback(
    (groups: ScheduleGroups): ScheduleGroups =>
      groups.map((g) => ({
        ...g,
        dates: [...(g.dates ?? [])],
        timeSlots: cloneSlots(g.timeSlots),
      })),
    []
  );

  // openException 은 화면이 소유한다 — 승계 고지의 "다른 조건으로" 액션이 그걸 불러야 해
  // ref 로 우회한다(handleTypeChangeRef 와 같은 선언 순환 회피 패턴).
  const openExceptionRef = useRef<((cardIndex: number) => void) | null>(null);

  /** 카드 삭제(즉시) + Undo 토스트 — impeccable §12, 리뷰 Design-M2.
   *  Undo 는 삭제 직전 전체 스냅샷 복원 — 정규화가 인덱스를 바꿀 수 있어 단건 재삽입은 성립하지 않는다. */
  const handleDeleteCard = useCallback(
    (cardIndex: number) => {
      // 연쇄 예약 취소 — 180ms 대기 창 안에서 카드를 삭제하면 예약이 사라진 카드를 가리킨다.
      clearPendingSwap();
      const current = form.getValues().scheduleGroups ?? [];
      if (current.length <= 1) return; // E4: 마지막 카드는 버튼 자체 미노출 — 방어
      const target = current[cardIndex];
      if (!target) return;
      const snapshot = snapshotGroups(current);
      commitGroups(normalizeScheduleGroups(current.filter((_, i) => i !== cardIndex)));
      addToast({
        type: 'success',
        // 날짜가 없는 조건 카드를 지우면 요약이 빈 문자열이라 폴백이 필요한데,
        // '일정' 을 끼우면 "일정 일정을 삭제했어요" 가 된다 — 문장 자체를 갈아 끼운다.
        message: (() => {
          const summary = summarizeGroupDates(target.dates ?? []);
          return summary ? `${summary} 일정을 삭제했어요` : '조건을 삭제했어요';
        })(),
        duration: UNDO_DELAY_MS,
        action: {
          label: '되돌리기',
          onPress: () => {
            clearPendingSwap();
            commitGroups(snapshot);
          },
        },
      });
    },
    [form, addToast, clearPendingSwap, commitGroups, snapshotGroups]
  );

  /**
   * 암묵 동작 고지 — **한 뮤테이션당 최대 1건**(F6 우선순위: 소멸 > 묶음해제 > 병합 > 승계).
   * 정규화가 사장이 지시하지 않은 일을 하므로 침묵도, 네 번 알리기도 안 된다.
   */
  const notifyScheduleChange = useCallback(
    (before: ScheduleGroups, after: ScheduleGroups, context: ScheduleChangeContext) => {
      const notice = diagnoseScheduleChange(before, after, context);
      if (notice === null) return;
      // 관측(§8.6) — 이 화면의 **최초 계기판**이다. 어떤 암묵 동작이 실제로 얼마나 일어나는지
      // 몰라서 "표현만 바꾸고 기능은 안 지운다"는 결정을 했으므로, 그 판단의 근거를 쌓는다.
      // ⚠️ logger.error 로 되돌리면 웹에서 sentry↔logger 무한 재귀가 재발한다(2026-08-04).
      if (notice.kind === 'merged') {
        logger.observability('order_sheet.auto_merge', undefined, {
          component: 'OrderSheetScreen',
          cardsBefore: before.length,
          cardsAfter: after.length,
        });
      } else if (notice.kind === 'inherited') {
        logger.observability('order_sheet.inherit_notice', undefined, {
          component: 'OrderSheetScreen',
          cardCount: after.length,
        });
      }
      if (notice.kind === 'cardRemoved') {
        const snapshot = snapshotGroups(before);
        addToast({
          type: 'info',
          message: notice.message,
          duration: UNDO_DELAY_MS,
          action: {
            label: '되돌리기',
            onPress: () => {
              clearPendingSwap();
              commitGroups(snapshot);
            },
          },
        });
        return;
      }
      if (notice.kind === 'inherited' && notice.inheritedCardIndex !== undefined) {
        const fallbackIndex = notice.inheritedCardIndex;
        const anchor = notice.inheritedCardDates;
        addToast({
          type: 'info',
          message: notice.message,
          duration: UNDO_DELAY_MS,
          // 설계 F10 은 "카드 선택 액션시트"를 그렸지만, 레포에 다중 선택 액션시트 자산이 없고
          // "다른 조건으로"의 결과는 결국 **그 날짜만 다른 조건을 갖는 것** = 예외 추출이다.
          // 기존 시트를 재사용해 UI 신설 없이 같은 목적지에 도달한다(기존 카드 B 의 조건을
          // 그대로 쓰고 싶으면 같은 값을 넣으면 정규화가 B 에 병합한다).
          action: {
            label: '다른 조건으로',
            onPress: () => {
              // 토스트는 5초 살아 있다 — 그 사이 카드가 병합·이동했을 수 있으므로 발화 시점에
              // 날짜집합으로 다시 찾는다(F9 를 이 액션에도 적용). 사라졌으면 조용히 엉뚱한
              // 카드를 여는 대신 고지한다(§8.4 stale confirm 과 같은 계약).
              const resolved = resolveGroupIndexByDates(form.getValues(), anchor, fallbackIndex);
              if (resolved === null) {
                addToast({ type: 'info', message: '일정이 바뀌어 반영하지 못했어요' });
                return;
              }
              openExceptionRef.current?.(resolved);
            },
          },
        });
        return;
      }
      addToast({ type: 'info', message: notice.message });
    },
    [addToast, clearPendingSwap, commitGroups, snapshotGroups, form]
  );

  /**
   * 날짜 확정 — **전 일정 스코프**. 해제분은 소속 카드에서 빠지고, 추가분은 인접 카드가
   * 조건을 승계한다(F10). 카드의 마지막 날짜가 빠지면 그 카드의 **조건까지** 사라지므로
   * 되돌릴 길을 반드시 준다(F6 — 이 화면에서 정보 손실이 가장 큰 사건이다).
   */
  const handleDatesConfirm = useCallback(
    (dates: string[]) => {
      const current = form.getValues().scheduleGroups ?? [];
      const { groups: next, removedCards, addedDates } = applyDateSelection(current, dates);
      const committed = commitGroups(next);
      notifyScheduleChange(current, committed, {
        removedCards,
        inheritedDates: addedDates,
        // 날짜를 건드리는 경로다 — 타입이 사장이 실제로 고른 날짜 수를 요구한다.
        // 이걸 안 넘기면 "날짜를 지웠다"는 조작이 "같은 조건이라 합쳐졌어요"로 오고지된다
        // (가장 흔한 조작이라 계기판까지 오염된다). 옵셔널이던 시절 3곳 중 1곳만 지켰다.
        datesTouched: true,
        expectedDateCount: new Set(dates).size,
      });
    },
    [form, commitGroups, notifyScheduleChange]
  );

  /**
   * 카드 조건 확정 — 좌표를 날짜집합으로 재해석해 stale 인덱스에 덮어쓰지 않는다(§3.7).
   *
   * ⚠️ null 분기(카드 소멸)는 **방어 경로**다. 지금 UI 에서는 시트가 모달로 화면을 덮고 있어
   *    열려 있는 동안 폼을 바꿀 길이 거의 없다 — 그래서 화면 레벨 테스트가 없다. 계약 자체는
   *    `resolveGroupIndexByDates` 유닛이 고정한다. 비모달 편집이나 외부 폼 리셋이 생기면
   *    이 분기가 실제 경로가 되므로 남겨 둔다(조용히 버리는 것보다 고지가 낫다).
   */
  const handleSlotsConfirm = useCallback(
    (target: SlotsTarget, picked: string[], nextSlots: GroupTimeSlots) => {
      const current = form.getValues();
      const index = resolveGroupIndexByDates(current, target.dates, target.fallbackIndex);
      const groups = current.scheduleGroups ?? [];
      // 앵커가 비어 있는 경우(날짜 없는 조건 카드)는 재해석이 불가능하므로 폴백 인덱스를 쓴다.
      const cardIndex =
        target.dates.length === 0
          ? target.fallbackIndex < groups.length
            ? target.fallbackIndex
            : null
          : index;
      const result =
        cardIndex === null ? null : applyConditionToDates(groups, cardIndex, picked, nextSlots);
      if (result === null) {
        addToast({ type: 'info', message: '일정이 바뀌어 반영하지 못했어요' });
        return null;
      }
      if (picked.length > 0) {
        logger.observability('order_sheet.exception_extract', undefined, {
          component: 'OrderSheetScreen',
          dateCount: picked.length,
          totalDates: (groups[cardIndex as number]?.dates ?? []).length,
        });
      }
      notifyScheduleChange(groups, commitGroups(result.groups), {
        removedCards: result.removedCards,
      });
      return cardIndex;
    },
    [form, addToast, commitGroups, notifyScheduleChange]
  );

  /** 묶음지원 토글 — run 만 선분할한 뒤 정규화에 맡긴다(Eng F-6). */
  const handleToggleRun = useCallback(
    (cardIndex: number, run: string[], on: boolean) => {
      clearPendingSwap();
      const groups = form.getValues().scheduleGroups ?? [];
      const committed = commitGroups(setRunGrouped(groups, cardIndex, run, on));
      logger.observability('order_sheet.bundle_toggle', undefined, {
        component: 'OrderSheetScreen',
        on,
        runLength: run.length,
      });
      // 사용자가 스위치를 직접 내린 것은 고지 대상이 아니다 — 자기가 한 일을 되읽어주지 않는다.
      notifyScheduleChange(groups, committed, { bundleToggledByUser: true });
    },
    [form, clearPendingSwap, commitGroups, notifyScheduleChange]
  );

  // 🔑 `commitGroups`·`notifyScheduleChange` 는 **반환하지 않는다.** 이 훅 밖에서 부를 일이
  //    생기면 그 순간 "모든 일정 쓰기는 commitGroups 를 지난다"는 계약이 화면 쪽에서 깨질 수
  //    있는 길이 열린다 — 뮤테이션을 여기로 추가하는 것이 올바른 확장 방향이다.
  return {
    handleDeleteCard,
    handleDatesConfirm,
    handleSlotsConfirm,
    handleToggleRun,
    openExceptionRef,
  };
}
