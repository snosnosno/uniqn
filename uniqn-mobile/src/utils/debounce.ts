/**
 * realtime 재조회 병합용 트리거 (감사 realtime-02).
 *
 * ## 왜
 * Supabase realtime 구독 콜백은 **행 변경 하나당 한 번** 온다. 지금까지 그 콜백들은
 * 예외 없이 "전체 목록 재조회"를 했기 때문에, 한 번의 사용자 행동이 만드는 다중 행 변경
 * (예: 근무표 슬롯 일괄 수정, 정산 일괄 처리)이 그대로 N 회의 전체 재조회로 증폭됐다.
 *
 * ## 의미론 — 리딩 + 트레일링
 * - 고립된 변경 1건: **즉시** 실행한다(지연 0). 실시간성을 깎지 않는 게 핵심이다.
 * - 창(delayMs) 안에 몰린 변경 N건: 리딩 1회 + 창 끝에 트레일링 1회 = **최대 2회**로 접힌다.
 * - 끊이지 않는 스트림: delayMs 당 최대 1회로 상한이 걸린다.
 *
 * 순수 트레일링 디바운스를 쓰지 않은 이유는 그러면 **모든** 변경이 delayMs 만큼 늦어져서,
 * 단발 변경이 대부분인 실사용에서 체감 지연만 생기고 얻는 게 없기 때문이다.
 *
 * ## 주의
 * 구독 해제 시 `cancel()` 을 반드시 호출하라 — 안 그러면 이미 정리된 구독의 콜백이
 * 창 끝에 한 번 더 튀어 죽은 구독자에게 갱신을 밀어넣는다.
 */
export interface DebouncedTrigger {
  /** 실행 요청. 창 안이면 트레일링 1회로 접힌다. */
  trigger: () => void;
  /** 대기 중인 트레일링 실행을 취소하고 창을 닫는다(구독 해제 시 필수). */
  cancel: () => void;
}

export function createDebouncedTrigger(fn: () => void, delayMs: number): DebouncedTrigger {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let hasPending = false;

  const openWindow = (): void => {
    timer = setTimeout(() => {
      timer = null;
      if (hasPending) {
        hasPending = false;
        fn();
        // 트레일링 실행 직후에도 새 창을 연다 — 끊이지 않는 스트림에서
        // 창이 닫히자마자 리딩으로 또 터지는 폭주를 막는다.
        openWindow();
      }
    }, delayMs);
  };

  return {
    trigger: () => {
      if (timer) {
        hasPending = true;
        return;
      }

      fn();
      openWindow();
    },
    cancel: () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      hasPending = false;
    },
  };
}

/**
 * realtime 재조회 병합 창 기본값.
 * 사람이 "즉시"로 느끼는 상한(약 100ms)보다는 크되, 한 번의 일괄 작업이 만드는
 * 행 변경 버스트를 덮을 만큼은 되는 값이다.
 */
export const REALTIME_RELOAD_DEBOUNCE_MS = 300;
