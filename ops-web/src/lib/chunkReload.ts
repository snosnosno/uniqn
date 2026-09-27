/**
 * 배포 후 옛 청크 로딩 실패 복구 — W0 코드 리뷰 M5.
 *
 * 배포되면 해시가 바뀐다. 열려 있던 탭(특히 하루 종일 켜 두는 TV 전광판)이 lazy 라우트로
 * 이동하면 사라진 옛 청크를 요청하고, SPA fallback 이 그 자리에 index.html 을 200 으로 준다
 * → 모듈 로딩 실패. 이때 한 번 새로고침하면 새 index.html 이 새 청크를 가리킨다.
 * 같은 오류가 곧바로 반복되면(진짜 장애) 새로고침을 멈춰 무한 루프를 막는다.
 */
export const CHUNK_RELOAD_STORAGE_KEY = 'ops-web:chunk-reload-at';
const RELOAD_COOLDOWN_MS = 30_000;

const CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
  /Expected a JavaScript module script/i,
];

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(error.message));
}

export function shouldReloadForChunkError(lastReloadAt: string | null, now: number): boolean {
  const last = Number(lastReloadAt);
  if (!lastReloadAt || !Number.isFinite(last)) return true;
  return now - last > RELOAD_COOLDOWN_MS;
}

/**
 * 판정(읽기 전용) — 렌더 중에 호출해도 된다.
 * 브라우저 저장소 접근은 사생활 보호 모드 등에서 throw 할 수 있다 — 그러면 새로고침하지 않는다.
 */
export function canReloadForChunkError(error: unknown): boolean {
  if (!isChunkLoadError(error)) return false;
  try {
    return shouldReloadForChunkError(sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY), Date.now());
  } catch {
    return false;
  }
}

/** 실행(부수효과) — effect 안에서만 호출한다. 기록에 실패해도 새로고침은 한 번 한다. */
export function reloadForChunkError(): void {
  try {
    sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(Date.now()));
  } catch {
    // 기록 실패 시 다음 오류에서 쿨다운이 안 걸릴 수 있지만, 판정 단계가 이미 저장소 불가를 걸렀다.
  }
  window.location.reload();
}
