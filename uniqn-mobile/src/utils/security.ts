/**
 * 보안 유틸리티
 *
 * XSS, SQL Injection 등 보안 위협 탐지 및 입력 검증
 * 모든 스키마 및 입력 검증에서 공통으로 사용
 *
 * @module utils/security
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
  '\u0430': 'a',
  '\u0435': 'e',
  '\u043E': 'o',
  '\u0440': 'p',
  '\u0441': 'c',
  '\u0443': 'y',
  '\u0445': 'x',
  '\u0456': 'i',
  '\u0458': 'j',
  '\u04BB': 'h',
  '\u04BD': 'c',
  // Uppercase Cyrillic → Latin
  '\u0410': 'A',
  '\u0415': 'E',
  '\u041E': 'O',
  '\u041C': 'M',
  '\u0421': 'C',
  '\u0422': 'T',
  '\u0423': 'Y',
  '\u041D': 'H',
};

/**
 * HTML 엔티티 1회 디코딩 (보안 검사용)
 *
 * `&#60;` → `<`, `&#x3c;` → `<`, `&lt;` → `<`, `&colon;` → `:`
 * XSS 검사 경로에서만 사용 (저장 경로에서는 원본 유지)
 */
function decodeHtmlEntitiesOnce(text: string): string {
  return (
    text
      // 세미콜론 옵셔널: `&#58alert`처럼 종결자 없는 수치 참조도 디코딩(HTML5 파서 동등)
      .replace(/&#(\d+);?/g, (_, dec: string) => String.fromCharCode(parseInt(dec, 10)))
      // 16진은 a-f가 후속 글자와 과매칭될 수 있어 세미콜론 유지
      .replace(/&#x([0-9a-fA-F]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      // 명명 엔티티 난독 우회 방어: `javascript&colon;alert&lpar;1&rpar;`
      .replace(/&colon;/gi, ':')
      .replace(/&lpar;/gi, '(')
      .replace(/&rpar;/gi, ')')
      .replace(/&sol;/gi, '/')
      .replace(/&Tab;/gi, '\t')
      .replace(/&NewLine;/gi, '\n')
  );
}

/**
 * HTML 엔티티를 안정될 때까지 반복 디코딩 (최대 3회)
 *
 * URL 디코딩이 2회 반복하는 것과 대칭 — `&#38;#60;`(= `&` + `#60;` → `<`)처럼
 * 인코딩을 한 단계 덧씌워 `<`를 숨기는 split-entity 우회를 방어. 정상 입력은 1회 만에 안정.
 */
function decodeHtmlEntities(text: string): string {
  let prev = text;
  let decoded = decodeHtmlEntitiesOnce(prev);
  let iterations = 1;
  while (decoded !== prev && iterations < 3) {
    prev = decoded;
    decoded = decodeHtmlEntitiesOnce(prev);
    iterations += 1;
  }
  return decoded;
}

/**
 * 호모그래프 문자 치환
 */
function replaceHomoglyphs(text: string): string {
  return text.replace(/./g, (ch) => HOMOGLYPH_MAP[ch] ?? ch);
}

/**
 * 입력 문자열 정규화 (인코딩 공격 방어)
 *
 * XSS 패턴 검사 전에 호출하여 다양한 인코딩 우회를 방어:
 * 1. Unicode NFC 정규화 (호모그래프 공격)
 * 2. HTML 엔티티 디코딩 (`&#60;` → `<`)
 * 3. URL 디코딩 최대 2회 (이중 인코딩 `%253C` → `%3C` → `<`)
 * 4. Cyrillic → Latin 호모그래프 치환
 *
 * @note XSS 검사 경로에서만 사용. 데이터 저장 시에는 원본 유지.
 */
export function normalizeForSecurity(input: string): string {
  if (!input || typeof input !== 'string') return '';

  let normalized = input;

  // 1. Unicode NFC 정규화
  normalized = normalized.normalize('NFC');

  // 2. HTML 엔티티 디코딩
  normalized = decodeHtmlEntities(normalized);

  // 2.5. 고립 '%'(유효한 %XX 아님)를 %25로 escape → decodeURIComponent throw로
  //      URL 디코딩이 통째로 중단되어 인코딩 페이로드가 살아남는 우회 방지
  normalized = normalized.replace(/%(?![0-9a-fA-F]{2})/g, '%25');

  // 3. URL 디코딩 (최대 2회, double encoding 방어)
  for (let i = 0; i < 2; i++) {
    try {
      const decoded = decodeURIComponent(normalized);
      if (decoded === normalized) break;
      normalized = decoded;
    } catch {
      break; // 잘못된 인코딩은 무시
    }
  }

  // 4. Cyrillic → Latin 호모그래프 치환
  normalized = replaceHomoglyphs(normalized);

  return normalized;
}

// ============================================================================
// XSS Pattern Detection
// ============================================================================

/**
 * javascript: 프로토콜 — 콜론 뒤(공백 허용) 출력 가능 ASCII 문자([!-~]) 요구.
 * 'JavaScript: 중급'처럼 콜론 뒤 공백+비-ASCII(한글) 기술스택 라벨은 통과시키되,
 * `javascript:alert`·`javascript:0||alert`·`javascript:!alert`처럼 콜론 뒤 코드(문자/숫자/연산자)는 차단.
 */
const JS_PROTOCOL_PATTERN = /javascript:\s*[!-~]/gi;
/** vbscript: 프로토콜 — 동일 협소화('VBScript:' 산문은 통과) */
const VB_PROTOCOL_PATTERN = /vbscript:\s*[!-~]/gi;

/**
 * 위험한 XSS 패턴 목록
 *
 * 다음 패턴을 차단:
 * - 여는 태그 단독/절단형: script/iframe/object/embed/svg + style/base/meta/link/form/math/template
 *   (닫는 </tag>·닫는 '>' 불요 — `<script>alert(1)`·`<iframe src=//evil` 같은 절단형 우회 차단)
 * - on* 이벤트 핸들러 전체 (일반형 — allowlist 갭으로 통과하던 ontoggle/onpointerover 등 일소)
 * - javascript:/vbscript: 프로토콜 (콜론 뒤 코드문자 동반 시)
 * - data: 스크립트 스킴(text/javascript 등) + 비-이미지 base64
 * - CSS expression() (콜론 컨텍스트 한정)
 *
 * @note `<` 직후 태그명, on 직후 이벤트명을 강제 → '<3'·'a < b'·단어 'script'·'JavaScript:'
 *       같은 정상 입력은 통과(app-wide 오탐 방지). 스킴 내 제어문자/엔티티 분절 우회는
 *       normalizeForSecurity + hasXSSPattern의 제어문자 제거 사본에서 추가 방어.
 */
export const XSS_PATTERNS: RegExp[] = [
  /<(?:script|iframe|object|embed|svg|style|base|meta|link|form|math|template)\b/gi,
  /\bon[a-z]+\s*=/gi,
  JS_PROTOCOL_PATTERN,
  VB_PROTOCOL_PATTERN,
  /data:text\/(?:html|javascript|xml)|data:application\/(?:javascript|x?html|xml)/gi,
  /data:(?!image\/)[^;,]*;base64/gi,
  /:\s*expression\s*\(/gi,
];

/**
 * 프로토콜 패턴(javascript:/vbscript:) — 스킴 내 제어문자(java<TAB>script:)로 분절하는
 * 우회를 잡기 위해 제어문자 제거 사본에도 추가 검사. 전역 제거는 이벤트 패턴의 개행
 * 속성 구분자를 손상시키므로 프로토콜 패턴에만 한정.
 */
const PROTOCOL_PATTERNS: RegExp[] = [JS_PROTOCOL_PATTERN, VB_PROTOCOL_PATTERN];

// SQL_INJECTION_PATTERNS / hasSQLInjectionPattern 은 제거됐다(2026-07-27).
// 호출처가 0곳이었고, 주석은 아직 Firebase 시절을 가리키고 있었다. 현재 쓰기 경로는 전부
// PostgREST·RPC 파라미터 바인딩이라 클라이언트 문자열 패턴 검사로 막을 대상이 없다.
// 오히려 '주말 select 근무'처럼 정상 한국어 입력을 거절할 여지만 남는다.

/**
 * XSS 공격 패턴 검사
 *
 * @param text - 검사할 텍스트
 * @returns XSS 패턴이 발견되면 true
 *
 * @example
 * ```ts
 * hasXSSPattern('안전한 텍스트');                    // false
 * hasXSSPattern('<script>alert("XSS")</script>');  // true
 * hasXSSPattern('onclick=alert(1)');               // true
 * ```
 */
export function hasXSSPattern(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const normalized = normalizeForSecurity(text);
  const matchesNormalized = XSS_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0; // /g 플래그 regex의 sticky lastIndex 버그 방지
    return pattern.test(normalized);
  });
  if (matchesNormalized) return true;

  // 스킴 내부 제어문자(java<TAB>script:)로 패턴을 분절하는 우회 방어:
  // 제어문자를 제거한 사본에 프로토콜 패턴만 추가 검사
  const controlStripped = normalized.replace(/[\x00-\x1F]/g, '');
  if (controlStripped === normalized) return false;
  return PROTOCOL_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(controlStripped);
  });
}

/**
 * XSS 패턴이 없는지 검증 (Zod refine용)
 *
 * @param text - 검증할 텍스트
 * @returns XSS 패턴이 없으면 true
 *
 * @example
 * ```ts
 * // Zod 스키마에서 사용
 * z.string().refine(xssValidation, {
 *   message: '위험한 문자열이 포함되어 있습니다'
 * })
 * ```
 */
export function xssValidation(text: string): boolean {
  return !hasXSSPattern(text);
}

/**
 * 입력 텍스트에서 위험한 패턴 제거 (간단한 sanitize)
 *
 * @param input - 정제할 텍스트
 * @returns 정제된 텍스트
 *
 * @note React Native에서는 DOMPurify를 직접 사용할 수 없음
 *       브라우저 DOM API에 의존하기 때문
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return '';
  const normalized = normalizeForSecurity(input);
  return (
    normalized
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      // 닫는 '>' 없는 절단형 위험 여는태그도 제거 (<[^>]+>는 '>'를 요구해 절단형이 잔존)
      .replace(
        /<\/?(?:script|iframe|object|embed|svg|style|base|meta|link|form|math|template)\b[^>]*>?/gi,
        ''
      )
      .replace(/<[^>]+>/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim()
  );
}

/**
 * 안전한 URL 검증
 *
 * @param url - 검증할 URL
 * @returns 안전한 URL이면 true
 */
export function isSafeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;

  const normalized = normalizeForSecurity(url.trim());

  // javascript:, vbscript:, data: 프로토콜 차단
  const dangerousProtocols = /^(javascript|vbscript|data):/i;
  if (dangerousProtocols.test(normalized)) return false;

  // 허용된 프로토콜만 허용
  const safeProtocols = /^(https?|mailto|tel):/i;
  const isRelative = /^[./]/.test(normalized) || !normalized.includes(':');

  return safeProtocols.test(normalized) || isRelative;
}

/**
 * 전화번호 형식 검증
 *
 * @param phone - 검증할 전화번호
 * @returns 유효한 전화번호면 true
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  // 한국 휴대폰 번호 형식 (010-XXXX-XXXX 또는 01XXXXXXXXX)
  const phonePattern = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
  return phonePattern.test(phone.replace(/\s/g, ''));
}

/**
 * 이메일 형식 검증
 *
 * @param email - 검증할 이메일
 * @returns 유효한 이메일이면 true
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  // RFC 5322 기반 간소화된 이메일 패턴
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email) && !hasXSSPattern(email);
}

// ============================================================================
// Client-side Rate Limiter
// ============================================================================

interface ClientRateLimiter {
  /** 요청 가능 여부 확인 + 가능하면 기록 */
  tryAcquire: () => boolean;
  /** 남은 대기 시간 (ms). 0이면 즉시 가능 */
  getWaitTime: () => number;
  /** 테스트용 리셋 */
  reset: () => void;
}

/**
 * 클라이언트측 Rate Limiter 팩토리 (슬라이딩 윈도우 기반)
 *
 * 서버측 Rate Limiting 보조용. 자동화 공격의 난이도를 높이는 역할.
 *
 * @param maxRequests - 윈도우 내 최대 요청 수
 * @param windowMs - 슬라이딩 윈도우 크기 (밀리초)
 */
export function createClientRateLimiter(maxRequests: number, windowMs: number): ClientRateLimiter {
  const timestamps: number[] = [];

  function pruneExpired(): void {
    const now = Date.now();
    while (timestamps.length > 0 && timestamps[0]! < now - windowMs) {
      timestamps.shift();
    }
  }

  return {
    tryAcquire(): boolean {
      pruneExpired();
      if (timestamps.length >= maxRequests) {
        return false;
      }
      timestamps.push(Date.now());
      return true;
    },
    getWaitTime(): number {
      pruneExpired();
      if (timestamps.length < maxRequests) return 0;
      return timestamps[0]! + windowMs - Date.now();
    },
    reset(): void {
      timestamps.length = 0;
    },
  };
}

// ============================================================================
// Logging Masking Utilities
// ============================================================================

/**
 * 민감한 ID를 마스킹 (앞 2자리 + *** + 뒤 2자리)
 *
 * 로그에 사용자 ID, 스태프 ID 등 민감한 식별자를 기록할 때 사용
 *
 * @param id - 마스킹할 ID
 * @returns 마스킹된 ID
 *
 * @example
 * ```ts
 * maskSensitiveId('abc123xyz');  // 'ab***yz'
 * maskSensitiveId('short');      // '****'
 * maskSensitiveId('');           // '****'
 * ```
 */
export function maskSensitiveId(id: string): string {
  if (!id || id.length < 5) return '****';
  return `${id.slice(0, 2)}***${id.slice(-2)}`;
}

/**
 * 로그용 업데이트 객체에서 민감한 필드 제거
 *
 * @param updates - 업데이트 객체
 * @param sensitiveKeys - 제거할 필드 키 목록
 * @returns 민감 필드가 제거된 객체
 *
 * @example
 * ```ts
 * sanitizeLogData({ name: 'John', notes: 'private' }, ['notes']);
 * // { name: 'John', notes: '[REDACTED]' }
 * ```
 */
export function sanitizeLogData<T extends Record<string, unknown>>(
  data: T,
  sensitiveKeys: string[] = ['notes', 'message', 'content', 'password']
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      sensitiveKeys.includes(key) ? '[REDACTED]' : value,
    ])
  );
}
