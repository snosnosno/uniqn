/**
 * 주문서 프리셋 — 최근 입력 후보 도출 + 프리셋 1탭 적용/저장.
 *
 * `OrderSheetScreen.tsx` 에서 그대로 옮겼다(기능 보존 추출, 800줄 상한 복귀).
 * 프리셋 적용은 **폼 전체를 갈아치우는** 유일한 경로라 되돌리기가 필수고, 그 되돌리기가
 * `salaryConfirmed` 같은 화면 파생 상태까지 함께 되감아야 해서 한 덩어리로 묶인다.
 */
import { useCallback, useMemo } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { syncRoleSalaries, syncRoleSalariesForRoles } from '@/utils/order-sheet/roleSalaries';
import type { OrderSheetFormValues, OrderSheetValues } from '@/schemas/orderSheet.schema';
import type { OrderSheetPreset } from '../PresetCarousel';
import type { OrderSheetLocation } from '../sheets/PlaceSheet';

interface ToastInput {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
  action?: { label: string; onPress: () => void };
}

export interface UseOrderSheetPresetsParams {
  form: UseFormReturn<OrderSheetFormValues, unknown, OrderSheetValues>;
  presets: OrderSheetPreset[] | undefined;
  addToast: (toast: ToastInput) => void;
  clearPendingSwap: () => void;
  onSaveTemplate?: (values: OrderSheetFormValues) => void;
  /** 프리셋이 폼을 갈아치우면 '기본값' 배지 판정도 처음 상태로 되돌린다. */
  setSalaryConfirmed: (confirmed: boolean) => void;
}

export interface UseOrderSheetPresetsResult {
  recentTitles: string[];
  recentLocations: OrderSheetLocation[];
  handleApplyPreset: (preset: OrderSheetPreset) => void;
  handleSavePreset: () => void;
}

export function useOrderSheetPresets({
  form,
  presets,
  addToast,
  clearPendingSwap,
  onSaveTemplate,
  setSalaryConfirmed,
}: UseOrderSheetPresetsParams): UseOrderSheetPresetsResult {
  // 최근 제목/장소 — 프리셋(마지막 공고 + 템플릿)의 title/location 으로 채운다.
  // ⚠️ useMemo 참조 안정화 필수: 매 렌더 새 배열이면 시트 effect 의존이 흔들려 편집 상태가 리셋된다(Task 6 리뷰 승계).
  const recentTitles = useMemo<string[]>(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of presets ?? []) {
      const t = p.values.title?.trim();
      if (t && !seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
    return out;
  }, [presets]);

  const recentLocations = useMemo<OrderSheetLocation[]>(() => {
    const seen = new Set<string>();
    const out: OrderSheetLocation[] = [];
    for (const p of presets ?? []) {
      const loc = p.values.location;
      if (!loc?.name) continue;
      const key = `${loc.name}:${loc.address ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(loc);
    }
    return out;
  }, [presets]);

  // 프리셋 카드 탭 → 주문서 전체를 그 구성으로 교체(RHF reset). 저장 카드 탭 → 현재 값 상위로 전달.
  // by_role 프리셋은 reset 직전 sync(Eng-H3) — 부분 커버 템플릿의 미커버 역할을 기본값으로 채운다.
  // fixed 프리셋은 역할 소스가 fixedSchedule.roles(전체리뷰 P3·P6 — dated 소스만 쓰면 갭필 무동작).
  const handleApplyPreset = useCallback(
    (preset: OrderSheetPreset) => {
      // 연쇄 예약 취소 — 대기 창(180ms) 안에서 폼 전체가 교체되면 예약된 타깃이 새 프리셋 값 위에
      // phantom 시트로 재등장한다(리뷰 실측: 프리셋 적용 직후 '연락처' 시트 팝업).
      clearPendingSwap();
      // 카드 1탭이 폼 **전체**를 갈아치운다 — 되돌릴 자산이 같은 파일(handleDeleteGroup)에
      // 이미 있는데 안 쓰고 있었다. 지금까지 쓴 입력이 있을 때만 스냅샷+Undo 를 얹는다
      // (impeccable §12 Undo > Confirm — 확인 다이얼로그는 1탭 적용의 속도를 죽인다).
      const hadInput = form.formState.isDirty;
      const snapshot = hadInput ? structuredClone(form.getValues()) : null;
      const v = preset.values;
      // ⚠️ keepDefaultValues — 기본 reset 은 defaultValues 까지 프리셋으로 바꿔 isDirty 를
      //    false 로 떨어뜨린다. 그러면 프리셋을 얹은 채 화면을 나가도 이탈 경고가 안 뜬다.
      const resetOptions = { keepDefaultValues: true } as const;
      if (v.useSameSalary ?? false) {
        form.reset(v, resetOptions);
      } else {
        form.reset(
          {
            ...v,
            roleSalaries:
              v.postingType === 'fixed'
                ? syncRoleSalariesForRoles(
                    v.fixedSchedule?.roles ?? [],
                    v.roleSalaries ?? [],
                    v.salary.type
                  )
                : syncRoleSalaries(
                    (v.scheduleGroups ?? []).flatMap((g) => g.timeSlots ?? []),
                    v.roleSalaries ?? [],
                    v.salary.type
                  ),
          },
          resetOptions
        );
      }
      setSalaryConfirmed(false);
      if (snapshot) {
        addToast({
          type: 'success',
          message: `'${preset.title}' 구성으로 바꿨어요`,
          duration: 5000,
          action: {
            label: '되돌리기',
            onPress: () => {
              clearPendingSwap();
              form.reset(snapshot, resetOptions);
              setSalaryConfirmed(false);
            },
          },
        });
      }
    },
    [form, clearPendingSwap, addToast, setSalaryConfirmed]
  );

  const handleSavePreset = useCallback(() => {
    // 상위(create/edit)가 TemplateModal 을 연다 — 그 모달은 "주문서 시트가 닫힌 상태에서만 열린다"는
    // 전제(#244 중첩 RN Modal 회피)로 설계됐다. 연쇄 예약이 살아 있으면 그 위로 시트가 겹쳐 뜬다.
    clearPendingSwap();
    onSaveTemplate?.(form.getValues());
  }, [onSaveTemplate, form, clearPendingSwap]);

  return { recentTitles, recentLocations, handleApplyPreset, handleSavePreset };
}
