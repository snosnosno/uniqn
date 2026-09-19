/**
 * 부팅 시 어떤 화면을 보여줄지 결정하는 순수 함수 (감사 skew-F1).
 *
 * ## 왜 함수로 뽑았나
 * 이 분기는 **네 상태의 우선순위**가 전부다. `app/_layout.tsx` 안에 if 문으로 두면
 * 우선순위가 뒤바뀌어도 아무도 모른다 — 실제로 그 우선순위가 없어서(구조분해 누락)
 * 강제 업데이트가 "알 수 없는 오류 + 무한 재시도"로 보였던 것이 이 결함이다.
 * 순수 함수로 두면 우선순위 자체를 테스트가 고정한다.
 *
 * ## 우선순위와 그 이유
 * 1. `loading`      — 아직 판정할 정보가 없다
 * 2. `maintenance`  — 서버가 "지금은 아무도 못 쓴다"고 말한 상태
 * 3. `forceUpdate`  — 서버가 "이 버전은 못 쓴다"고 말한 상태
 * 4. `error`        — 왜 막혔는지 모르는 일반 실패(여기서만 재시도가 의미 있다)
 * 5. `app`          — 통과. 이때의 requiresUpdate 는 **소프트 업데이트** 의미다
 *
 * 🔑 2·3 을 4보다 먼저 잡아야 한다. 순서를 바꾸면 둘 다 다시 일반 오류로 떨어져
 *    사용자는 눌러도 안 되는 재시도 버튼만 보게 된다 — 결함 재현.
 */

export interface VersionGateInput {
  isInitialized: boolean;
  isLoading: boolean;
  error: Error | null;
  requiresUpdate: boolean;
  isMaintenanceMode: boolean;
  latestVersion?: string;
  maintenanceMessage?: string;
}

export type VersionGate =
  | { kind: 'loading' }
  | { kind: 'maintenance'; message?: string }
  | { kind: 'forceUpdate' }
  | { kind: 'error' }
  | { kind: 'app'; softUpdate: { available: boolean; latestVersion?: string } };

export function resolveVersionGate(input: VersionGateInput): VersionGate {
  const {
    isInitialized,
    isLoading,
    error,
    requiresUpdate,
    isMaintenanceMode,
    latestVersion,
    maintenanceMessage,
  } = input;

  if (isLoading || (!isInitialized && !error)) {
    return { kind: 'loading' };
  }

  if (isMaintenanceMode) {
    return { kind: 'maintenance', message: maintenanceMessage };
  }

  // ⚠️ 성공 경로에서도 requiresUpdate 는 채워진다(그때는 shouldUpdate = 소프트 업데이트).
  //    `error` 동반 여부가 "차단"과 "안내"를 가르는 유일한 축이다.
  if (error && requiresUpdate) {
    return { kind: 'forceUpdate' };
  }

  if (error) {
    return { kind: 'error' };
  }

  return { kind: 'app', softUpdate: { available: requiresUpdate, latestVersion } };
}
