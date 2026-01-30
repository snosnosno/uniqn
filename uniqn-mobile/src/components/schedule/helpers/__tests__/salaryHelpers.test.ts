/**
 * UNIQN Mobile - ScheduleCard salaryHelpers Tests
 *
 * @description Unit tests for salary calculation helpers
 * @version 1.0.0
 */

import {
  getRoleSalaryFromCard,
  formatSalaryDisplay,
} from '../salaryHelpers';
import type { JobPostingCard } from '@/types';
import type { SalaryInfo } from '@/utils/settlement';

// ============================================================================
// Mock Data
// ============================================================================

const createMockJobPostingCard = (overrides?: Partial<JobPostingCard>): JobPostingCard => ({
  id: 'job-1',
  title: 'Test Job',
  location: 'Seoul',
  status: 'active',
  ...overrides,
} as JobPostingCard);

// ============================================================================
// getRoleSalaryFromCard Tests
// ============================================================================

describe('getRoleSalaryFromCard', () => {
  it('should return undefined for undefined card', () => {
    expect(getRoleSalaryFromCard(undefined, '2024-01-15', 'dealer')).toBeUndefined();
  });

  it('should return undefined for card without dateRequirements', () => {
    const card = createMockJobPostingCard({ dateRequirements: undefined });
    expect(getRoleSalaryFromCard(card, '2024-01-15', 'dealer')).toBeUndefined();
  });

  it('should return undefined for non-matching date', () => {
    const card = createMockJobPostingCard({
      dateRequirements: [
        {
          date: '2024-01-16',
          timeSlots: [
            {
              startTime: '09:00',
              roles: [
                { role: 'dealer', count: 2, filled: 0, salary: { type: 'hourly', amount: 15000 } },
              ],
            },
          ],
        },
      ],
    });
    expect(getRoleSalaryFromCard(card, '2024-01-15', 'dealer')).toBeUndefined();
  });

  it('should return salary for matching date and role', () => {
    const expectedSalary: SalaryInfo = { type: 'hourly', amount: 15000 };
    const card = createMockJobPostingCard({
      dateRequirements: [
        {
          date: '2024-01-15',
          timeSlots: [
            {
              startTime: '09:00',
              roles: [
                { role: 'dealer', count: 2, filled: 0, salary: expectedSalary },
              ],
            },
          ],
        },
      ],
    });
    expect(getRoleSalaryFromCard(card, '2024-01-15', 'dealer')).toEqual(expectedSalary);
  });

  it('should return undefined for non-matching role', () => {
    const card = createMockJobPostingCard({
      dateRequirements: [
        {
          date: '2024-01-15',
          timeSlots: [
            {
              startTime: '09:00',
              roles: [
                { role: 'dealer', count: 2, filled: 0, salary: { type: 'hourly', amount: 15000 } },
              ],
            },
          ],
        },
      ],
    });
    expect(getRoleSalaryFromCard(card, '2024-01-15', 'floor')).toBeUndefined();
  });

  it('should match custom role when role is "other"', () => {
    const expectedSalary: SalaryInfo = { type: 'daily', amount: 200000 };
    const card = createMockJobPostingCard({
      dateRequirements: [
        {
          date: '2024-01-15',
          timeSlots: [
            {
              startTime: '09:00',
              roles: [
                { role: 'other', customRole: '매니저', count: 1, filled: 0, salary: expectedSalary },
              ],
            },
          ],
        },
      ],
    });
    expect(getRoleSalaryFromCard(card, '2024-01-15', 'other', '매니저')).toEqual(expectedSalary);
  });

  it('should search through multiple time slots', () => {
    const expectedSalary: SalaryInfo = { type: 'hourly', amount: 18000 };
    const card = createMockJobPostingCard({
      dateRequirements: [
        {
          date: '2024-01-15',
          timeSlots: [
            {
              startTime: '09:00',
              roles: [
                { role: 'dealer', count: 2, filled: 0, salary: { type: 'hourly', amount: 15000 } },
              ],
            },
            {
              startTime: '14:00',
              roles: [
                { role: 'floor', count: 3, filled: 0, salary: expectedSalary },
              ],
            },
          ],
        },
      ],
    });
    expect(getRoleSalaryFromCard(card, '2024-01-15', 'floor')).toEqual(expectedSalary);
  });
});

// ============================================================================
// formatSalaryDisplay Tests
// ============================================================================

describe('formatSalaryDisplay', () => {
  it('should return null for undefined salary', () => {
    expect(formatSalaryDisplay(undefined)).toBeNull();
  });

  it('should format hourly salary', () => {
    expect(formatSalaryDisplay({ type: 'hourly', amount: 15000 })).toBe('시급 15,000원');
  });

  it('should format daily salary', () => {
    expect(formatSalaryDisplay({ type: 'daily', amount: 150000 })).toBe('일급 150,000원');
  });

  it('should format monthly salary', () => {
    expect(formatSalaryDisplay({ type: 'monthly', amount: 3000000 })).toBe('월급 3,000,000원');
  });

  it('should return "협의" for other type', () => {
    expect(formatSalaryDisplay({ type: 'other', amount: 0 })).toBe('협의');
  });

  it('should handle large amounts', () => {
    expect(formatSalaryDisplay({ type: 'monthly', amount: 10000000 })).toBe('월급 10,000,000원');
  });
});
