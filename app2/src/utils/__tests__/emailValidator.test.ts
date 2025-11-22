/**
 * 이메일 검증 유틸리티 테스트
 *
 * @description
 * emailValidator.ts의 모든 함수에 대한 종합 테스트 스위트입니다.
 * RFC 5322 표준 준수, 한국 이메일 제공자, 실시간 검증을 테스트합니다.
 *
 * @version 1.0.0
 * @since 2025-11-22
 * @feature Phase 3-4 검증 유틸리티 통합
 * @author T-HOLDEM Development Team
 *
 * 테스트 커버리지 목표: ≥90%
 */

import {
  validateEmail,
  validateEmailRealtime,
  extractEmailDomain,
  isCommonEmailDomain,
  COMMON_EMAIL_DOMAINS,
  type EmailValidationResult,
} from '../emailValidator';

describe('emailValidator', () => {
  describe('validateEmail', () => {
    describe('유효한 이메일', () => {
      it('기본 이메일 형식을 검증해야 한다', () => {
        const result = validateEmail('user@example.com');
        expect(result.isValid).toBe(true);
        expect(result.formatted).toBe('user@example.com');
        expect(result.errors).toHaveLength(0);
      });

      it('대문자를 소문자로 변환해야 한다', () => {
        const result = validateEmail('User@Example.COM');
        expect(result.isValid).toBe(true);
        expect(result.formatted).toBe('user@example.com');
      });

      it('앞뒤 공백을 제거해야 한다', () => {
        const result = validateEmail('  user@example.com  ');
        expect(result.isValid).toBe(true);
        expect(result.formatted).toBe('user@example.com');
      });

      it('한국 이메일 제공자를 지원해야 한다', () => {
        const emails = [
          'user@naver.com',
          'user@daum.net',
          'user@kakao.com',
          'user@gmail.com',
        ];

        emails.forEach((email) => {
          const result = validateEmail(email);
          expect(result.isValid).toBe(true);
          expect(result.formatted).toBe(email);
        });
      });

      it('특수문자를 포함한 로컬 파트를 허용해야 한다', () => {
        const emails = [
          'user.name@example.com',
          'user+tag@example.com',
          'user_name@example.com',
          'user-name@example.com',
        ];

        emails.forEach((email) => {
          const result = validateEmail(email);
          expect(result.isValid).toBe(true);
        });
      });

      it('서브도메인을 지원해야 한다', () => {
        const result = validateEmail('user@mail.example.co.kr');
        expect(result.isValid).toBe(true);
        expect(result.formatted).toBe('user@mail.example.co.kr');
      });
    });

    describe('무효한 이메일', () => {
      it('빈 문자열에 대해 에러를 반환해야 한다', () => {
        const result = validateEmail('');
        expect(result.isValid).toBe(false);
        expect(result.formatted).toBe('');
        expect(result.errors).toContain('이메일을 입력해주세요.');
      });

      it('공백만 있는 문자열에 대해 에러를 반환해야 한다', () => {
        const result = validateEmail('   ');
        expect(result.isValid).toBe(false);
        expect(result.formatted).toBe('');
        expect(result.errors).toContain('이메일을 입력해주세요.');
      });

      it('@가 없는 이메일에 대해 에러를 반환해야 한다', () => {
        const result = validateEmail('userexample.com');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('올바른 이메일 형식이 아닙니다.');
      });

      it('도메인이 없는 이메일에 대해 에러를 반환해야 한다', () => {
        const result = validateEmail('user@');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('올바른 이메일 형식이 아닙니다.');
      });

      it('로컬 파트가 없는 이메일에 대해 에러를 반환해야 한다', () => {
        const result = validateEmail('@example.com');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('올바른 이메일 형식이 아닙니다.');
      });

      it('도메인에 점이 없는 이메일에 대해 에러를 반환해야 한다', () => {
        const result = validateEmail('user@examplecom');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('유효한 도메인을 입력해주세요.');
      });

      it('공백이 포함된 이메일에 대해 에러를 반환해야 한다', () => {
        const emails = ['user name@example.com', 'user@example .com'];

        emails.forEach((email) => {
          const result = validateEmail(email);
          expect(result.isValid).toBe(false);
        });
      });

      it('연속된 점이 있는 로컬 파트에 대해 에러를 반환해야 한다', () => {
        const result = validateEmail('user..name@example.com');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('유효하지 않은 이메일 형식입니다.');
      });
    });

    describe('길이 검증', () => {
      it('최대 254자까지 허용해야 한다', () => {
        // RFC 5322 정규식은 도메인 라벨당 최대 63자를 허용
        // 현실적인 254자 이메일 생성
        const localPart = 'a'.repeat(64);
        // 63자 라벨 3개 + 점 2개 + com 3자 = 194자
        const label1 = 'b'.repeat(61);
        const label2 = 'c'.repeat(61);
        const label3 = 'd'.repeat(61);
        const domainPart = `${label1}.${label2}.${label3}.com`;
        const email = `${localPart}@${domainPart}`;

        // 64 + 1 + 189 = 254
        expect(email.length).toBe(254);
        const result = validateEmail(email);
        expect(result.isValid).toBe(true);
      });

      it('254자를 초과하면 에러를 반환해야 한다', () => {
        const email = 'a'.repeat(255) + '@example.com';
        const result = validateEmail(email);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          '이메일은 최대 254자까지 입력 가능합니다.'
        );
      });

      it('로컬 파트가 64자를 초과하면 에러를 반환해야 한다', () => {
        const localPart = 'a'.repeat(65);
        const email = `${localPart}@example.com`;
        const result = validateEmail(email);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          '이메일 사용자명은 최대 64자까지 입력 가능합니다.'
        );
      });
    });

    describe('RFC 5322 준수', () => {
      it('유효하지 않은 특수문자를 거부해야 한다', () => {
        const emails = [
          'user[name]@example.com',
          'user(name)@example.com',
          'user,name@example.com',
        ];

        emails.forEach((email) => {
          const result = validateEmail(email);
          expect(result.isValid).toBe(false);
        });
      });

      it('도메인의 하이픈 위치를 검증해야 한다', () => {
        // 하이픈이 시작이나 끝에 있으면 안 됨
        const result = validateEmail('user@-example.com');
        expect(result.isValid).toBe(false);
      });
    });
  });

  describe('validateEmailRealtime', () => {
    describe('타이핑 중 검증', () => {
      it('빈 문자열은 에러 없이 무효로 반환해야 한다', () => {
        const result = validateEmailRealtime('');
        expect(result.isValid).toBe(false);
        expect(result.formatted).toBe('');
        expect(result.errors).toHaveLength(0);
      });

      it('@가 없으면 관련 메시지를 반환해야 한다', () => {
        const result = validateEmailRealtime('user');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('@를 포함해야 합니다.');
      });

      it('@만 있으면 무효로 반환해야 한다', () => {
        const result = validateEmailRealtime('@');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('이메일 형식을 확인해주세요.');
      });

      it('@ 이후 입력 중에는 관대하게 검증해야 한다', () => {
        const result = validateEmailRealtime('user@example');
        expect(result.isValid).toBe(false);
        expect(result.formatted).toBe('user@example');
      });

      it('도메인에 점이 포함되면 유효로 반환해야 한다', () => {
        const result = validateEmailRealtime('user@example.com');
        expect(result.isValid).toBe(true);
        expect(result.formatted).toBe('user@example.com');
        expect(result.errors).toHaveLength(0);
      });

      it('대문자를 소문자로 변환해야 한다', () => {
        const result = validateEmailRealtime('User@Example.COM');
        expect(result.formatted).toBe('user@example.com');
      });

      it('앞뒤 공백을 제거해야 한다', () => {
        const result = validateEmailRealtime('  user@example.com  ');
        expect(result.formatted).toBe('user@example.com');
      });
    });

    describe('점진적 입력 시나리오', () => {
      it('단계별 입력을 올바르게 검증해야 한다', () => {
        const steps = [
          { input: 'u', expected: false },
          { input: 'us', expected: false },
          { input: 'user', expected: false },
          { input: 'user@', expected: false },
          { input: 'user@e', expected: false },
          { input: 'user@ex', expected: false },
          { input: 'user@example', expected: false },
          { input: 'user@example.', expected: false },
          { input: 'user@example.c', expected: true }, // 한 글자 TLD도 유효
          { input: 'user@example.co', expected: true },
          { input: 'user@example.com', expected: true },
        ];

        steps.forEach(({ input, expected }) => {
          const result = validateEmailRealtime(input);
          expect(result.isValid).toBe(expected);
        });
      });
    });
  });

  describe('extractEmailDomain', () => {
    it('유효한 이메일에서 도메인을 추출해야 한다', () => {
      expect(extractEmailDomain('user@example.com')).toBe('example.com');
      expect(extractEmailDomain('user@naver.com')).toBe('naver.com');
      expect(extractEmailDomain('user@mail.daum.net')).toBe('mail.daum.net');
    });

    it('무효한 이메일은 빈 문자열을 반환해야 한다', () => {
      expect(extractEmailDomain('invalid')).toBe('');
      expect(extractEmailDomain('user@')).toBe('');
      expect(extractEmailDomain('@example.com')).toBe('');
      expect(extractEmailDomain('')).toBe('');
    });

    it('여러 개의 @가 있는 경우 빈 문자열을 반환해야 한다', () => {
      // 유효하지 않은 이메일이므로 빈 문자열 반환이 올바른 동작
      expect(extractEmailDomain('user@name@example.com')).toBe('');
    });
  });

  describe('isCommonEmailDomain', () => {
    describe('일반 이메일 제공자', () => {
      it('한국 주요 이메일 제공자를 식별해야 한다', () => {
        const koreanEmails = [
          'user@naver.com',
          'user@daum.net',
          'user@kakao.com',
          'user@hanmail.net',
          'user@nate.com',
        ];

        koreanEmails.forEach((email) => {
          expect(isCommonEmailDomain(email)).toBe(true);
        });
      });

      it('글로벌 이메일 제공자를 식별해야 한다', () => {
        const globalEmails = [
          'user@gmail.com',
          'user@outlook.com',
          'user@hotmail.com',
          'user@yahoo.com',
          'user@icloud.com',
        ];

        globalEmails.forEach((email) => {
          expect(isCommonEmailDomain(email)).toBe(true);
        });
      });
    });

    describe('기업 이메일', () => {
      it('기업 이메일을 false로 반환해야 한다', () => {
        const corporateEmails = [
          'user@company.co.kr',
          'user@startup.io',
          'user@mycompany.com',
        ];

        corporateEmails.forEach((email) => {
          expect(isCommonEmailDomain(email)).toBe(false);
        });
      });
    });

    describe('대소문자 구분 없음', () => {
      it('대문자 도메인도 올바르게 식별해야 한다', () => {
        expect(isCommonEmailDomain('user@GMAIL.COM')).toBe(true);
        expect(isCommonEmailDomain('user@Naver.Com')).toBe(true);
      });
    });

    describe('무효한 이메일', () => {
      it('무효한 이메일은 false를 반환해야 한다', () => {
        expect(isCommonEmailDomain('invalid')).toBe(false);
        expect(isCommonEmailDomain('user@')).toBe(false);
        expect(isCommonEmailDomain('')).toBe(false);
      });
    });
  });

  describe('COMMON_EMAIL_DOMAINS', () => {
    it('10개의 주요 이메일 제공자를 포함해야 한다', () => {
      expect(COMMON_EMAIL_DOMAINS).toHaveLength(10);
    });

    it('한국 이메일 제공자를 포함해야 한다', () => {
      const koreanProviders = [
        'naver.com',
        'daum.net',
        'kakao.com',
        'hanmail.net',
        'nate.com',
      ];

      koreanProviders.forEach((provider) => {
        expect(COMMON_EMAIL_DOMAINS).toContain(provider);
      });
    });

    it('글로벌 이메일 제공자를 포함해야 한다', () => {
      const globalProviders = [
        'gmail.com',
        'outlook.com',
        'hotmail.com',
        'yahoo.com',
        'icloud.com',
      ];

      globalProviders.forEach((provider) => {
        expect(COMMON_EMAIL_DOMAINS).toContain(provider);
      });
    });
  });

  describe('통합 시나리오', () => {
    it('회원가입 플로우를 시뮬레이션해야 한다', () => {
      // 1. 사용자가 타이핑 시작
      let realtimeResult = validateEmailRealtime('u');
      expect(realtimeResult.isValid).toBe(false);

      // 2. 계속 타이핑
      realtimeResult = validateEmailRealtime('user@');
      expect(realtimeResult.isValid).toBe(false);

      // 3. 도메인 입력 중
      realtimeResult = validateEmailRealtime('user@naver');
      expect(realtimeResult.isValid).toBe(false);

      // 4. 완성
      realtimeResult = validateEmailRealtime('user@naver.com');
      expect(realtimeResult.isValid).toBe(true);

      // 5. 제출 시 엄격한 검증
      const finalResult = validateEmail('user@naver.com');
      expect(finalResult.isValid).toBe(true);
      expect(finalResult.formatted).toBe('user@naver.com');
    });

    it('일반 제공자와 기업 이메일을 구분해야 한다', () => {
      const personalEmail = 'user@gmail.com';
      const corporateEmail = 'user@company.co.kr';

      expect(isCommonEmailDomain(personalEmail)).toBe(true);
      expect(isCommonEmailDomain(corporateEmail)).toBe(false);

      expect(extractEmailDomain(personalEmail)).toBe('gmail.com');
      expect(extractEmailDomain(corporateEmail)).toBe('company.co.kr');
    });
  });
});
