/**
 * UNIQN Mobile - 다음(카카오) 우편번호 검색 결과 경계 처리
 *
 * @description 우편번호 위젯이 돌려주는 페이로드를 검증하고, 거기서 region slug 를 해석한다.
 * 위젯 결과는 웹에서는 iframe, 네이티브에서는 WebView `postMessage` 를 타고 오는 **외부 경계**라
 * 신뢰하지 않고 zod 로 파싱한다(XSS refine 포함 — 주소는 그대로 화면에 그려진다).
 *
 * region 해석은 새 매핑 구현이 아니라 **기존 자산의 조합**이다. 자유텍스트 퍼지 매칭
 * `findRegionByAddress`(constants/regions.ts)는 그대로 쓰고, 위젯이 주는 구조화 필드
 * (`sido`/`sigungu`)로 정확일치를 먼저 시도해 정확도를 올린다.
 */
import { z } from 'zod';
import { xssValidation } from '@/utils/security';
import { findRegionByAddress, isRegionSlug } from '@/constants/regions';

const safeAddressText = (max: number) =>
  z.string().max(max).refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' });

/**
 * 우편번호 위젯 `oncomplete` 페이로드 중 우리가 소비하는 필드만.
 *
 * ⚠️ 위젯은 이보다 많은 필드를 준다 — `.strict()` 를 쓰지 않는 이유다(벤더가 필드를 추가해도
 * 파스가 깨지면 안 된다). 반대로 우리가 쓰는 필드는 전부 **필수**로 둔다: optional 로 두면
 * 벤더 응답 변경이 `undefined` 로 조용히 흘러 주소가 빈 채로 저장된다.
 */
const postcodeResultSchema = z.object({
  /** 도로명주소 — 예: '서울 강남구 테헤란로 152' */
  roadAddress: safeAddressText(200),
  /** 지번주소 — 도로명 미부여 건물의 폴백 */
  jibunAddress: safeAddressText(200),
  /** 우편번호 5자리 */
  zonecode: safeAddressText(10),
  /** 시·도 축약형 — 예: '경기'. 세종은 '세종' */
  sido: safeAddressText(30),
  /** 시·군·구. **2단계가 한 문자열**일 수 있다(예: '성남시 분당구'). 세종은 빈 문자열 */
  sigungu: safeAddressText(60),
});

export type PostcodeResult = z.infer<typeof postcodeResultSchema>;

/**
 * 위젯 페이로드(unknown)를 검증해 반환한다. 실패 시 null — 호출부가 사용자에게 알린다.
 * 네이티브 WebView 브릿지는 문자열로 오므로 JSON 문자열도 받는다.
 */
export function parsePostcodeResult(raw: unknown): PostcodeResult | null {
  let candidate = raw;
  if (typeof raw === 'string') {
    try {
      candidate = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const parsed = postcodeResultSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/**
 * 네이티브 WebView 브릿지 봉투 — 위젯을 감싼 로컬 HTML 이 `postMessage` 로 보내는 형태.
 *
 * ⚠️ 실기기 QA 가 이번 프로젝트에서 제외됐으므로(대체 검증 3종) 이 경계만이라도 유닛 테스트로
 * 고정한다. 브릿지 문자열은 WebView 안 임의 스크립트가 보낼 수 있는 **신뢰 불가 입력**이다.
 */
const bridgeMessageSchema = z.union([
  z.object({ type: z.literal('complete'), data: postcodeResultSchema }),
  z.object({ type: z.literal('error'), message: z.string().max(200) }),
]);

export type PostcodeBridgeMessage =
  | { type: 'complete'; result: PostcodeResult }
  | { type: 'error'; message: string };

/** WebView `onMessage` 의 원문 문자열을 검증한다. 알 수 없는 메시지는 null(무시). */
export function parsePostcodeBridgeMessage(raw: string): PostcodeBridgeMessage | null {
  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = bridgeMessageSchema.safeParse(candidate);
  if (!parsed.success) return null;
  return parsed.data.type === 'complete'
    ? { type: 'complete', result: parsed.data.data }
    : { type: 'error', message: parsed.data.message };
}

/** 위젯이 준 주소 중 저장할 대표 주소 — 도로명 우선, 미부여 건물은 지번으로 폴백 */
export function pickPrimaryAddress(result: PostcodeResult): string {
  return result.roadAddress.trim() || result.jibunAddress.trim();
}

/**
 * 우편번호 결과 → region slug. 실패 시 undefined(**호출부가 수동 선택으로 보내야 한다**).
 *
 * region 은 제출 필수 게이트(orderSheet.schema superRefine)라 자동선택 실패를 조용히
 * 통과시키면 사용자는 확인 버튼이 왜 안 눌리는지 모른 채 막힌다.
 *
 * 폴백 사슬:
 * ① `{sido} {sigungu}` 정확일치 — slug 명명 규칙이 `{시도} {시군} {구}` 라 조합이 곧 slug다
 * ② 마지막 토큰(구) 제거 후 정확일치 — 신설 구(2026 인천 구 개편·화성시 4구)가 택소노미에
 *    아직 없을 때 상위 시 레벨로 낙하시킨다. 상위로만 일반화하므로 다른 지역으로 새지 않는다
 * ③ `findRegionByAddress(도로명주소)` — 위젯이 시도명을 축약하지 않고 주는 경우
 *    ('강원특별자치도' 등 개편 명칭)를 기존 퍼지 매칭이 흡수한다
 * ④ 전부 실패 → undefined
 */
export function resolveRegionSlug(result: PostcodeResult): string | undefined {
  const composed = `${result.sido} ${result.sigungu}`.trim().replace(/\s+/g, ' ');

  // ①
  if (isRegionSlug(composed)) return composed;

  // ② — 토큰이 2개 이상일 때만. 1개면 제거 결과가 빈 문자열이라 의미가 없다
  const tokens = composed.split(' ').filter(Boolean);
  if (tokens.length >= 2) {
    const parentSlug = tokens.slice(0, -1).join(' ');
    if (isRegionSlug(parentSlug)) return parentSlug;
  }

  // ③
  return findRegionByAddress(pickPrimaryAddress(result))?.slug;
}
