/**
 * security 유틸리티 테스트
 *
 * @description XSS 탐지, 입력 검증, 비밀번호 강도 등 보안 유틸리티 테스트
 */

import {
  hasXSSPattern,
  xssValidation,
  sanitizeInput,
  isSafeUrl,
  isValidPhoneNumber,
  isValidEmail,
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

// ============================================================================
// #4 app-wide XSS 하드닝 — 여는태그 단독/이벤트 일반화/data·인코딩 보강 + 오탐 수정
// 근거: XSS_PATTERNS가 닫는태그/닫는> 강제 → 절단형 통과, on* allowlist 갭,
//       프로토콜/data 인코딩 구멍. 동시에 expression(/JavaScript: 등 정상입력 오탐.
// ============================================================================
describe('security #4 XSS 하드닝', () => {
  describe('여는태그 단독/절단형 탐지', () => {
    it('닫는 </script> 없는 절단 script 탐지', () => {
      expect(hasXSSPattern('<script>alert(1)')).toBe(true);
      expect(hasXSSPattern('<script>alert(document.cookie)')).toBe(true);
      expect(hasXSSPattern('<SCRIPT>alert(1)')).toBe(true);
    });

    it('닫는태그 없는 외부 src script 탐지', () => {
      expect(hasXSSPattern('<script src=//evil.com/x.js>')).toBe(true);
      expect(hasXSSPattern('<script src=https://evil.com/x.js>')).toBe(true);
    });

    it('닫는 > 없는 절단 iframe/object/embed/svg 탐지', () => {
      expect(hasXSSPattern('<iframe src=//evil.com/clickjack')).toBe(true);
      expect(hasXSSPattern('<iframe src=//evil.com')).toBe(true);
      expect(hasXSSPattern('<object data=//evil.com/x')).toBe(true);
      expect(hasXSSPattern('<embed src=//evil.com/x')).toBe(true);
      expect(hasXSSPattern('<svg onpointerover=alert(1)')).toBe(true);
    });

    it('미목록 위험태그(base/meta/style/form/math/link/template) 탐지', () => {
      expect(hasXSSPattern('<base href=//evil.com>')).toBe(true);
      expect(hasXSSPattern('<meta http-equiv=refresh content="0;url=//evil.com">')).toBe(true);
      expect(hasXSSPattern("<style>@import'//evil'</style>")).toBe(true);
      expect(hasXSSPattern('<form action=//evil><input formaction=javascript:alert(1)>')).toBe(
        true
      );
      expect(hasXSSPattern('<math href=javascript:alert(1)>click')).toBe(true);
    });
  });

  describe('이벤트 핸들러 일반화(allowlist 갭)', () => {
    it('allowlist 미포함 자동발화 이벤트 탐지', () => {
      expect(hasXSSPattern('<details open ontoggle=alert(1)>')).toBe(true);
      expect(hasXSSPattern('<details open onbeforetoggle=alert(1)>')).toBe(true);
      expect(hasXSSPattern('<input autofocus onfocusin=alert(1)>')).toBe(true);
      expect(hasXSSPattern('<body onpageshow=alert(1)>')).toBe(true);
    });

    it('allowlist 미포함 상호작용 이벤트 탐지', () => {
      expect(hasXSSPattern('<img src=x onpointerover=alert(1)>')).toBe(true);
      expect(hasXSSPattern('<img src=x onmouseenter=alert(1)>')).toBe(true);
      expect(hasXSSPattern('<input onbeforeinput=alert(1)>')).toBe(true);
      expect(hasXSSPattern('<div oncopy=alert(1)>copy</div>')).toBe(true);
      expect(hasXSSPattern('<a onauxclick=alert(1)>x</a>')).toBe(true);
      expect(hasXSSPattern('<xss onwheel=alert(1)>scroll</xss>')).toBe(true);
    });

    it('개행 속성구분자 이벤트 탐지', () => {
      expect(hasXSSPattern('<img src=x\nonpointerdown=alert(1)>')).toBe(true);
    });

    it('bare on이벤트 핸들러 탐지 유지(기존 동작 보존)', () => {
      expect(hasXSSPattern('onclick=alert(1)')).toBe(true);
    });
  });

  describe('data:/프로토콜/인코딩 보강', () => {
    it('비-base64 data: 스크립트 스킴 탐지', () => {
      expect(hasXSSPattern('data:text/javascript,alert(1)')).toBe(true);
      expect(hasXSSPattern('data:application/xhtml+xml;charset=utf-8;base64,PD94bWw=')).toBe(true);
    });

    it('프로토콜 내 제어문자 분절 탐지(탭/개행)', () => {
      expect(hasXSSPattern('java\tscript:alert(1)')).toBe(true);
      expect(hasXSSPattern('java\nscript:alert(1)')).toBe(true);
    });

    it('엔티티 난독 프로토콜 탐지(세미콜론없음/명명엔티티)', () => {
      expect(hasXSSPattern('jav&#9;ascript:alert(1)')).toBe(true);
      expect(hasXSSPattern('javascript&#58alert(1)')).toBe(true);
      expect(hasXSSPattern('javascript&colon;alert(1)')).toBe(true);
      expect(hasXSSPattern('javascript&colon;alert&lpar;1&rpar;')).toBe(true);
      expect(hasXSSPattern('<a href=&#106;avascript:alert(1)>')).toBe(true);
    });

    it('고립 % 로 인한 URL디코드 무력화 우회 탐지', () => {
      expect(hasXSSPattern('%3Cscript%3Ealert(1)%3C/script%3E%')).toBe(true);
    });
  });

  describe('프로토콜 협소화 우회 차단(연산자/숫자 시작) + split-entity', () => {
    it('콜론 뒤 연산자/숫자로 시작하는 javascript: 실행형 탐지', () => {
      expect(hasXSSPattern('javascript:0||alert(1)')).toBe(true);
      expect(hasXSSPattern('javascript:!alert(1)')).toBe(true);
      expect(hasXSSPattern('javascript:+alert(1)')).toBe(true);
      expect(hasXSSPattern('javascript:1?alert(1):0')).toBe(true);
      expect(hasXSSPattern('javascript:/**/alert(1)')).toBe(true);
      expect(hasXSSPattern('vbscript:0+msgbox(1)')).toBe(true);
    });

    it('이중 인코딩(split-entity) 여는태그 탐지', () => {
      expect(hasXSSPattern('&#38;#60;script>alert(1)')).toBe(true);
      expect(hasXSSPattern('&#38;#60;iframe>')).toBe(true);
    });
  });

  describe('오탐 수정 — 정상입력 통과(현행 오탐 제거)', () => {
    it('expression(...) 영단어/수식 산문 통과', () => {
      expect(hasXSSPattern('그 expression(표현)이 자연스러워요')).toBe(false);
      expect(hasXSSPattern('정규 expression(regex)을 평가하면')).toBe(false);
      expect(hasXSSPattern('정규 expression (regex) 패턴')).toBe(false);
      expect(hasXSSPattern('f(expression(x)) 중첩')).toBe(false);
    });

    it('콜론 동반 기술스택 라벨 통과(JavaScript:/VBScript:)', () => {
      expect(hasXSSPattern('JavaScript: 중급 이상 (경력 3년)')).toBe(false);
      expect(hasXSSPattern('VBScript: 레거시 유지보수')).toBe(false);
    });

    it('실제 CSS expression XSS는 여전히 차단(콜론 컨텍스트)', () => {
      expect(hasXSSPattern('<div style="width:expression(alert(1))">')).toBe(true);
    });

    it('부등호/이모티콘/태그명 단어 통과(bare < 미차단)', () => {
      expect(hasXSSPattern('조건 a < b, 1<2, x<=y, if(a<b){}')).toBe(false);
      expect(hasXSSPattern('우리팀 최고 <3 // 헤어짐 </3')).toBe(false);
      expect(hasXSSPattern('script 작성법을 알려주세요')).toBe(false);
      expect(hasXSSPattern('iframe 사용법 문의')).toBe(false);
      expect(hasXSSPattern('공지 <br> 흐름 -> 결과, <- 이전 단계')).toBe(false);
      expect(hasXSSPattern('<details>요약 토글</details> 사용')).toBe(false);
    });
  });

  describe('sanitizeInput — 절단형 위험태그 제거', () => {
    it('닫는 > 없는 절단 위험태그도 제거', () => {
      expect(sanitizeInput('hi<script src=//evil.com/x.js')).toBe('hi');
      expect(sanitizeInput('x<iframe src=//evil')).toBe('x');
    });

    it('위험태그 아닌 부등호는 보존', () => {
      expect(sanitizeInput('a<b 비교')).toBe('a<b 비교');
    });
  });
});
