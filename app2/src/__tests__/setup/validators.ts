/**
 * Validation Helpers for Test Data
 *
 * Helper functions to validate mock data structures conform to expected schemas.
 * Used in tests to verify data integrity and catch schema issues early.
 */

// ========================================
// Type Definitions (matching data-model.md)
// ========================================

interface Notification {
  id: string;
  userId: string;
  type: 'system' | 'work' | 'schedule' | 'finance' | 'application';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  data?: Record<string, unknown>;
}

interface WorkLog {
  id: string;
  staffId: string;
  eventId: string;
  date: string;
  startTime: string;
  endTime: string;
  hourlyRate: number;
  isNightShift?: boolean;
  isHoliday?: boolean;
  isOvertime?: boolean;
  totalPay?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Applicant {
  id: string;
  eventId: string;
  userId?: string;
  name: string;
  phoneNumber: string;
  email?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  appliedAt: Date;
  processedAt?: Date;
  processedBy?: string;
  notes?: string;
}

// ========================================
// 1. Notification Validators
// ========================================

/**
 * Validate Notification structure
 * @param notif - Notification object to validate
 * @returns true if valid, false otherwise
 */
export const validateNotification = (notif: any): notif is Notification => {
  if (!notif || typeof notif !== 'object') return false;

  return (
    typeof notif.id === 'string' &&
    notif.id.length > 0 &&
    typeof notif.userId === 'string' &&
    notif.userId.length > 0 &&
    ['system', 'work', 'schedule', 'finance', 'application'].includes(notif.type) &&
    typeof notif.title === 'string' &&
    typeof notif.message === 'string' &&
    notif.message.length > 0 &&
    typeof notif.isRead === 'boolean' &&
    notif.createdAt instanceof Date
  );
};

/**
 * Validate array of Notifications
 * @param notifications - Array to validate
 * @returns true if all valid, false otherwise
 */
export const validateNotifications = (notifications: any[]): notifications is Notification[] => {
  return Array.isArray(notifications) && notifications.every(validateNotification);
};

// ========================================
// 2. WorkLog Validators
// ========================================

/**
 * Validate WorkLog structure
 * @param log - WorkLog object to validate
 * @returns true if valid, false otherwise
 */
export const validateWorkLog = (log: any): log is WorkLog => {
  if (!log || typeof log !== 'object') return false;

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const timeRegex = /^\d{2}:\d{2}$/;

  return (
    typeof log.id === 'string' &&
    log.id.length > 0 &&
    typeof log.staffId === 'string' &&
    log.staffId.length > 0 &&
    typeof log.eventId === 'string' &&
    log.eventId.length > 0 &&
    dateRegex.test(log.date) &&
    timeRegex.test(log.startTime) &&
    timeRegex.test(log.endTime) &&
    typeof log.hourlyRate === 'number' &&
    log.hourlyRate > 0 &&
    log.createdAt instanceof Date &&
    log.updatedAt instanceof Date
  );
};

/**
 * Validate WorkLog time range (end must be after start)
 * @param log - WorkLog object
 * @returns true if time range valid
 */
export const validateWorkLogTimeRange = (log: WorkLog): boolean => {
  const [startHour, startMinute] = log.startTime.split(':').map(Number);
  const [endHour, endMinute] = log.endTime.split(':').map(Number);

  if (startHour === undefined || startMinute === undefined || endHour === undefined || endMinute === undefined) {
    return false;
  }

  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  // Allow overnight shifts (endTime < startTime means next day)
  return endMinutes !== startMinutes;
};

/**
 * Validate array of WorkLogs
 * @param workLogs - Array to validate
 * @returns true if all valid, false otherwise
 */
export const validateWorkLogs = (workLogs: any[]): workLogs is WorkLog[] => {
  return Array.isArray(workLogs) && workLogs.every(validateWorkLog);
};

// ========================================
// 3. Applicant Validators
// ========================================

/**
 * Validate Applicant structure
 * @param applicant - Applicant object to validate
 * @returns true if valid, false otherwise
 */
export const validateApplicant = (applicant: any): applicant is Applicant => {
  if (!applicant || typeof applicant !== 'object') return false;

  const phoneRegex = /^010-\d{4}-\d{4}$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const basicValid =
    typeof applicant.id === 'string' &&
    applicant.id.length > 0 &&
    typeof applicant.eventId === 'string' &&
    applicant.eventId.length > 0 &&
    typeof applicant.name === 'string' &&
    applicant.name.length > 0 &&
    phoneRegex.test(applicant.phoneNumber) &&
    ['pending', 'approved', 'rejected', 'cancelled'].includes(applicant.status) &&
    applicant.appliedAt instanceof Date;

  // Validate email if present
  if (applicant.email && !emailRegex.test(applicant.email)) {
    return false;
  }

  return basicValid;
};

/**
 * Validate Applicant state transition
 * @param applicant - Applicant object
 * @returns true if state is valid
 */
export const validateApplicantState = (applicant: Applicant): boolean => {
  // If processed (approved/rejected), must have processedAt and processedBy
  if (applicant.status === 'approved' || applicant.status === 'rejected') {
    return !!(applicant.processedAt && applicant.processedBy);
  }

  // Pending and cancelled don't require processedBy
  return true;
};

/**
 * Validate array of Applicants
 * @param applicants - Array to validate
 * @returns true if all valid, false otherwise
 */
export const validateApplicants = (applicants: any[]): applicants is Applicant[] => {
  return Array.isArray(applicants) && applicants.every(validateApplicant);
};

// ========================================
// 4. Composite Validators
// ========================================

/**
 * Validate all test data structures
 * @param data - Object with notifications, workLogs, applicants
 * @returns true if all valid
 */
export const validateAllTestData = (data: {
  notifications?: any[];
  workLogs?: any[];
  applicants?: any[];
}): boolean => {
  const notificationsValid = !data.notifications || validateNotifications(data.notifications);
  const workLogsValid = !data.workLogs || validateWorkLogs(data.workLogs);
  const applicantsValid = !data.applicants || validateApplicants(data.applicants);

  return notificationsValid && workLogsValid && applicantsValid;
};

/**
 * Get validation errors for debugging
 * @param data - Data to validate
 * @returns Array of error messages
 */
export const getValidationErrors = (data: any): string[] => {
  const errors: string[] = [];

  if (data.notifications && !validateNotifications(data.notifications)) {
    errors.push('Invalid notifications array');
  }

  if (data.workLogs && !validateWorkLogs(data.workLogs)) {
    errors.push('Invalid workLogs array');
  }

  if (data.applicants && !validateApplicants(data.applicants)) {
    errors.push('Invalid applicants array');
  }

  return errors;
};
