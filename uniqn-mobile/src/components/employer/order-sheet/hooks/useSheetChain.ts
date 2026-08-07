/**
 * 주문서 시트 연쇄 — 어떤 시트를 열고, 확인 뒤 어디로 이어가고, 그동안 화면을 어떻게 덮는가.
 *
 * `OrderSheetScreen.tsx` 에서 그대로 옮겼다(기능 보존 추출, 800줄 상한 복귀).
 * 이 훅이 소유하는 것은 **연쇄의 타이밍 계약** 세 가지다:
 *   ① 무장(chainArmedRef) — "미설정 행으로 열었는가". 이미 채워진 행 수정은 이어가지 않는다.
 *   ② 지연 스왑(pendingSwapRef) — 두 네이티브 Modal 겹침 회피 대기(#244 패턴 승계).
 *   ③ 딤(chainSwapping) — 시트 사이 빈 프레임에 밝은 목록이 번쩍이지 않게 덮는다.
 * 셋은 서로를 취소·해제하는 관계라 한 파일에 있어야 읽힌다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import type { UseFormReturn } from 'react-hook-form';
import { triggerHaptic } from '@/utils/haptics';
import type { SheetChainValue } from '@/components/ui/SheetChainContext';
import { SHEET_CHAIN_DATES_SCRIM_HOLD_MS, SHEET_CHAIN_SWAP_MS } from '@/constants/animation';
import type { OrderSheetFormValues, OrderSheetValues } from '@/schemas/orderSheet.schema';
import {
  getRowState,
  nextUnsetRowAfter,
  resolveGroupIndexByDates,
  type OrderRowKey,
  type OrderRowTarget,
} from '../orderRowMeta';
import { defaultFixedSchedule, type ActiveSheet } from '../orderSheetTypes';

export interface UseSheetChainParams {
  form: UseFormReturn<OrderSheetFormValues, unknown, OrderSheetValues>;
  /** 연쇄 전환 딤을 호스트로 위임(B1) — 화면 밖 형제까지 덮으려면 호스트가 통지를 받아야 한다. */
  onChainSwappingChange?: (swapping: boolean) => void;
}

export interface UseSheetChainResult {
  activeSheet: ActiveSheet;
  setActiveSheet: (sheet: ActiveSheet) => void;
  /** SheetChainContext 에 그대로 넣는 값 — 시트가 올라오면 딤을 걷는다. */
  chainValue: SheetChainValue;
  /** 내부 딤을 그릴지 — 호스트 위임(B1)이 없을 때만 화면이 직접 한 장 깐다. */
  chainSwapping: boolean;
  /** 연쇄 예약 취소 — 폼 구조를 바꾸는 모든 경로가 쓰기 전에 거둔다. */
  clearPendingSwap: () => void;
  /** 사용자가 직접 행을 탭한 경로(예약 취소 후 오픈). */
  handleRowPress: (key: OrderRowKey, groupIndex?: number) => void;
  /** 시트 확인 후 다음 미설정 항목으로 이어간다. */
  confirmRow: (target: OrderRowTarget, coveredKeys?: readonly OrderRowKey[]) => void;
  /** 시트 닫기 — X·백드롭으로 나가면 연쇄를 끊는다. */
  closeSheet: () => void;
  /** 카드 조건 행 탭 — 미설정 카드면 연쇄를 무장한다. */
  handlePressCondition: (cardIndex: number) => void;
  /** 승계 고지 "다른 조건으로" 진입 — 그 카드의 조건 시트를 연다. */
  openException: (cardIndex: number) => void;
}

export function useSheetChain({
  form,
  onChainSwappingChange,
}: UseSheetChainParams): UseSheetChainResult {
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);

  // 연쇄 입력(미설정 항목 이어가기) 상태.
  // chainArmedRef: 이 시트를 "미설정 행"으로 열었는가 — 이미 채워진 행 수정은 연쇄하지 않는다.
  // pendingSwapRef: 지연 스왑 예약. 두 네이티브 Modal 겹침 회피용 대기(#244 패턴 승계).
  const chainArmedRef = useRef(false);
  const pendingSwapRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // datesScrimHoldRef: 날짜 시트 진입 후 백드롭이 다 올라올 때까지 딤을 잡아 두는 예약.
  const datesScrimHoldRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 전환 창 동안 화면을 어둡게 유지 — 시트가 사라진 순간 밝은 목록이 번쩍이는 것을 막는다.
  // 다음 시트의 백드롭과 같은 농도(black/50)라 인수인계에 이음매가 없다.
  const [chainSwapping, setChainSwapping] = useState(false);

  // 딤 토글 단일 경로 — 호스트 위임(B1) 통지를 겸한다. setChainSwapping 직접 호출 금지:
  // 통지가 빠지면 호스트 딤이 고착되거나(꺼짐 누락) 아예 안 뜬다(켜짐 누락).
  const updateChainSwapping = useCallback(
    (swapping: boolean) => {
      setChainSwapping(swapping);
      onChainSwappingChange?.(swapping);
    },
    [onChainSwappingChange]
  );

  const clearPendingSwap = useCallback(() => {
    if (pendingSwapRef.current !== null) {
      clearTimeout(pendingSwapRef.current);
      pendingSwapRef.current = null;
    }
    if (datesScrimHoldRef.current !== null) {
      clearTimeout(datesScrimHoldRef.current);
      datesScrimHoldRef.current = null;
    }
    updateChainSwapping(false);
  }, [updateChainSwapping]);
  useEffect(() => clearPendingSwap, [clearPendingSwap]);

  /** 방어 시드(H5) — fixed 전용 시트 진입 시 fixedSchedule 부재면 기본값으로 채워 렌더 게이트를 통과시킨다. */
  const seedFixedScheduleIfMissing = useCallback(() => {
    if (form.getValues().fixedSchedule === undefined) {
      form.setValue('fixedSchedule', defaultFixedSchedule(), {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [form]);

  /**
   * 행 → 시트 라우팅 + 연쇄 무장 판정. 사용자 탭과 연쇄 예약이 공유하는 단일 진입점.
   * 무장 = 지금 여는 행이 "필수인데 비어 있음" — 이미 채워진 행 수정은 확인 시 목록으로 복귀한다.
   *
   * 행 탭 라우팅(그룹 스코프) — dates는 단일 그룹=whole(세그먼트)·다그룹=edit(헤더 재편집),
   * 시간·역할은 통합 시트 하나로 진입(설계 §6).
   */
  const openRow = useCallback(
    (key: OrderRowKey, groupIndex = 0) => {
      const current = form.getValues();
      const state = getRowState(current, key, groupIndex);
      chainArmedRef.current = !state.optional && state.unset;
      const groups = current.scheduleGroups ?? [];
      // 조건은 있는데 날짜가 없는 카드(템플릿 프리셋)의 '날짜' 행 — **전 일정 스코프 날짜
      // 시트로 보내면 안 된다.** 그 시트가 무엇을 고르든 새 날짜는 인접·첫 카드가 가져가고
      // 이 카드는 영영 비어 있어, 제출 유도가 같은 자리를 무한히 가리키는 루프가 된다.
      // 조건 시트로 보낸다 — 거기 "이 조건을 쓸 날짜"가 이 카드에 직접 날짜를 배정한다.
      //
      // ⚠️ **공고에 날짜가 하나라도 있을 때만** 우회한다. 아직 아무 날짜도 없는 초기 상태
      //    (조건만 시드된 카드 1개)에서 우회하면 조건 시트에 고를 후보가 0개라 확인이
      //    영영 잠기는 반대 방향의 막다른 길이 된다 — 그때는 날짜 시트가 정답이다.
      const otherDates = groups.some((g, i) => i !== groupIndex && (g.dates ?? []).length > 0);
      const emptyConditionCard =
        key === 'dates' &&
        current.postingType !== 'fixed' &&
        (groups[groupIndex]?.dates ?? []).length === 0 &&
        (groups[groupIndex]?.timeSlots ?? []).length > 0 &&
        otherDates;
      if (emptyConditionCard) {
        setActiveSheet({ key: 'slots', dates: [], fallbackIndex: groupIndex });
        return;
      }
      if (key === 'dates') {
        // 딤 해제 책임이 여기로 넘어온다: 날짜 시트만 SheetModal 이 아니라 DatePickerModal(ui/Modal)
        // 래핑이라 SheetChainContext 를 소비하지 않는다 → 시트가 떠도 onEntered() 통지가 없어
        // handleChainEntered 가 영영 안 불린다. 걷지 않으면 딤이 화면 전체에 영구 잔존한다.
        //
        // 단 즉시 걷으면 안 된다 — ui/Modal 백드롭은 0→1 페이드인이라(200ms) 그 사이 밝은
        // 주문서 목록이 드러난다. 백드롭이 다 올라온 뒤에 걷어야 이음매가 없다.
        // 취소·재탭 등으로 먼저 빠져나가는 경로는 clearPendingSwap 이 이 예약도 함께 정리한다.
        if (datesScrimHoldRef.current !== null) clearTimeout(datesScrimHoldRef.current);
        datesScrimHoldRef.current = setTimeout(() => {
          datesScrimHoldRef.current = null;
          updateChainSwapping(false);
        }, SHEET_CHAIN_DATES_SCRIM_HOLD_MS);
        setActiveSheet({ key: 'dates' });
        return;
      }
      // 시간·역할은 통합 시트 하나로 진입한다(설계 §6). 고정(fixed)은 단일 fixedSchedule.roles
      // 편집이라 전용 시트로 분기하는 기존 동작을 유지한다(S2).
      if (key === 'time' || key === 'roles') {
        if (current.postingType === 'fixed') {
          seedFixedScheduleIfMissing();
          setActiveSheet('fixedRoles');
          return;
        }
        setActiveSheet({
          key: 'slots',
          dates: [...(groups[groupIndex]?.dates ?? [])],
          fallbackIndex: groupIndex,
        });
        return;
      }
      if (key === 'workConditions') {
        // 방어(H5·전체리뷰 P4): fixedSchedule 부재 상태로 진입해도 시트가 열리도록 시드 —
        // 렌더 게이트(activeSheet==='workConditions' && values.fixedSchedule)와 정합.
        seedFixedScheduleIfMissing();
        setActiveSheet('workConditions');
        return;
      }
      // 나머지는 행 키 그대로 시트 오픈.
      setActiveSheet(key);
    },
    [form, seedFixedScheduleIfMissing, updateChainSwapping]
  );

  /**
   * 사용자가 직접 행을 탭한 경로. 연쇄 예약이 대기 중이면 취소한다 —
   * 사용자의 명시적 선택이 자동 예약을 이긴다(#244 의 "무시" 가드와 반대 방향:
   * 그쪽은 시트가 떠 있는 상태의 오탭 방지였고, 여기는 시트가 없는 대기 창이라
   * 탭을 막으면 사용자가 180ms 동안 아무것도 못 누르는 죽은 구간이 된다).
   */
  const handleRowPress = useCallback(
    (key: OrderRowKey, groupIndex = 0) => {
      clearPendingSwap();
      openRow(key, groupIndex);
    },
    [clearPendingSwap, openRow]
  );

  /**
   * 시트 확인 후 다음 미설정 항목으로 이어간다.
   * 무장되지 않았으면(이미 채워진 행 수정) 아무것도 하지 않고 목록으로 돌아간다.
   *
   * 시트가 onConfirm 직후 onClose 로 activeSheet 를 null 로 내리므로 여기서 닫지 않는다.
   * ⚠️ 호출 순서: onConfirm(폼 반영 → confirmRow) → onClose(무장 해제). confirmRow 를
   *    onClose 뒤로 옮기면 무장이 이미 꺼져 연쇄가 침묵으로 죽는다.
   */
  const confirmRow = useCallback(
    (target: OrderRowTarget, coveredKeys?: readonly OrderRowKey[]) => {
      if (!chainArmedRef.current) return;
      chainArmedRef.current = false;
      // setValue 직후라 watch 값은 아직 옛것 — getValues 로 최신 폼을 읽는다.
      const next = nextUnsetRowAfter(form.getValues(), target, coveredKeys);
      if (next === null) {
        // 연쇄 완료(연출 B3) — 무장된 연쇄에서 마지막 미설정 항목을 채웠다. 결정적 순간이라
        // 성공 햅틱 1회로 완료를 알린다(룰 17). 웹은 no-op이지만 CTA가 '이대로 등록'으로
        // 바뀌는 시각 신호가 별도로 있다. 토스트는 절제를 위해 생략(룰 12).
        void triggerHaptic('success');
        return;
      }
      // 전환 안내(a11y C1) — 딤 스왑 대기(180ms) 동안 스크린리더가 침묵하지 않도록,
      // 다음 시트가 실제로 뜨기 전 예약 시점에 다음 항목 라벨을 읽어 준다.
      const nextLabel = getRowState(form.getValues(), next.key, next.groupIndex).label;
      AccessibilityInfo.announceForAccessibility(`다음 항목: ${nextLabel}`);
      updateChainSwapping(true);
      pendingSwapRef.current = setTimeout(() => {
        pendingSwapRef.current = null;
        // F9 — 180ms 대기 동안 정규화가 카드 순서를 바꿨을 수 있다(같은 조건으로 수렴하면
        // 카드가 병합되고, 예외를 뽑으면 갈라진다). 예약 시점 인덱스가 아니라 **날짜집합**으로
        // 현재 카드를 다시 구한다. 카드가 통째로 사라졌으면 연쇄를 조용히 끝낸다 —
        // 엉뚱한 카드의 시트를 열어 입력을 잘못 쓰는 것보다 낫다.
        //
        // ⚠️ 앵커가 **없는** 행(비일정 행·날짜 축이 아예 없는 fixed)은 재해석이 "불필요"한
        //    것이지 "실패"가 아니다. 무조건 재해석을 태우면 fixed(scheduleGroups=[] 가 계약)는
        //    폴백 범위검사에서 항상 null 이 되어 연쇄가 통째로 죽는다.
        const resolved =
          next.dates === undefined
            ? next.groupIndex
            : resolveGroupIndexByDates(form.getValues(), next.dates, next.groupIndex);
        if (resolved === null) {
          // 침묵 종료도 딤 해제 책임을 진다 — 안 걷으면 사용자가 다른 행을 탭할 때까지
          // 화면 전체가 어두운 채로 남는다.
          updateChainSwapping(false);
          return;
        }
        openRow(next.key, resolved);
      }, SHEET_CHAIN_SWAP_MS);
    },
    [form, openRow, updateChainSwapping]
  );

  // 시트가 화면에 올라오면 딤을 걷는다 — 백드롭과 딤이 겹쳐 이중으로 어두워지는 프레임을 최소화.
  const handleChainEntered = useCallback(() => updateChainSwapping(false), [updateChainSwapping]);
  const chainValue = useMemo<SheetChainValue>(
    () => ({ entering: chainSwapping, onEntered: handleChainEntered }),
    [chainSwapping, handleChainEntered]
  );

  /** 시트 닫기 — X·백드롭으로 나가면 연쇄를 끊는다(확인 경로는 이미 confirmRow 가 소비 후 해제). */
  const closeSheet = useCallback(() => {
    chainArmedRef.current = false;
    setActiveSheet(null);
    // 딤 안전망 — 예약이 없을 때만 걷는다.
    // ⚠️ 무조건 걷으면 안 된다: 확인 경로의 호출 순서는 onConfirm(→ confirmRow 가 딤을 켬)
    //    직후 onClose(=이 함수)라, 무조건 끄면 방금 켠 딤이 즉시 꺼져 전환 번쩍임이 복귀한다.
    //    예약(pendingSwapRef) 존재 여부가 "연쇄 전환 중"과 "그냥 닫힘"을 가르는 유일한 신호다.
    if (pendingSwapRef.current === null) {
      // 날짜 시트를 취소로 닫는 경로 — 백드롭이 사라지므로 딤 유지 예약도 함께 거둔다.
      if (datesScrimHoldRef.current !== null) {
        clearTimeout(datesScrimHoldRef.current);
        datesScrimHoldRef.current = null;
      }
      updateChainSwapping(false);
    }
  }, [updateChainSwapping]);

  /** 카드 조건 행 탭 — 미설정 카드면 연쇄를 무장한다(기존 openRow 규칙 승계). */
  const handlePressCondition = useCallback(
    (cardIndex: number) => {
      clearPendingSwap();
      handleRowPress('time', cardIndex);
    },
    [clearPendingSwap, handleRowPress]
  );

  /**
   * 승계 고지 "다른 조건으로" 진입 — 그 카드의 조건 시트를 연다.
   * 시트 맨 위 "적용할 날짜"에서 방금 들어온 날짜만 고르면 그게 곧 다른 조건 분리다
   * (구 예외 모드 전용 진입로가 통합되면서 목적지가 하나로 합쳐졌다).
   */
  const openException = useCallback(
    (cardIndex: number) => {
      clearPendingSwap();
      chainArmedRef.current = false; // "채우기"가 아니라 "나누기" — 연쇄 대상이 아니다
      const groups = form.getValues().scheduleGroups ?? [];
      setActiveSheet({
        key: 'slots',
        dates: [...(groups[cardIndex]?.dates ?? [])],
        fallbackIndex: cardIndex,
      });
    },
    [form, clearPendingSwap]
  );

  return {
    activeSheet,
    setActiveSheet,
    chainValue,
    chainSwapping,
    clearPendingSwap,
    handleRowPress,
    confirmRow,
    closeSheet,
    handlePressCondition,
    openException,
  };
}
