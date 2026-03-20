import { applicationDocumentSchema, parseApplicationDocument } from '../application.schema';

const createMockTimestamp = (seconds = 1735689600, nanoseconds = 0) => ({
  seconds,
  nanoseconds,
  toDate: () => new Date(seconds * 1000),
  toMillis: () => seconds * 1000,
});

const baseAssignment = {
  roleIds: ['dealer'],
  timeSlot: '09:00',
  dates: ['2025-01-10'],
  isGrouped: false,
};

const baseDocument = {
  id: 'application-1',
  jobPostingId: 'posting-1',
  applicantId: 'applicant-1',
  applicantName: '홍길동',
  status: 'applied' as const,
  assignments: [baseAssignment],
  createdAt: createMockTimestamp(),
  updatedAt: createMockTimestamp(),
};

describe('applicationDocumentSchema', () => {
  it('normalizes nested application history timestamps', () => {
    const parsed = applicationDocumentSchema.parse({
      ...baseDocument,
      originalApplication: {
        assignments: [baseAssignment],
        appliedAt: { seconds: 1735689600, nanoseconds: 0 },
      },
      confirmationHistory: [
        {
          confirmedAt: { seconds: 1735776000, nanoseconds: 0 },
          cancelledAt: { seconds: 1735862400, nanoseconds: 0 },
          assignments: [baseAssignment],
        },
      ],
    });

    expect(parsed.originalApplication?.appliedAt?.toDate()).toBeInstanceOf(Date);
    expect(parsed.confirmationHistory?.[0]?.confirmedAt.toDate()).toBeInstanceOf(Date);
    expect(parsed.confirmationHistory?.[0]?.cancelledAt?.toDate()).toBeInstanceOf(Date);
  });

  it('keeps legacy originalApplication data when appliedAt is missing', () => {
    const result = parseApplicationDocument({
      ...baseDocument,
      originalApplication: {
        assignments: [baseAssignment],
      },
    });

    expect(result).not.toBeNull();
    expect(result?.originalApplication?.assignments).toEqual([baseAssignment]);
    expect(result?.originalApplication?.appliedAt).toBeUndefined();
  });

  it('rejects invalid nested timestamps instead of leaking raw values to the UI', () => {
    const result = parseApplicationDocument({
      ...baseDocument,
      confirmationHistory: [
        {
          confirmedAt: 'invalid-date',
          assignments: [baseAssignment],
        },
      ],
    });

    expect(result).toBeNull();
  });

  it('accepts cancellation request timestamps from both legacy strings and Firestore timestamps', () => {
    const parsed = applicationDocumentSchema.parse({
      ...baseDocument,
      status: 'cancellation_pending',
      cancellationRequest: {
        status: 'rejected',
        requestedAt: '2025-01-02T10:00:00.000Z',
        reviewedAt: createMockTimestamp(1735862400),
        reviewedBy: 'owner-1',
        reason: '일정 변경',
        rejectionReason: '대체 인력 없음',
      },
    });

    expect(parsed.cancellationRequest?.requestedAt).toBe('2025-01-02T10:00:00.000Z');

    if (parsed.cancellationRequest?.status !== 'rejected') {
      throw new Error('Expected rejected cancellation request');
    }

    const reviewedAt = parsed.cancellationRequest.reviewedAt;
    if (typeof reviewedAt === 'string') {
      throw new Error('Expected reviewedAt to be a Timestamp-like value');
    }

    expect(reviewedAt.toDate()).toBeInstanceOf(Date);
  });
});
