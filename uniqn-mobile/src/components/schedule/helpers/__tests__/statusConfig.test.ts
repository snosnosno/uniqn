/**
 * UNIQN Mobile - ScheduleCard statusConfig Tests
 *
 * @description Unit tests for status configuration
 * @version 1.0.0
 */

import { statusConfig, attendanceConfig } from '../statusConfig';

// ============================================================================
// statusConfig Tests
// ============================================================================

describe('statusConfig', () => {
  it('should have all schedule types defined', () => {
    expect(statusConfig).toHaveProperty('applied');
    expect(statusConfig).toHaveProperty('confirmed');
    expect(statusConfig).toHaveProperty('completed');
    expect(statusConfig).toHaveProperty('cancelled');
  });

  it('should have correct labels for each status', () => {
    expect(statusConfig.applied.label).toBe('지원 중');
    expect(statusConfig.confirmed.label).toBe('확정');
    expect(statusConfig.completed.label).toBe('완료');
    expect(statusConfig.cancelled.label).toBe('취소');
  });

  it('should have correct variants for each status', () => {
    expect(statusConfig.applied.variant).toBe('warning');
    expect(statusConfig.confirmed.variant).toBe('success');
    expect(statusConfig.completed.variant).toBe('default');
    expect(statusConfig.cancelled.variant).toBe('error');
  });

  it('should have valid Badge variants', () => {
    const validVariants = ['warning', 'success', 'default', 'error', 'primary', 'secondary'];
    Object.values(statusConfig).forEach((config) => {
      expect(validVariants).toContain(config.variant);
    });
  });
});

// ============================================================================
// attendanceConfig Tests
// ============================================================================

describe('attendanceConfig', () => {
  it('should have all attendance statuses defined', () => {
    expect(attendanceConfig).toHaveProperty('not_started');
    expect(attendanceConfig).toHaveProperty('checked_in');
    expect(attendanceConfig).toHaveProperty('checked_out');
  });

  it('should have correct labels for each attendance status', () => {
    expect(attendanceConfig.not_started.label).toBe('출근 전');
    expect(attendanceConfig.checked_in.label).toBe('근무 중');
    expect(attendanceConfig.checked_out.label).toBe('퇴근 완료');
  });

  it('should have background colors with dark mode variants', () => {
    Object.values(attendanceConfig).forEach((config) => {
      expect(config.bgColor).toMatch(/^bg-/);
      expect(config.bgColor).toContain('dark:');
    });
  });

  it('should have text colors with dark mode variants', () => {
    Object.values(attendanceConfig).forEach((config) => {
      expect(config.textColor).toMatch(/^text-/);
      expect(config.textColor).toContain('dark:');
    });
  });

  it('should have appropriate colors for each status', () => {
    // not_started: gray
    expect(attendanceConfig.not_started.bgColor).toContain('gray');
    expect(attendanceConfig.not_started.textColor).toContain('gray');

    // checked_in: green (working)
    expect(attendanceConfig.checked_in.bgColor).toContain('green');
    expect(attendanceConfig.checked_in.textColor).toContain('green');

    // checked_out: blue (completed)
    expect(attendanceConfig.checked_out.bgColor).toContain('blue');
    expect(attendanceConfig.checked_out.textColor).toContain('blue');
  });
});
