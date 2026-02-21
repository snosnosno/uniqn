/**
 * security 유틸리티 테스트
 *
 * @description XSS/SQL Injection 탐지, 입력 검증, 비밀번호 강도 등 보안 유틸리티 테스트
 */

jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import {
  hasXSSPattern,
  hasSQLInjectionPattern,
  xssValidation,
  isSafeText,
  sanitizeInput,
  escapeHtml,
  isSafeUrl,
  isValidPhoneNumber,
  isValidEmail,
  isRateLimited,
  getPasswordStrength,
  maskSensitiveId,
  sanitizeLogData,
  normalizeForSecurity,
} from '../security';

describe('security', () => {
  // ============================================================================
  // hasXSSPattern 테스트
  // ============================================================================
  describe('hasXSSPattern', () => {
    it('안전한 텍스트는 false', () => {
      expect(hasXSSPattern('안녕하세요')).toBe(false);
      expect(hasXSSPattern('Hello World')).toBe(false);
      expect(hasXSSPattern('test@example.com')).toBe(false);
    });

    it('<script> 태그 탐지', () => {
      expect(hasXSSPattern('<script>alert("xss")</script>')).toBe(true);
    });

    it('javascript: 프로토콜 탐지', () => {
      expect(hasXSSPattern('javascript:alert(1)')).toBe(true);
    });

    it('on* 이벤트 핸들러 탐지', () => {
      // Note: XSS_PATTERNS 배열의 정규식에 /g 플래그가 있어 lastIndex가 유지됨
      // 따라서 각 호출은 독립적으로 테스트
      expect(hasXSSPattern('onclick=alert(1)')).toBe(true);
    });

    it('iframe/object/embed 태그 탐지', () => {
      expect(hasXSSPattern('<iframe src="evil.com">')).toBe(true);
      expect(hasXSSPattern('<object data="evil">')).toBe(true);
      expect(hasXSSPattern('<embed src="evil">')).toBe(true);
    });

    it('빈 문자열/null/undefined는 false', () => {
      expect(hasXSSPattern('')).toBe(false);
      expect(hasXSSPattern(null as unknown as string)).toBe(false);
      expect(hasXSSPattern(undefined as unknown as string)).toBe(false);
    });

    it('SVG 태그 탐지', () => {
      expect(hasXSSPattern('<svg onload=alert(1)>')).toBe(true);
      expect(hasXSSPattern('<svg/onload=alert(1)>')).toBe(true);
    });

    it('data:base64 URI 탐지 (위험한 MIME 타입)', () => {
      expect(hasXSSPattern('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBe(
        true
      );
      expect(hasXSSPattern('data:application/javascript;base64,YWxlcnQoMSk=')).toBe(true);
      expect(hasXSSPattern('data:text/javascript;base64,YWxlcnQoMSk=')).toBe(true);
    });

    it('data:image base64 URI는 허용 (false positive 방지)', () => {
      expect(hasXSSPattern('data:image/png;base64,iVBORw0KGgo=')).toBe(false);
      expect(hasXSSPattern('data:image/jpeg;base64,/9j/4AAQ=')).toBe(false);
      expect(hasXSSPattern('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
    });

    // --- 인코딩 공격 방어 테스트 ---

    it('HTML 10진수 엔티티 인코딩된 script 태그 탐지', () => {
      expect(hasXSSPattern('&#60;script&#62;alert(1)&#60;/script&#62;')).toBe(true);
    });

    it('HTML 16진수 엔티티 인코딩된 script 태그 탐지', () => {
      expect(hasXSSPattern('&#x3c;script&#x3e;alert(1)&#x3c;/script&#x3e;')).toBe(true);
    });

    it('명명된 HTML 엔티티 인코딩된 태그 탐지', () => {
      expect(hasXSSPattern('&lt;script&gt;alert(1)&lt;/script&gt;')).toBe(true);
    });

    it('URL 인코딩된 javascript: 프로토콜 탐지', () => {
      expect(hasXSSPattern('%6Aavascript:alert(1)')).toBe(true);
      expect(hasXSSPattern('java%73cript:alert(1)')).toBe(true);
    });

    it('이중 URL 인코딩 공격 탐지', () => {
      expect(hasXSSPattern('%253Cscript%253Ealert(1)%253C/script%253E')).toBe(true);
    });

    it('Cyrillic 호모그래프 공격 탐지 (jаvаscript:)', () => {
      // \u0430 = Cyrillic 'а' (시각적으로 Latin 'a'와 동일)
      expect(hasXSSPattern('j\u0430v\u0430script:alert(1)')).toBe(true);
    });

    it('Cyrillic 호모그래프: on이벤트 핸들러', () => {
      // \u043E = Cyrillic 'о' (looks like Latin 'o')
      expect(hasXSSPattern('\u043Enclick=alert(1)')).toBe(true);
    });

    it('연속 호출 시 lastIndex 버그 없음', () => {
      // /g 플래그 regex의 lastIndex가 리셋되는지 검증
      expect(hasXSSPattern('javascript:void(0)')).toBe(true);
      expect(hasXSSPattern('javascript:void(0)')).toBe(true);
      expect(hasXSSPattern('javascript:void(0)')).toBe(true);
    });

    it('정상 한글 텍스트는 false (false positive 방지)', () => {
      expect(hasXSSPattern('안녕하세요 반갑습니다')).toBe(false);
      expect(hasXSSPattern('포커 딜러 모집합니다')).toBe(false);
      expect(hasXSSPattern('서울특별시 강남구 역삼동 123-45')).toBe(false);
      expect(hasXSSPattern('시급 15,000원 ~ 20,000원')).toBe(false);
    });

    it('영문+숫자 일반 텍스트는 false', () => {
      expect(hasXSSPattern('John Doe joined as a dealer')).toBe(false);
      expect(hasXSSPattern('Event #2024-001 started')).toBe(false);
    });
  });

  // ============================================================================
  // normalizeForSecurity 테스트
  // ============================================================================
  describe('normalizeForSecurity', () => {
    it('빈 문자열 처리', () => {
      expect(normalizeForSecurity('')).toBe('');
      expect(normalizeForSecurity(null as unknown as string)).toBe('');
    });

    it('HTML 10진수 엔티티 디코딩', () => {
      expect(normalizeForSecurity('&#60;')).toBe('<');
      expect(normalizeForSecurity('&#62;')).toBe('>');
    });

    it('HTML 16진수 엔티티 디코딩', () => {
      expect(normalizeForSecurity('&#x3c;')).toBe('<');
      expect(normalizeForSecurity('&#x3E;')).toBe('>');
    });

    it('명명된 HTML 엔티티 디코딩', () => {
      expect(normalizeForSecurity('&lt;&gt;&amp;&quot;&#39;')).toBe('<>&"\'');
    });

    it('URL 인코딩 디코딩', () => {
      expect(normalizeForSecurity('%3Cscript%3E')).toBe('<script>');
    });

    it('이중 URL 인코딩 디코딩', () => {
      expect(normalizeForSecurity('%253C')).toBe('<');
    });

    it('Cyrillic → Latin 호모그래프 치환', () => {
      // \u0430 = Cyrillic а, \u0435 = Cyrillic е
      expect(normalizeForSecurity('\u0430\u0435')).toBe('ae');
    });

    it('일반 한글은 변경 없음', () => {
      expect(normalizeForSecurity('안녕하세요')).toBe('안녕하세요');
    });

    it('잘못된 URL 인코딩은 무시', () => {
      expect(normalizeForSecurity('%ZZ')).toBe('%ZZ');
    });
  });

  // ============================================================================
  // hasSQLInjectionPattern 테스트
  // ============================================================================
  describe('hasSQLInjectionPattern', () => {
    it('안전한 텍스트는 false', () => {
      expect(hasSQLInjectionPattern('일반 텍스트')).toBe(false);
    });

    it('SQL 패턴 탐지', () => {
      expect(hasSQLInjectionPattern('union select * from users')).toBe(true);
      expect(hasSQLInjectionPattern("'; drop table users;--")).toBe(true);
      expect(hasSQLInjectionPattern('delete from users')).toBe(true);
    });

    it('빈 문자열은 false', () => {
      expect(hasSQLInjectionPattern('')).toBe(false);
    });
  });

  // ============================================================================
  // xssValidation 테스트
  // ============================================================================
  describe('xssValidation', () => {
    it('안전한 텍스트는 true (Zod refine용)', () => {
      expect(xssValidation('안전한 텍스트')).toBe(true);
    });

    it('XSS 패턴이 있으면 false', () => {
      expect(xssValidation('<script>alert(1)</script>')).toBe(false);
    });
  });

  // ============================================================================
  // isSafeText 테스트
  // ============================================================================
  describe('isSafeText', () => {
    it('안전한 텍스트는 true', () => {
      expect(isSafeText('안전한 텍스트')).toBe(true);
    });

    it('XSS 패턴이 있으면 false', () => {
      expect(isSafeText('<script>evil</script>')).toBe(false);
    });

    it('SQL Injection 패턴이 있으면 false', () => {
      expect(isSafeText('union select * from users')).toBe(false);
    });

    it('maxLength 초과 시 false', () => {
      const longText = 'a'.repeat(501);
      expect(isSafeText(longText)).toBe(false);
      expect(isSafeText(longText, 1000)).toBe(true);
    });

    it('빈 문자열은 false', () => {
      expect(isSafeText('')).toBe(false);
    });
  });

  // ============================================================================
  // sanitizeInput 테스트
  // ============================================================================
  describe('sanitizeInput', () => {
    it('HTML 태그 제거', () => {
      expect(sanitizeInput('<b>bold</b>')).toBe('bold');
    });

    it('script 태그와 내용 제거', () => {
      const result = sanitizeInput('hello<script>evil()</script>world');
      expect(result).not.toContain('script');
      expect(result).not.toContain('evil');
    });

    it('javascript: 프로토콜 제거', () => {
      expect(sanitizeInput('javascript:alert(1)')).not.toContain('javascript:');
    });

    it('빈 문자열 처리', () => {
      expect(sanitizeInput('')).toBe('');
      expect(sanitizeInput(null as unknown as string)).toBe('');
    });

    it('앞뒤 공백 제거(trim)', () => {
      expect(sanitizeInput('  hello  ')).toBe('hello');
    });
  });

  // ============================================================================
  // escapeHtml 테스트
  // ============================================================================
  describe('escapeHtml', () => {
    it('HTML 엔티티 이스케이프', () => {
      expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
      expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
      expect(escapeHtml("it's")).toBe('it&#39;s');
      expect(escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('빈 문자열 처리', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('일반 텍스트는 그대로', () => {
      expect(escapeHtml('안녕하세요')).toBe('안녕하세요');
    });
  });

  // ============================================================================
  // isSafeUrl 테스트
  // ============================================================================
  describe('isSafeUrl', () => {
    it('https URL은 안전', () => {
      expect(isSafeUrl('https://example.com')).toBe(true);
    });

    it('http URL은 안전', () => {
      expect(isSafeUrl('http://example.com')).toBe(true);
    });

    it('javascript: 프로토콜은 위험', () => {
      expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    });

    it('data: 프로토콜은 위험', () => {
      expect(isSafeUrl('data:text/html,<script>evil</script>')).toBe(false);
    });

    it('상대 경로는 안전', () => {
      expect(isSafeUrl('/path/to/page')).toBe(true);
      expect(isSafeUrl('./relative')).toBe(true);
    });

    it('빈 문자열은 위험', () => {
      expect(isSafeUrl('')).toBe(false);
    });

    it('URL 인코딩된 javascript: 프로토콜 차단', () => {
      expect(isSafeUrl('%6Aavascript:alert(1)')).toBe(false);
      expect(isSafeUrl('java%73cript:alert(1)')).toBe(false);
    });

    it('Cyrillic 호모그래프 javascript: 차단', () => {
      expect(isSafeUrl('j\u0430v\u0430script:alert(1)')).toBe(false);
    });

    it('이중 인코딩된 data: 프로토콜 차단', () => {
      expect(isSafeUrl('%2564ata:text/html,evil')).toBe(false);
    });
  });

  // ============================================================================
  // isValidPhoneNumber 테스트
  // ============================================================================
  describe('isValidPhoneNumber', () => {
    it('유효한 휴대폰 번호', () => {
      expect(isValidPhoneNumber('010-1234-5678')).toBe(true);
      expect(isValidPhoneNumber('01012345678')).toBe(true);
    });

    it('잘못된 번호', () => {
      expect(isValidPhoneNumber('02-1234-5678')).toBe(false);
      expect(isValidPhoneNumber('1234567890')).toBe(false);
      expect(isValidPhoneNumber('')).toBe(false);
    });
  });

  // ============================================================================
  // isValidEmail 테스트
  // ============================================================================
  describe('isValidEmail', () => {
    it('유효한 이메일', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.kr')).toBe(true);
    });

    it('잘못된 이메일', () => {
      expect(isValidEmail('not-an-email')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  // ============================================================================
  // isRateLimited 테스트
  // ============================================================================
  describe('isRateLimited', () => {
    it('lastAttempt가 null이면 제한 없음', () => {
      expect(isRateLimited(null)).toBe(false);
    });

    it('쿨다운 내에 있으면 true', () => {
      const recentAttempt = Date.now() - 1000; // 1초 전
      expect(isRateLimited(recentAttempt, 60000)).toBe(true);
    });

    it('쿨다운 경과 후에는 false', () => {
      const oldAttempt = Date.now() - 120000; // 2분 전
      expect(isRateLimited(oldAttempt, 60000)).toBe(false);
    });
  });

  // ============================================================================
  // getPasswordStrength 테스트
  // ============================================================================
  describe('getPasswordStrength', () => {
    it('짧은 비밀번호는 낮은 점수', () => {
      const result = getPasswordStrength('abc');
      expect(result.score).toBeLessThan(3);
      expect(result.feedback.length).toBeGreaterThan(0);
    });

    it('강한 비밀번호는 높은 점수', () => {
      const result = getPasswordStrength('MyStr0ng!Pass');
      expect(result.score).toBeGreaterThanOrEqual(4);
    });

    it('연속 문자 패턴 감지', () => {
      const result = getPasswordStrength('Pass123word!');
      expect(result.feedback).toEqual(expect.arrayContaining([expect.stringContaining('연속')]));
    });

    it('빈 비밀번호는 점수 0', () => {
      const result = getPasswordStrength('');
      expect(result.score).toBe(0);
    });
  });

  // ============================================================================
  // maskSensitiveId 테스트
  // ============================================================================
  describe('maskSensitiveId', () => {
    it('5자 이상 ID 마스킹', () => {
      expect(maskSensitiveId('abc123xyz')).toBe('ab***yz');
    });

    it('5자 미만 ID는 전체 마스킹', () => {
      expect(maskSensitiveId('abc')).toBe('****');
      expect(maskSensitiveId('')).toBe('****');
    });
  });

  // ============================================================================
  // sanitizeLogData 테스트
  // ============================================================================
  describe('sanitizeLogData', () => {
    it('민감 필드를 [REDACTED]로 대체', () => {
      const data = { name: 'John', notes: 'private info', password: 'secret' };
      const result = sanitizeLogData(data);

      expect(result.name).toBe('John');
      expect(result.notes).toBe('[REDACTED]');
      expect(result.password).toBe('[REDACTED]');
    });

    it('커스텀 민감 필드 목록 지원', () => {
      const data = { email: 'test@test.com', phone: '01012345678' };
      const result = sanitizeLogData(data, ['email']);

      expect(result.email).toBe('[REDACTED]');
      expect(result.phone).toBe('01012345678');
    });
  });
});
