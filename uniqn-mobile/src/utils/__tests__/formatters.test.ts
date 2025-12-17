/**
 * UNIQN Mobile - Formatters Tests
 *
 * @description Tests for formatting utility functions
 */

import {
  formatNumber,
  formatCurrency,
  formatCurrencyShort,
  formatPhone,
  maskPhone,
  maskName,
  maskEmail,
  formatPositions,
  formatPercent,
  formatFileSize,
  truncate,
  capitalize,
  padNumber,
} from '../formatters';

describe('Formatters', () => {
  describe('formatNumber', () => {
    it('should format numbers with thousands separator', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1000000)).toBe('1,000,000');
      expect(formatNumber(123456789)).toBe('123,456,789');
    });

    it('should handle small numbers', () => {
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(999)).toBe('999');
    });

    it('should handle null/undefined', () => {
      expect(formatNumber(null)).toBe('0');
      expect(formatNumber(undefined)).toBe('0');
    });

    it('should handle decimal numbers', () => {
      expect(formatNumber(1234.56)).toBe('1,234.56');
    });
  });

  describe('formatCurrency', () => {
    it('should format currency with won symbol', () => {
      expect(formatCurrency(15000)).toBe('₩15,000');
      expect(formatCurrency(150000)).toBe('₩150,000');
      expect(formatCurrency(1500000)).toBe('₩1,500,000');
    });

    it('should handle zero', () => {
      expect(formatCurrency(0)).toBe('₩0');
    });

    it('should handle null/undefined', () => {
      expect(formatCurrency(null)).toBe('₩0');
      expect(formatCurrency(undefined)).toBe('₩0');
    });
  });

  describe('formatCurrencyShort', () => {
    it('should format amounts under 10,000', () => {
      expect(formatCurrencyShort(5000)).toBe('5,000원');
      expect(formatCurrencyShort(9999)).toBe('9,999원');
    });

    it('should format amounts in 만원 units', () => {
      expect(formatCurrencyShort(10000)).toBe('1만원');
      expect(formatCurrencyShort(150000)).toBe('15만원');
      expect(formatCurrencyShort(1000000)).toBe('100만원');
    });

    it('should format amounts with remainder', () => {
      expect(formatCurrencyShort(15000)).toBe('1만 5,000원');
      expect(formatCurrencyShort(125000)).toBe('12만 5,000원');
    });

    it('should handle zero', () => {
      expect(formatCurrencyShort(0)).toBe('0원');
    });

    it('should handle null/undefined', () => {
      expect(formatCurrencyShort(null)).toBe('0원');
      expect(formatCurrencyShort(undefined)).toBe('0원');
    });
  });

  describe('formatPhone', () => {
    it('should format 11-digit phone numbers', () => {
      expect(formatPhone('01012345678')).toBe('010-1234-5678');
      expect(formatPhone('01098765432')).toBe('010-9876-5432');
    });

    it('should format 10-digit phone numbers', () => {
      expect(formatPhone('0101234567')).toBe('010-123-4567');
    });

    it('should handle already formatted numbers', () => {
      expect(formatPhone('010-1234-5678')).toBe('010-1234-5678');
    });

    it('should return empty string for null/undefined', () => {
      expect(formatPhone(null)).toBe('');
      expect(formatPhone(undefined)).toBe('');
    });

    it('should return original for invalid formats', () => {
      expect(formatPhone('123')).toBe('123');
      expect(formatPhone('invalid')).toBe('invalid');
    });
  });

  describe('maskPhone', () => {
    it('should mask middle part of phone number', () => {
      expect(maskPhone('01012345678')).toBe('010-****-5678');
      expect(maskPhone('010-1234-5678')).toBe('010-****-5678');
    });

    it('should return empty string for null/undefined', () => {
      expect(maskPhone(null)).toBe('');
      expect(maskPhone(undefined)).toBe('');
    });

    it('should return original for invalid formats', () => {
      expect(maskPhone('123')).toBe('123');
    });
  });

  describe('maskName', () => {
    it('should mask middle characters of name', () => {
      expect(maskName('홍길동')).toBe('홍*동');
      expect(maskName('김철수민')).toBe('김**민');
    });

    it('should mask 2-character names', () => {
      expect(maskName('김철')).toBe('김*');
    });

    it('should not mask single character names', () => {
      expect(maskName('김')).toBe('김');
    });

    it('should return empty string for null/undefined', () => {
      expect(maskName(null)).toBe('');
      expect(maskName(undefined)).toBe('');
      expect(maskName('')).toBe('');
    });
  });

  describe('maskEmail', () => {
    it('should mask email local part', () => {
      expect(maskEmail('hello@gmail.com')).toBe('h***@gmail.com');
      expect(maskEmail('test@example.com')).toBe('t***@example.com');
    });

    it('should handle short local parts', () => {
      expect(maskEmail('ab@test.com')).toBe('a*@test.com');
    });

    it('should return empty string for null/undefined', () => {
      expect(maskEmail(null)).toBe('');
      expect(maskEmail(undefined)).toBe('');
    });

    it('should return original for invalid emails', () => {
      expect(maskEmail('invalid')).toBe('invalid');
    });
  });

  describe('formatPositions', () => {
    it('should format filled/total positions', () => {
      expect(formatPositions(3, 5)).toBe('3/5명');
      expect(formatPositions(0, 10)).toBe('0/10명');
      expect(formatPositions(10, 10)).toBe('10/10명');
    });
  });

  describe('formatPercent', () => {
    it('should format percentage without decimals by default', () => {
      expect(formatPercent(50)).toBe('50%');
      expect(formatPercent(100)).toBe('100%');
      expect(formatPercent(0)).toBe('0%');
    });

    it('should format percentage with specified decimals', () => {
      expect(formatPercent(33.333, 2)).toBe('33.33%');
      expect(formatPercent(66.6666, 1)).toBe('66.7%');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(500)).toBe('500 Bytes');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(2048)).toBe('2 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB');
    });

    it('should format gigabytes', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    });
  });

  describe('truncate', () => {
    it('should truncate long text', () => {
      expect(truncate('이것은 매우 긴 텍스트입니다', 10)).toBe('이것은 매우 ...');
    });

    it('should not truncate short text', () => {
      expect(truncate('짧은 텍스트', 20)).toBe('짧은 텍스트');
    });

    it('should return empty string for null/undefined', () => {
      expect(truncate(null, 10)).toBe('');
      expect(truncate(undefined, 10)).toBe('');
    });

    it('should handle exact length', () => {
      expect(truncate('12345', 5)).toBe('12345');
    });
  });

  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('world')).toBe('World');
    });

    it('should handle single character', () => {
      expect(capitalize('a')).toBe('A');
    });

    it('should handle already capitalized', () => {
      expect(capitalize('Hello')).toBe('Hello');
    });

    it('should return empty string for null/undefined', () => {
      expect(capitalize(null)).toBe('');
      expect(capitalize(undefined)).toBe('');
      expect(capitalize('')).toBe('');
    });
  });

  describe('padNumber', () => {
    it('should pad single digit numbers', () => {
      expect(padNumber(1)).toBe('01');
      expect(padNumber(9)).toBe('09');
    });

    it('should not pad double digit numbers', () => {
      expect(padNumber(10)).toBe('10');
      expect(padNumber(99)).toBe('99');
    });

    it('should pad to custom length', () => {
      expect(padNumber(1, 3)).toBe('001');
      expect(padNumber(12, 4)).toBe('0012');
    });
  });
});
