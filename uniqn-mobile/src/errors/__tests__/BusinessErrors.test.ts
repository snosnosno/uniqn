/**
 * BusinessErrors 클래스 단위 테스트
 */

import { AppError, ERROR_CODES } from '../AppError';
import {
  AlreadyAppliedError,
  ApplicationClosedError,
  MaxCapacityReachedError,
  AlreadyCheckedInError,
  NotCheckedInError,
  InvalidQRCodeError,
  ExpiredQRCodeError,
  QRSecurityMismatchError,
  QRWrongEventError,
  QRWrongDateError,
  AlreadySettledError,
  InvalidWorkLogError,
  DuplicateReportError,
  ReportNotFoundError,
  ReportAlreadyReviewedError,
  CannotReportSelfError,
  isAlreadyAppliedError,
  isApplicationClosedError,
  isMaxCapacityReachedError,
  isAlreadyCheckedInError,
  isNotCheckedInError,
  isInvalidQRCodeError,
  isExpiredQRCodeError,
  isQRSecurityMismatchError,
  isQRWrongEventError,
  isQRWrongDateError,
  isAlreadySettledError,
  isInvalidWorkLogError,
  isDuplicateReportError,
  isReportNotFoundError,
  isReportAlreadyReviewedError,
  isCannotReportSelfError,
} from '../BusinessErrors';

describe('지원 관련 에러', () => {
  describe('AlreadyAppliedError', () => {
    it('올바른 에러 코드를 가져야 한다', () => {
      const error = new AlreadyAppliedError();
      expect(error.code).toBe(ERROR_CODES.BUSINESS_ALREADY_APPLIED);
    });

    it('category가 business이어야 한다', () => {
      const error = new AlreadyAppliedError();
      expect(error.category).toBe('business');
    });

    it('isRetryable이 false이어야 한다', () => {
      const error = new AlreadyAppliedError();
      expect(error.isRetryable).toBe(false);
    });

    it('metadata에 jobPostingId와 applicationId를 저장해야 한다', () => {
      const error = new AlreadyAppliedError({
        jobPostingId: 'job-123',
        applicationId: 'app-456',
      });
      expect(error.metadata).toEqual({
        jobPostingId: 'job-123',
        applicationId: 'app-456',
      });
    });

    it('name이 AlreadyAppliedError이어야 한다', () => {
      const error = new AlreadyAppliedError();
      expect(error.name).toBe('AlreadyAppliedError');
    });

    it('프로토타입 체인이 유지되어야 한다', () => {
      const error = new AlreadyAppliedError();
      expect(error instanceof Error).toBe(true);
      expect(error instanceof AppError).toBe(true);
      expect(error instanceof AlreadyAppliedError).toBe(true);
    });
  });

  describe('ApplicationClosedError', () => {
    it('올바른 에러 코드를 가져야 한다', () => {
      const error = new ApplicationClosedError();
      expect(error.code).toBe(ERROR_CODES.BUSINESS_APPLICATION_CLOSED);
    });

    it('metadata에 closedAt을 저장해야 한다', () => {
      const closedAt = new Date();
      const error = new ApplicationClosedError({ closedAt });
      expect(error.metadata?.closedAt).toBe(closedAt);
    });

    it('name이 ApplicationClosedError이어야 한다', () => {
      const error = new ApplicationClosedError();
      expect(error.name).toBe('ApplicationClosedError');
    });
  });

  describe('MaxCapacityReachedError', () => {
    it('올바른 에러 코드를 가져야 한다', () => {
      const error = new MaxCapacityReachedError();
      expect(error.code).toBe(ERROR_CODES.BUSINESS_MAX_CAPACITY_REACHED);
    });

    it('metadata에 maxCapacity와 currentCount를 저장해야 한다', () => {
      const error = new MaxCapacityReachedError({
        maxCapacity: 10,
        currentCount: 10,
      });
      expect(error.metadata).toEqual({
        jobPostingId: undefined,
        maxCapacity: 10,
        currentCount: 10,
      });
    });

    it('name이 MaxCapacityReachedError이어야 한다', () => {
      const error = new MaxCapacityReachedError();
      expect(error.name).toBe('MaxCapacityReachedError');
    });
  });
});

describe('출퇴근 관련 에러', () => {
  describe('AlreadyCheckedInError', () => {
    it('올바른 에러 코드를 가져야 한다', () => {
      const error = new AlreadyCheckedInError();
      expect(error.code).toBe(ERROR_CODES.BUSINESS_ALREADY_CHECKED_IN);
    });

    it('metadata에 workLogId와 checkedInAt을 저장해야 한다', () => {
      const checkedInAt = new Date();
      const error = new AlreadyCheckedInError({
        workLogId: 'wl-123',
        checkedInAt,
      });
      expect(error.metadata?.workLogId).toBe('wl-123');
      expect(error.metadata?.checkedInAt).toBe(checkedInAt);
    });

    it('name이 AlreadyCheckedInError이어야 한다', () => {
      const error = new AlreadyCheckedInError();
      expect(error.name).toBe('AlreadyCheckedInError');
    });
  });

  describe('NotCheckedInError', () => {
    it('올바른 에러 코드를 가져야 한다', () => {
      const error = new NotCheckedInError();
      expect(error.code).toBe(ERROR_CODES.BUSINESS_NOT_CHECKED_IN);
    });

    it('name이 NotCheckedInError이어야 한다', () => {
      const error = new NotCheckedInError();
      expect(error.name).toBe('NotCheckedInError');
    });
  });

  describe('InvalidQRCodeError', () => {
    it('올바른 에러 코드를 가져야 한다', () => {
      const error = new InvalidQRCodeError();
      expect(error.code).toBe(ERROR_CODES.BUSINESS_INVALID_QR);
    });

    it('isRetryable이 true이어야 한다 (QR 재스캔 가능)', () => {
      const error = new InvalidQRCodeError();
      expect(error.isRetryable).toBe(true);
    });

    it('metadata에 qrData를 저장해야 한다', () => {
      const error = new InvalidQRCodeError({ qrData: 'invalid-qr-data' });
      expect(error.metadata?.qrData).toBe('invalid-qr-data');
    });

    it('name이 InvalidQRCodeError이어야 한다', () => {
      const error = new InvalidQRCodeError();
      expect(error.name).toBe('InvalidQRCodeError');
    });
  });

  describe('ExpiredQRCodeError', () => {
    it('올바른 에러 코드를 가져야 한다', () => {
      const error = new ExpiredQRCodeError();
      expect(error.code).toBe(ERROR_CODES.BUSINESS_EXPIRED_QR);
    });

    it('isRetryable이 true이어야 한다 (새 QR로 재시도 가능)', () => {
      const error = new ExpiredQRCodeError();
      expect(error.isRetryable).toBe(true);
    });

    it('metadata에 expiredAt을 저장해야 한다', () => {
      const expiredAt = new Date();
      const error = new ExpiredQRCodeError({ expiredAt });
      expect(error.metadata?.expiredAt).toBe(expiredAt);
    });

    it('name이 ExpiredQRCodeError이어야 한다', () => {
      const error = new ExpiredQRCodeError();
      expect(error.name).toBe('ExpiredQRCodeError');
    });
  });

  describe('QRSecurityMismatchError', () => {
    it('올바른 에러 코드를 가져야 한다', () => {
      const error = new QRSecurityMismatchError();
      expect(error.code).toBe(ERROR_CODES.BUSINESS_QR_SECURITY_MISMATCH);
    });

    it('severity가 medium이어야 한다 (보안 관련)', () => {
      const error = new QRSecurityMismatchError();
      expect(error.severity).toBe('medium');
    });

    it('isRetryable이 true이어야 한다', () => {
      const error = new QRSecurityMismatchError();
      expect(error.isRetryable).toBe(true);
    });

    it('name이 QRSecurityMismatchError이어야 한다', () => {
      const error = new QRSecurityMismatchError();
      expect(error.name).toBe('QRSecurityMismatchError');
    });
  });

  describe('QRWrongEventError', () => {
    it('올바른 에러 코드를 가져야 한다', () => {
      const error = new QRWrongEventError();
      expect(error.code).toBe(ERROR_CODES.BUSINESS_QR_WRONG_EVENT);
    });

    it('isRetryable이 true이어야 한다', () => {
      const error = new QRWrongEventError();
      expect(error.isRetryable).toBe(true);
    });

    it('metadata에 expectedEventId와 actualEventId를 저장해야 한다', () => {
      const error = new QRWrongEventError({
        expectedEventId: 'event-123',
        actualEventId: 'event-456',
      });
      expect(error.metadata?.expectedEventId).toBe('event-123');
      expect(error.metadata?.actualEventId).toBe('event-456');
    });

    it('name이 QRWrongEventError이어야 한다', () => {
      const error = new QRWrongEventError();
      expect(error.name).toBe('QRWrongEventError');
    });
  });

  describe('QRWrongDateError', () => {
    it('올바른 에러 코드를 가져야 한다', () => {
      const error = new QRWrongDateError();
      expect(error.code).toBe(ERROR_CODES.BUSINESS_QR_WRONG_DATE);
    });

    it('isRetryable이 true이어야 한다', () => {
      const error = new QRWrongDateError();
      expect(error.isRetryable).toBe(true);
    });

    it('metadata에 expectedDate와 actualDate를 저장해야 한다', () => {
      const error = new QRWrongDateError({
        expectedDate: '2025-01-01',
        actualDate: '2025-01-02',
      });
      expect(error.metadata?.expectedDate).toBe('2025-01-01');
      expect(error.metadata?.actualDate).toBe('2025-01-02');
    });

    it('name이 QRWrongDateError이어야 한다', () => {
      const error = new QRWrongDateError();
      expect(error.name).toBe('QRWrongDateError');
    });
  });
});

describe('정산 관련 에러', () => {
  describe('AlreadySettledError', () => {
    it('올바른 에러 코드를 가져야 한다', () => {
      const error = new AlreadySettledError();
      expect(error.code).toBe(ERROR_CODES.BUSINESS_ALREADY_SETTLED);
    });

    it('isRetryable이 false이어야 한다', () => {
      const error = new AlreadySettledError();
      expect(error.isRetryable).toBe(false);
    });

    it('metadata에 workLogId와 settledAt을 저장해야 한다', () => {
      const settledAt = new Date();
      const error = new AlreadySettledError({
        workLogId: 'wl-123',
        settledAt,
      });
      expect(error.metadata?.workLogId).toBe('wl-123');
      expect(error.metadata?.settledAt).toBe(settledAt);
    });

    it('name이 AlreadySettledError이어야 한다', () => {
      const error = new AlreadySettledError();
      expect(error.name).toBe('AlreadySettledError');
    });
  });

  describe('InvalidWorkLogError', () => {
    it('올바른 에러 코드를 가져야 한다', () => {
      const error = new InvalidWorkLogError();
      expect(error.code).toBe(ERROR_CODES.BUSINESS_INVALID_WORKLOG);
    });

    it('isRetryable이 false이어야 한다', () => {
      const error = new InvalidWorkLogError();
      expect(error.isRetryable).toBe(false);
    });

    it('metadata에 workLogId와 reason을 저장해야 한다', () => {
      const error = new InvalidWorkLogError({
        workLogId: 'wl-123',
        reason: '출근 시간이 없음',
      });
      expect(error.metadata?.workLogId).toBe('wl-123');
      expect(error.metadata?.reason).toBe('출근 시간이 없음');
    });

    it('name이 InvalidWorkLogError이어야 한다', () => {
      const error = new InvalidWorkLogError();
      expect(error.name).toBe('InvalidWorkLogError');
    });
  });
});

describe('신고 관련 에러', () => {
  describe('DuplicateReportError', () => {
    it('올바른 에러 코드를 가져야 한다', () => {
      const error = new DuplicateReportError();
      expect(error.code).toBe(ERROR_CODES.BUSINESS_DUPLICATE_REPORT);
    });

    it('isRetryable이 false이어야 한다', () => {
      const error = new DuplicateReportError();
      expect(error.isRetryable).toBe(false);
    });

    it('metadata에 targetId와 jobPostingId를 저장해야 한다', () => {
      const error = new DuplicateReportError({
        targetId: 'user-123',
        jobPostingId: 'job-456',
      });
      expect(error.metadata?.targetId).toBe('user-123');
      expect(error.metadata?.jobPostingId).toBe('job-456');
    });

    it('name이 DuplicateReportError이어야 한다', () => {
      const error = new DuplicateReportError();
      expect(error.name).toBe('DuplicateReportError');
    });
  });

  describe('ReportNotFoundError', () => {
    it('올바른 에러 코드를 가져야 한다', () => {
      const error = new ReportNotFoundError();
      expect(error.code).toBe(ERROR_CODES.BUSINESS_REPORT_NOT_FOUND);
    });

    it('metadata에 reportId를 저장해야 한다', () => {
      const error = new ReportNotFoundError({ reportId: 'report-123' });
      expect(error.metadata?.reportId).toBe('report-123');
    });

    it('name이 ReportNotFoundError이어야 한다', () => {
      const error = new ReportNotFoundError();
      expect(error.name).toBe('ReportNotFoundError');
    });
  });

  describe('ReportAlreadyReviewedError', () => {
    it('올바른 에러 코드를 가져야 한다', () => {
      const error = new ReportAlreadyReviewedError();
      expect(error.code).toBe(ERROR_CODES.BUSINESS_REPORT_ALREADY_REVIEWED);
    });

    it('metadata에 reportId와 currentStatus를 저장해야 한다', () => {
      const error = new ReportAlreadyReviewedError({
        reportId: 'report-123',
        currentStatus: 'resolved',
      });
      expect(error.metadata?.reportId).toBe('report-123');
      expect(error.metadata?.currentStatus).toBe('resolved');
    });

    it('name이 ReportAlreadyReviewedError이어야 한다', () => {
      const error = new ReportAlreadyReviewedError();
      expect(error.name).toBe('ReportAlreadyReviewedError');
    });
  });

  describe('CannotReportSelfError', () => {
    it('올바른 에러 코드를 가져야 한다', () => {
      const error = new CannotReportSelfError();
      expect(error.code).toBe(ERROR_CODES.BUSINESS_CANNOT_REPORT_SELF);
    });

    it('isRetryable이 false이어야 한다', () => {
      const error = new CannotReportSelfError();
      expect(error.isRetryable).toBe(false);
    });

    it('name이 CannotReportSelfError이어야 한다', () => {
      const error = new CannotReportSelfError();
      expect(error.name).toBe('CannotReportSelfError');
    });
  });
});

describe('Type Guards', () => {
  const errors = [
    { Error: AlreadyAppliedError, guard: isAlreadyAppliedError, name: 'isAlreadyAppliedError' },
    { Error: ApplicationClosedError, guard: isApplicationClosedError, name: 'isApplicationClosedError' },
    { Error: MaxCapacityReachedError, guard: isMaxCapacityReachedError, name: 'isMaxCapacityReachedError' },
    { Error: AlreadyCheckedInError, guard: isAlreadyCheckedInError, name: 'isAlreadyCheckedInError' },
    { Error: NotCheckedInError, guard: isNotCheckedInError, name: 'isNotCheckedInError' },
    { Error: InvalidQRCodeError, guard: isInvalidQRCodeError, name: 'isInvalidQRCodeError' },
    { Error: ExpiredQRCodeError, guard: isExpiredQRCodeError, name: 'isExpiredQRCodeError' },
    { Error: QRSecurityMismatchError, guard: isQRSecurityMismatchError, name: 'isQRSecurityMismatchError' },
    { Error: QRWrongEventError, guard: isQRWrongEventError, name: 'isQRWrongEventError' },
    { Error: QRWrongDateError, guard: isQRWrongDateError, name: 'isQRWrongDateError' },
    { Error: AlreadySettledError, guard: isAlreadySettledError, name: 'isAlreadySettledError' },
    { Error: InvalidWorkLogError, guard: isInvalidWorkLogError, name: 'isInvalidWorkLogError' },
    { Error: DuplicateReportError, guard: isDuplicateReportError, name: 'isDuplicateReportError' },
    { Error: ReportNotFoundError, guard: isReportNotFoundError, name: 'isReportNotFoundError' },
    { Error: ReportAlreadyReviewedError, guard: isReportAlreadyReviewedError, name: 'isReportAlreadyReviewedError' },
    { Error: CannotReportSelfError, guard: isCannotReportSelfError, name: 'isCannotReportSelfError' },
  ];

  describe.each(errors)('$name', ({ Error: ErrorClass, guard }) => {
    it('해당 에러 인스턴스에 대해 true를 반환해야 한다', () => {
      const error = new ErrorClass();
      expect(guard(error)).toBe(true);
    });

    it('다른 에러 타입에 대해 false를 반환해야 한다', () => {
      const otherError = new Error('다른 에러');
      expect(guard(otherError)).toBe(false);
    });

    it('null에 대해 false를 반환해야 한다', () => {
      expect(guard(null)).toBe(false);
    });

    it('undefined에 대해 false를 반환해야 한다', () => {
      expect(guard(undefined)).toBe(false);
    });
  });
});
