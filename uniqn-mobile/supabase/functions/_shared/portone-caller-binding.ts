/**
 * PortOne caller binding helpers.
 *
 * Apple JWKS sub matching(`apple-identity-helpers.ts`)과 대칭되는 PortOne 경로
 * 보호 layer. 본인인증 시작 시 클라이언트가 생성한 random `bindingToken`을
 * PortOne SDK request의 `customData`에 박고, 서버가 동일 token을 verify API
 * payload(`expectedBindingToken`)에서 받아 PortOne 응답 `customData` 안의 값과
 * 일치하는지 검증한다.
 *
 * 공격자가 verificationId만 들고도 binding token을 모르면 다른 계정으로 결과를
 * 적용할 수 없다(P0 #1 mitigation의 root-cause layer).
 *
 * Deno deploy(Edge Function) + jest(node) 양쪽에서 동작하도록 의존성 없는
 * pure TypeScript로 작성.
 */

/**
 * PortOne `verification.customData`는 SDK에 string으로 보낸 값을 그대로 반사한다.
 * 일관성을 위해 `JSON.stringify({ bindingToken })` 형식만 허용한다.
 */
export function extractBindingToken(customData: unknown): string | undefined {
  if (typeof customData !== 'string' || customData.length === 0) return undefined;
  try {
    const parsed: unknown = JSON.parse(customData);
    if (parsed && typeof parsed === 'object' && 'bindingToken' in parsed) {
      const token = (parsed as { bindingToken: unknown }).bindingToken;
      return typeof token === 'string' && token.length > 0 ? token : undefined;
    }
  } catch {
    // customData가 JSON이 아니면 무시 (legacy 또는 손상)
  }
  return undefined;
}

/**
 * 두 token이 일치하는지 timing-safe 비교. 둘 중 하나라도 비어있으면 false.
 *
 * Edge Function에서 차단 결정 직전 호출. mismatch면 `IV_BINDING_MISMATCH`로 응답.
 */
export function isBindingMatch(expected: string | undefined, actual: string | undefined): boolean {
  if (!expected || !actual) return false;
  if (expected.length !== actual.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  }
  return diff === 0;
}
