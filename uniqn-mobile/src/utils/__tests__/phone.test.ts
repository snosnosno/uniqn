/**
 * UNIQN Mobile - Phone Utility Tests
 *
 * @description Tests for phone number formatting, normalization, and validation
 */

import {
  formatPhoneNumber,
  cleanPhoneNumber,
  toE164,
  isE164,
  isValidKoreanPhone,
  formatE164ToDisplay,
  formatPhoneForDisplay,
} from '../phone';

describe('Phone Utils', () => {
  describe('formatPhoneNumber', () => {
    it('should format 11-digit phone numbers', () => {
      expect(formatPhoneNumber('01012345678')).toBe('010-1234-5678');
      expect(formatPhoneNumber('01098765432')).toBe('010-9876-5432');
    });

    it('should format 10-digit phone numbers', () => {
      expect(formatPhoneNumber('0101234567')).toBe('010-123-4567');
    });

    it('should handle partial input (3 digits or less)', () => {
      expect(formatPhoneNumber('010')).toBe('010');
      expect(formatPhoneNumber('01')).toBe('01');
      expect(formatPhoneNumber('0')).toBe('0');
    });

    it('should handle partial input (4-7 digits)', () => {
      expect(formatPhoneNumber('0101')).toBe('010-1');
      expect(formatPhoneNumber('0101234')).toBe('010-1234');
    });

    it('should handle already formatted numbers with hyphens', () => {
      expect(formatPhoneNumber('010-1234-5678')).toBe('010-1234-5678');
    });

    it('should strip non-digit characters before formatting', () => {
      expect(formatPhoneNumber('010 1234 5678')).toBe('010-1234-5678');
    });
  });

  describe('cleanPhoneNumber', () => {
    it('should remove hyphens', () => {
      expect(cleanPhoneNumber('010-1234-5678')).toBe('01012345678');
    });

    it('should remove spaces', () => {
      expect(cleanPhoneNumber('010 1234 5678')).toBe('01012345678');
    });

    it('should keep digits only', () => {
      expect(cleanPhoneNumber('+82-10-1234-5678')).toBe('821012345678');
    });
  });

  describe('toE164', () => {
    it('should convert 010 format to E.164', () => {
      expect(toE164('01012345678')).toBe('+821012345678');
    });

    it('should pass through +82 format', () => {
      expect(toE164('+821012345678')).toBe('+821012345678');
    });

    it('should handle 82 prefix without +', () => {
      expect(toE164('821012345678')).toBe('+821012345678');
    });

    it('should handle 0-prefixed numbers', () => {
      expect(toE164('01098765432')).toBe('+821098765432');
    });

    it('should strip hyphens before converting', () => {
      expect(toE164('010-1234-5678')).toBe('+821012345678');
    });
  });

  describe('isE164', () => {
    it('should validate correct +82 format', () => {
      expect(isE164('+821012345678')).toBe(true);
      expect(isE164('+8201012345678')).toBe(false);
    });

    it('should reject formats without +82 prefix', () => {
      expect(isE164('01012345678')).toBe(false);
      expect(isE164('821012345678')).toBe(false);
    });

    it('should reject invalid lengths', () => {
      expect(isE164('+8210')).toBe(false);
      expect(isE164('+82101234567890')).toBe(false);
    });

    it('should reject non-numeric characters after prefix', () => {
      expect(isE164('+82-10-1234-5678')).toBe(false);
    });
  });

  describe('isValidKoreanPhone', () => {
    it('should validate E.164 format', () => {
      expect(isValidKoreanPhone('+821012345678')).toBe(true);
    });

    it('should validate local 010 format', () => {
      expect(isValidKoreanPhone('01012345678')).toBe(true);
      expect(isValidKoreanPhone('0101234567')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(isValidKoreanPhone('010-1234-5678')).toBe(false);
      expect(isValidKoreanPhone('12345')).toBe(false);
      expect(isValidKoreanPhone('')).toBe(false);
    });
  });

  describe('formatE164ToDisplay', () => {
    it('should convert +82 to local display format', () => {
      expect(formatE164ToDisplay('+821012345678')).toBe('010-1234-5678');
    });

    it('should pass through non-+82 numbers', () => {
      expect(formatE164ToDisplay('+11234567890')).toBe('+11234567890');
      expect(formatE164ToDisplay('01012345678')).toBe('010-1234-5678');
    });
  });

  // 화면 표시 전용 — 저장 형태(E.164 / 로컬 / 하이픈 포함)가 섞여 들어온다.
  describe('formatPhoneForDisplay', () => {
    it('E.164 국가코드를 로컬 표기로 되돌린다', () => {
      expect(formatPhoneForDisplay('+821012345678')).toBe('010-1234-5678');
    });

    it("'+' 없이 저장된 국가코드도 로컬 표기로 되돌린다", () => {
      // 실사고: 이 값이 그대로 3-4-4 로 잘려 '821-0980-0903' 처럼 보였다.
      expect(formatPhoneForDisplay('821012345678')).toBe('010-1234-5678');
    });

    it('국가코드 뒤 자릿수가 짧아도 숫자를 잘라먹지 않는다', () => {
      expect(formatPhoneForDisplay('+82109800903')).toBe('010-980-0903');
    });

    it('로컬 번호는 하이픈만 넣는다', () => {
      expect(formatPhoneForDisplay('01012345678')).toBe('010-1234-5678');
      expect(formatPhoneForDisplay('010-1234-5678')).toBe('010-1234-5678');
      expect(formatPhoneForDisplay('021234567')).toBe('021-234-567');
    });

    it('한국 번호가 아니면 원문을 그대로 둔다 — 임의 정규화가 오히려 오표기를 만든다', () => {
      expect(formatPhoneForDisplay('+11234567890')).toBe('+11234567890');
      expect(formatPhoneForDisplay('+8112345678')).toBe('+8112345678');
    });

    it('빈 값·공백은 빈 문자열', () => {
      expect(formatPhoneForDisplay('')).toBe('');
      expect(formatPhoneForDisplay('   ')).toBe('');
    });
  });
});
