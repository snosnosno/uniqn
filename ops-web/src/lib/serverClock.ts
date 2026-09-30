/**
 * 서버시각 오프셋 추정 — 설계 §5(운영자 클럭 서버시각 보정, 새 RPC 0).
 *
 * 재료: 모든 PostgREST 응답의 `Date` 헤더(초 단위, CORS 로 노출됨 — 로컬 실측 2026-09-28) +
 * 요청 직전(tSend)·응답 직후(tRecv) 로컬 시각.
 *
 * 한 샘플이 말해 주는 것: 응답을 만든 어느 순간 t∈[tSend,tRecv] 에 서버 시각은 [D, D+1000) 이었다.
 * 오프셋 o = 서버 − 로컬 이므로 o ∈ [D − tRecv, D + 1000 − tSend]. 샘플마다 구간이 초 경계의 다른 위치에
 * 떨어지므로 **교집합**을 쌓으면 1초 해상도보다 훨씬 좁아진다(NTP 를 거친 시계로 흉내 낸 것).
 * 교집합이 비면(기기 시계를 사람이 바꿈 등) 최신 샘플 하나로 다시 시작한다.
 */
export interface ClockSample {
  /** 요청 직전 로컬 ms */
  sentAt: number;
  /** 응답 직후 로컬 ms */
  receivedAt: number;
  /** 서버 Date 헤더(초 해상도) ms */
  serverDate: number;
}

export interface OffsetInterval {
  lo: number;
  hi: number;
}

/** 이보다 오래 걸린 요청은 구간이 넓어 쓸모가 없다(추정을 흐리지 않게 버린다). */
const MAX_RTT_MS = 5_000;

export function sampleInterval(s: ClockSample): OffsetInterval | null {
  if (s.receivedAt < s.sentAt || s.receivedAt - s.sentAt > MAX_RTT_MS) return null;
  return { lo: s.serverDate - s.receivedAt, hi: s.serverDate + 1000 - s.sentAt };
}

export function mergeInterval(prev: OffsetInterval | null, next: OffsetInterval): OffsetInterval {
  if (!prev) return next;
  const lo = Math.max(prev.lo, next.lo);
  const hi = Math.min(prev.hi, next.hi);
  return lo <= hi ? { lo, hi } : next; // 모순 = 시계가 바뀌었다 → 새 샘플부터
}

/** 구간 중앙값(ms). 추정 전이면 0(보정 없음 = 기기 시계를 믿는다, 모바일과 같음). */
export function offsetOf(interval: OffsetInterval | null): number {
  return interval ? Math.round((interval.lo + interval.hi) / 2) : 0;
}

// ─── 브라우저 전역 저장소 ────────────────────────────────────────────────────────

let current: OffsetInterval | null = null;
/** 기존 추정과 모순된 샘플 — 다음 샘플도 같은 쪽이면 그때 갈아탄다(이상치 1건에 무너지지 않게). */
let contradicting: OffsetInterval | null = null;
let currentOffset = 0;
const listeners = new Set<() => void>();

export function recordClockSample(sample: ClockSample): void {
  const next = sampleInterval(sample);
  if (!next) return;
  current = mergeRobust(next);
  const offset = offsetOf(current);
  // 50ms 미만 변화는 알리지 않는다 — 초 단위 클럭에 의미가 없고 재렌더만 늘린다.
  if (Math.abs(offset - currentOffset) >= 50) {
    currentOffset = offset;
    listeners.forEach((l) => l());
  }
}

export function getServerOffsetMs(): number {
  return currentOffset;
}

export function subscribeServerOffset(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * 교집합이 비면 곧바로 갈아타지 않는다 — 직전 모순 샘플과 이번 샘플이 서로 맞을 때만(2연속) 교체.
 * 캐시·프록시가 준 낡은 Date 한 건이 수렴된 추정을 날리지 않게(리뷰 W4).
 */
export function mergeRobust(next: OffsetInterval): OffsetInterval {
  if (!current) return next;
  const lo = Math.max(current.lo, next.lo);
  const hi = Math.min(current.hi, next.hi);
  if (lo <= hi) {
    contradicting = null;
    return { lo, hi };
  }
  if (contradicting) {
    const clo = Math.max(contradicting.lo, next.lo);
    const chi = Math.min(contradicting.hi, next.hi);
    if (clo <= chi) {
      contradicting = null;
      return { lo: clo, hi: chi };
    }
  }
  contradicting = next;
  return current;
}

/** 테스트 전용 — 모듈 상태 초기화. */
export function resetServerClockForTest(): void {
  current = null;
  contradicting = null;
  currentOffset = 0;
}

/** fetch 래퍼 — 응답의 Date 헤더로 샘플을 남긴다(본문은 건드리지 않는다). */
export function createTimedFetch(base: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const sentAt = Date.now();
    const response = await base(input, init);
    const receivedAt = Date.now();
    // Age 가 붙은 응답은 캐시에서 온 것이라 Date 가 과거다 — 샘플로 쓰지 않는다.
    if (response.headers.get('age')) return response;
    const header = response.headers.get('date');
    const serverDate = header ? Date.parse(header) : NaN;
    if (Number.isFinite(serverDate)) recordClockSample({ sentAt, receivedAt, serverDate });
    return response;
  };
}
