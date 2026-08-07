/**
 * 공고 타입 전환(dated ↔ fixed) — 반대 축 입력을 파기하지 않고 스태시했다가 복귀 시 되살린다.
 *
 * `OrderSheetScreen.tsx` 에서 그대로 옮겼다(기능 보존 추출, 800줄 상한 복귀).
 * 스태시(ref)·고지·되돌리기가 서로를 부르는 삼각형이라 한 파일에 있어야 읽힌다 —
 * 특히 되돌리기는 `handleTypeChange` **자신**을 다시 부르므로 ref 우회가 이 훅 안에서 닫힌다.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { OrderSheetFormValues, OrderSheetValues } from '@/schemas/orderSheet.schema';
import type { PostingType } from '@/types/jobPosting';
import { defaultFixedSchedule, hasUserFixedInput, type ScheduleGroups } from '../orderSheetTypes';

interface ToastInput {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
  action?: { label: string; onPress: () => void };
}

export interface UsePostingTypeSwitchParams {
  form: UseFormReturn<OrderSheetFormValues, unknown, OrderSheetValues>;
  addToast: (toast: ToastInput) => void;
  clearPendingSwap: () => void;
}

export function usePostingTypeSwitch({
  form,
  addToast,
  clearPendingSwap,
}: UsePostingTypeSwitchParams): (t: PostingType, options?: { silent?: boolean }) => void {
  // 타입 전환 축 데이터 보존(M7 승계 — 무경고 소실 금지, 전체리뷰 4관점 수렴) — dated↔fixed 전환은
  // 반대 축 입력을 파기하는 대신 세션 한정 스태시(ref)에 보관하고 복귀 시 복원한다. S1까지 이 보장을
  // 담당하던 create.tsx 레거시 전환 Alert는 S2 내부화로 사문 — 여기가 승계 지점.
  const stashedGroupsRef = useRef<ScheduleGroups | null>(null);
  const stashedFixedRef = useRef<OrderSheetFormValues['fixedSchedule'] | null>(null);
  // Undo 가 handleTypeChange 자신을 부르므로 ref 로 우회한다(선언 순환 회피).
  const handleTypeChangeRef = useRef<
    ((t: PostingType, options?: { silent?: boolean }) => void) | null
  >(null);

  /** 전환으로 사라진 입력을 고지하고 되돌릴 길을 준다 — 스태시가 있어도 알려주지 않으면 없는 것과 같다. */
  const notifyTypeSwitch = useCallback(
    (clearedLabel: string | null, previousType: PostingType) => {
      if (!clearedLabel) return;
      addToast({
        type: 'info',
        message: `${clearedLabel}을 잠시 치워뒀어요`,
        duration: 5000,
        action: {
          label: '되돌리기',
          // 되돌리기는 이전 타입으로 다시 전환하는 것 — 스태시 복원 경로를 그대로 재사용한다.
          // silent — 되돌리기가 반대 축을 다시 치우면서 두 번째 토스트를 띄우면 핑퐁이 된다.
          onPress: () => handleTypeChangeRef.current?.(previousType, { silent: true }),
        },
      });
    },
    [addToast]
  );

  const handleTypeChange = useCallback(
    (t: PostingType, options?: { silent?: boolean }) => {
      // 연쇄 예약 취소 — 대기 창(180ms) 안에서 폼 구조(행 구성)가 바뀌면 예약된 타깃이
      // 새 타입의 폼 위에서 phantom 시트가 된다(fixed→dated 전환 시 '근무조건' 시트 팝업 실측).
      clearPendingSwap();
      const cur = form.getValues();
      if (cur.postingType === t) return; // 동일 타입 재탭 no-op — 오탭이 dirty만 남기는 것 방지
      const previousType = cur.postingType;
      // 전환이 **실제로 데이터를 치웠을 때만** 신호를 낸다. 지금까지는 날짜·시간대가 화면에서
      // 사라지는데 아무 알림이 없어(ORDER-11), 사장은 자기가 지운 줄도 몰랐다.
      // ⚠️ fixed 축은 `!== undefined` 로 보면 안 된다 — dated→fixed 전환이 defaultFixedSchedule()
      //    을 **자동 시드**하므로, 빈 폼에서 '고정' 탭을 눌렀다 되돌리기만 해도 "치워뒀어요" 가
      //    뜬다. dated 축처럼 **사용자가 실제로 넣은 값**이 있는지로 판정한다.
      const clearedLabel =
        t === 'fixed'
          ? (cur.scheduleGroups ?? []).some(
              (g) => g.dates.length > 0 || (g.timeSlots ?? []).length > 0
            )
            ? '일정·모집 입력'
            : null
          : hasUserFixedInput(cur.fixedSchedule)
            ? '근무조건 입력'
            : null;
      if (t === 'fixed') {
        form.setValue('postingType', 'fixed', { shouldDirty: true });
        // 고정은 scheduleGroups가 반드시 비어야 한다(배열 원소 스키마 회피) — 소거 전 의미 있는
        // 입력(날짜·시간대)이 있으면 스태시(M7: dated 복귀 시 복원).
        const groups = cur.scheduleGroups ?? [];
        if (groups.some((g) => g.dates.length > 0 || (g.timeSlots ?? []).length > 0)) {
          stashedGroupsRef.current = groups;
        }
        form.setValue('scheduleGroups', [], { shouldDirty: true, shouldValidate: true });
        if (cur.fixedSchedule === undefined) {
          // 직전 fixed 입력이 스태시에 있으면 복원, 없으면 제품 기본값 시드(주 5일).
          // ⚠️ fixedSchedule을 undefined로 두면 근무조건 행·시트가 죽는다 — UI는 항상 시드
          //    (#194 mixed-draft 방어 자체는 mappers.valuesToDraft fixed 분기가 이중 담당).
          form.setValue('fixedSchedule', stashedFixedRef.current ?? defaultFixedSchedule(), {
            shouldDirty: true,
            shouldValidate: true,
          });
        }
        if (!options?.silent) notifyTypeSwitch(clearedLabel, previousType);
        return;
      }
      // dated(regular|urgent|tournament) — fixed에서 오면 근무조건 스태시 후 정리(M7), 그룹 복원/시드
      form.setValue('postingType', t, { shouldDirty: true });
      if (cur.fixedSchedule !== undefined) {
        stashedFixedRef.current = cur.fixedSchedule;
        form.setValue('fixedSchedule', undefined, { shouldDirty: true, shouldValidate: true });
      }
      if ((form.getValues().scheduleGroups ?? []).length === 0) {
        const restored = stashedGroupsRef.current;
        form.setValue(
          'scheduleGroups',
          restored && restored.length > 0
            ? restored
            : [{ dates: [], timeSlots: [], grouped: false }],
          { shouldDirty: true, shouldValidate: true }
        );
      }
      if (!options?.silent) notifyTypeSwitch(clearedLabel, previousType);
    },
    [form, clearPendingSwap, notifyTypeSwitch]
  );
  // 렌더 중 ref 쓰기는 React 규칙 위반(동시 렌더에서 폐기된 렌더의 쓰기가 남는다).
  // 토스트 탭은 커밋 이후에만 가능하므로 effect 타이밍으로 충분하다.
  useEffect(() => {
    handleTypeChangeRef.current = handleTypeChange;
  }, [handleTypeChange]);

  return handleTypeChange;
}
