/**
 * DateUtils Contracts
 *
 * Centralized date formatting utilities
 * Replaces 29 duplicated patterns across 20 files
 *
 * @module contracts/dateUtils
 * @see app2/src/utils/dateUtils.ts (implementation)
 */

/**
 * Supported date formats
 */
export type DateFormat = 'date' | 'datetime';

/**
 * Date input types (flexible input handling)
 */
export type DateInput = Date | string | null | undefined;

/**
 * Date utility function contracts
 */
export interface DateUtilsModule {
  /**
   * Format date to specified format
   *
   * @param date - Date to format
   * @param format - 'date' (YYYY-MM-DD) or 'datetime' (YYYY-MM-DD HH:mm)
   * @returns Formatted date string or null on error
   *
   * @example
   * formatDate(new Date(), 'date'); // "2025-11-20"
   * formatDate(new Date(), 'datetime'); // "2025-11-20 14:30"
   * formatDate(null, 'date'); // null
   * formatDate('invalid', 'date'); // null (logger warning)
   */
  formatDate(date: DateInput, format: DateFormat): string | null;

  /**
   * Convert date to ISO date string (YYYY-MM-DD)
   *
   * Replaces: new Date().toISOString().split('T')[0]
   *
   * @param date - Date to convert
   * @returns ISO date string or null on error
   *
   * @example
   * toISODateString(new Date()); // "2025-11-20"
   * toISODateString("2025-11-20T15:30:00Z"); // "2025-11-20"
   * toISODateString(null); // null
   */
  toISODateString(date: DateInput): string | null;

  /**
   * Parse date string to Date object
   *
   * @param dateString - Date string to parse
   * @returns Date object or null on error
   *
   * @example
   * parseDate("2025-11-20"); // Date(2025-11-20T00:00:00Z)
   * parseDate("invalid"); // null (logger warning)
   * parseDate(null); // null
   */
  parseDate(dateString: string | null | undefined): Date | null;

  /**
   * Validate date (Type Guard)
   *
   * @param date - Value to validate
   * @returns True if valid Date object
   *
   * @example
   * isValidDate(new Date()); // true
   * isValidDate(new Date('invalid')); // false
   * isValidDate(null); // false
   * isValidDate('2025-11-20'); // false (string, not Date)
   */
  isValidDate(date: unknown): date is Date;
}

/**
 * Date formatting options
 */
export interface DateFormatOptions {
  /**
   * Date format type
   */
  format: DateFormat;

  /**
   * Include leading zeros
   * @default true
   */
  padZeros?: boolean;

  /**
   * Timezone (currently assumes UTC)
   * @default "UTC"
   */
  timezone?: string;
}

/**
 * Error handling strategy (from Clarification #1)
 */
export interface DateUtilsErrorHandling {
  /**
   * Return null on error (no exceptions thrown)
   */
  returnValue: null;

  /**
   * Log warning using logger.warn()
   */
  logLevel: 'warn';

  /**
   * Never throw exceptions (app crash prevention)
   */
  throwException: false;
}

/**
 * Migration guide: Before → After
 */
export interface DateUtilsMigrationPattern {
  /**
   * Before: Duplicated pattern (29 usages)
   * @example new Date().toISOString().split('T')[0]
   */
  before: string;

  /**
   * After: Utility function
   * @example toISODateString(new Date())
   */
  after: string;

  /**
   * Files to migrate (20 files)
   */
  targetFiles: string[];

  /**
   * Expected reduction: 29 usages → 0 usages
   */
  reduction: '100%';
}
