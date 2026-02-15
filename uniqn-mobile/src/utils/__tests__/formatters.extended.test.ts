/**
 * UNIQN Mobile - Formatters Extended Tests
 *
 * @description 기존 formatters.test.ts에서 커버하지 않는 함수들의 테스트
 * formatRole, formatRoles, formatSalaryType, formatSalary, formatJobStatus
 */

import {
  formatRole,
  formatRoles,
  formatSalaryType,
  formatSalary,
  formatJobStatus,
} from '../formatters';

describe('Formatters (Extended Coverage)', () => {
  // ==========================================================================
  // formatRole
  // ==========================================================================
  describe('formatRole', () => {
    it('should return display name for known staff roles', () => {
      expect(formatRole('dealer')).toBe('딜러');
      expect(formatRole('floor')).toBe('플로어');
      expect(formatRole('serving')).toBe('서빙');
      expect(formatRole('manager')).toBe('매니저');
      expect(formatRole('supervisor')).toBe('슈퍼바이저');
      expect(formatRole('other')).toBe('기타');
    });

    it('should return display name for user roles', () => {
      expect(formatRole('admin')).toBe('관리자');
      expect(formatRole('employer')).toBe('구인자');
      expect(formatRole('staff')).toBe('일반');
    });

    it('should return empty string for undefined/empty', () => {
      expect(formatRole(undefined)).toBe('');
      expect(formatRole('')).toBe('');
    });

    it('should handle unknown role strings gracefully', () => {
      // getRoleDisplayName returns the role as-is if not found
      const result = formatRole('unknown_role');
      expect(typeof result).toBe('string');
    });
  });

  // ==========================================================================
  // formatRoles
  // ==========================================================================
  describe('formatRoles', () => {
    it('should format array of roles as comma-separated string', () => {
      const result = formatRoles(['dealer', 'floor']);
      expect(result).toBe('딜러, 플로어');
    });

    it('should handle single role array', () => {
      const result = formatRoles(['dealer']);
      expect(result).toBe('딜러');
    });

    it('should return empty string for empty array', () => {
      expect(formatRoles([])).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(formatRoles(undefined)).toBe('');
    });
  });

  // ==========================================================================
  // formatSalaryType
  // ==========================================================================
  describe('formatSalaryType', () => {
    it('should return Korean label for known salary types', () => {
      expect(formatSalaryType('hourly')).toBe('시급');
      expect(formatSalaryType('daily')).toBe('일급');
      expect(formatSalaryType('monthly')).toBe('월급');
      expect(formatSalaryType('other')).toBe('협의');
    });

    it('should return original string for unknown types', () => {
      expect(formatSalaryType('custom_type')).toBe('custom_type');
    });

    it('should return empty string for undefined/empty', () => {
      expect(formatSalaryType(undefined)).toBe('');
      expect(formatSalaryType('')).toBe('');
    });
  });

  // ==========================================================================
  // formatSalary
  // ==========================================================================
  describe('formatSalary', () => {
    it('should format salary type + amount', () => {
      expect(formatSalary('hourly', 15000)).toBe('시급 15,000원');
      expect(formatSalary('daily', 150000)).toBe('일급 150,000원');
      expect(formatSalary('monthly', 3000000)).toBe('월급 3,000,000원');
    });

    it('should format zero amount', () => {
      expect(formatSalary('hourly', 0)).toBe('시급 0원');
    });
  });

  // ==========================================================================
  // formatJobStatus
  // ==========================================================================
  describe('formatJobStatus', () => {
    it('should return Korean label for known statuses', () => {
      expect(formatJobStatus('active')).toBe('모집중');
      expect(formatJobStatus('closed')).toBe('마감');
      expect(formatJobStatus('cancelled')).toBe('취소됨');
    });

    it('should return original string for unknown statuses', () => {
      expect(formatJobStatus('unknown_status')).toBe('unknown_status');
    });

    it('should return empty string for undefined/empty', () => {
      expect(formatJobStatus(undefined)).toBe('');
      expect(formatJobStatus('')).toBe('');
    });
  });
});
