/**
 * UNIQN Functions - 서버사이드 보안 유틸리티
 *
 * 클라이언트(uniqn-mobile/src/utils/security.ts)와 동일한 XSS 탐지 로직을
 * 서버사이드에서 재현. 인코딩 우회 공격(호모그래프, HTML entity, URL encoding)을
 * 정규화 후 패턴 매칭.
 *
 * @version 1.0.0
 */

// ============================================================================
// Encoding Attack Defense (인코딩 공격 방어)
// ============================================================================

/**
 * Cyrillic → Latin 호모그래프 매핑
 *
 * 시각적으로 동일한 Cyrillic 문자를 Latin으로 치환하여
 * `jаvаscript:` (Cyrillic а) 같은 호모그래프 공격을 방어
 */
const HOMOGLYPH_MAP: Record<string, string> = {
  // Lowercase Cyrillic → Latin
  "\u0430": "a",
  "\u0435": "e",
  "\u043E": "o",
  "\u0440": "p",
  "\u0441": "c",
  "\u0443": "y",
  "\u0445": "x",
  "\u0456": "i",
  "\u0458": "j",
  "\u04BB": "h",
  "\u04BD": "c",
  // Uppercase Cyrillic → Latin
  "\u0410": "A",
  "\u0415": "E",
  "\u041E": "O",
  "\u041C": "M",
  "\u0421": "C",
  "\u0422": "T",
  "\u0423": "Y",
  "\u041D": "H",
};

/**
 * HTML 엔티티 디코딩 (보안 검사용)
 *
 * `&#60;` → `<`, `&#x3c;` → `<`, `&lt;` → `<`
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCharCode(parseInt(dec, 10)),
    )
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

/** 호모그래프 문자 치환 */
function replaceHomoglyphs(text: string): string {
  return text.replace(/./g, (ch) => HOMOGLYPH_MAP[ch] ?? ch);
}

/**
 * 입력 문자열 정규화 (인코딩 공격 방어)
 *
 * XSS 패턴 검사 전에 호출하여 다양한 인코딩 우회를 방어:
 * 1. Unicode NFC 정규화
 * 2. HTML 엔티티 디코딩
 * 3. URL 디코딩 최대 2회 (이중 인코딩 방어)
 * 4. Cyrillic → Latin 호모그래프 치환
 */
export function normalizeForSecurity(input: string): string {
  if (!input || typeof input !== "string") return "";

  let normalized = input;

  // 1. Unicode NFC 정규화
  normalized = normalized.normalize("NFC");

  // 2. HTML 엔티티 디코딩
  normalized = decodeHtmlEntities(normalized);

  // 3. URL 디코딩 (최대 2회, double encoding 방어)
  for (let i = 0; i < 2; i++) {
    try {
      const decoded = decodeURIComponent(normalized);
      if (decoded === normalized) break;
      normalized = decoded;
    } catch {
      break;
    }
  }

  // 4. Cyrillic → Latin 호모그래프 치환
  normalized = replaceHomoglyphs(normalized);

  return normalized;
}

// ============================================================================
// XSS Pattern Detection
// ============================================================================

/** 위험한 XSS 패턴 목록 (클라이언트와 동일한 12개 패턴) */
const XSS_PATTERNS: RegExp[] = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /vbscript:/gi,
  /\bon(click|load|error|mouseover|mouseout|mousedown|mouseup|mousemove|focus|blur|submit|change|input|keydown|keyup|keypress|touchstart|touchend|touchmove|dragstart|drag|drop|scroll|resize|unload|beforeunload|abort|contextmenu)\s*=/gi,
  /data:text\/html/gi,
  /data:(?!image\/)[^;,]*;base64/gi,
  /<iframe[^>]*>/gi,
  /<object[^>]*>/gi,
  /<embed[^>]*>/gi,
  /<svg[^>]*>/gi,
  /expression\s*\(/gi,
];

/**
 * XSS 공격 패턴 검사 (정규화 포함)
 *
 * 클라이언트와 동일한 정규화 파이프라인 적용 후 패턴 매칭.
 * 서버에서 호출하므로 클라이언트 검증 우회를 방어.
 *
 * @returns XSS 패턴이 발견되면 true
 */
export function hasXSSPattern(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const normalized = normalizeForSecurity(text);
  return XSS_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(normalized);
  });
}

/** XSS 패턴이 없는지 검증 (validation 용도) */
export function xssValidation(text: string): boolean {
  return !hasXSSPattern(text);
}

/**
 * 이메일 형식 검증 (HTML5 표준 기반)
 *
 * Zod `.email()`과 유사한 수준의 검증.
 * 기존 `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` 대비 엄격.
 */
export const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  return EMAIL_REGEX.test(email) && !hasXSSPattern(email);
}

