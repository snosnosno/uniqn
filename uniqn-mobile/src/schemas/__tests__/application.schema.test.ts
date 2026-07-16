import {
  applicationDocumentSchema,
  confirmApplicationSchema,
  parseApplicationDocument,
} from '../application.schema';

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
  applicantName: 'Applicant',
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

    // Task 4: timestampSchema는 ISO string을 반환함
    expect(typeof parsed.originalApplication?.appliedAt).toBe('string');
    expect(typeof parsed.confirmationHistory?.[0]?.confirmedAt).toBe('string');
    expect(typeof parsed.confirmationHistory?.[0]?.cancelledAt).toBe('string');
    // 각 값은 유효한 ISO 8601 날짜 문자열이어야 함
    expect(new Date(parsed.originalApplication!.appliedAt!).toString()).not.toBe('Invalid Date');
    expect(new Date(parsed.confirmationHistory![0]!.confirmedAt).toString()).not.toBe(
      'Invalid Date'
    );
    expect(new Date(parsed.confirmationHistory![0]!.cancelledAt!).toString()).not.toBe(
      'Invalid Date'
    );
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
        reason: 'Schedule changed',
        rejectionReason: 'Replacement unavailable',
      },
    });

    expect(parsed.cancellationRequest?.requestedAt).toBe('2025-01-02T10:00:00.000Z');

    if (parsed.cancellationRequest?.status !== 'rejected') {
      throw new Error('Expected rejected cancellation request');
    }

    // Task 4: timestampSchema는 ISO string을 반환함 (Firebase-shaped 입력 → ISO string)
    const reviewedAt = parsed.cancellationRequest.reviewedAt;
    expect(typeof reviewedAt).toBe('string');
    expect(new Date(reviewedAt).toString()).not.toBe('Invalid Date');
  });

  it('accepts custom assignment role ids and preserves customRole metadata', () => {
    const result = parseApplicationDocument({
      ...baseDocument,
      applicantRole: 'other',
      customRole: 'MC',
      assignments: [
        {
          ...baseAssignment,
          roleIds: ['MC'],
        },
      ],
    });

    expect(result).not.toBeNull();
    expect(result?.assignments[0]?.roleIds).toEqual(['MC']);
    expect(result?.customRole).toBe('MC');
  });

  it('normalizes legacy null notes into undefined', () => {
    const result = parseApplicationDocument({
      ...baseDocument,
      notes: null,
    });

    expect(result).not.toBeNull();
    expect(result?.notes).toBeUndefined();
  });
});

describe('confirmApplicationSchema', () => {
  it('trims valid notes', () => {
    const parsed = confirmApplicationSchema.parse({
      applicationId: 'application-1',
      notes: '  confirmed memo  ',
    });

    expect(parsed.notes).toBe('confirmed memo');
  });

  it('rejects unsafe notes', () => {
    const result = confirmApplicationSchema.safeParse({
      applicationId: 'application-1',
      notes: '<script>alert(1)</script>',
    });

    expect(result.success).toBe(false);
  });
});

describe('assignment.duration 재배선 (A2 회귀 — 오배선 시 {}로 증발·재기록되던 결함)', () => {
  const durationValue = {
    type: 'consecutive' as const,
    startDate: '2025-01-09',
    endDate: '2025-01-11',
  };

  it('AssignmentDuration 실데이터가 파싱 후 그대로 보존된다 (왕복 무손실)', () => {
    const result = parseApplicationDocument({
      ...baseDocument,
      assignments: [{ ...baseAssignment, duration: durationValue }],
    });

    expect(result).not.toBeNull();
    expect(result?.assignments?.[0]?.duration).toEqual(durationValue);
  });

  it('과거 오배선으로 오염된 {} duration은 흡수하고 지원서 레코드는 증발시키지 않는다', () => {
    const result = parseApplicationDocument({
      ...baseDocument,
      assignments: [{ ...baseAssignment, duration: {} }],
    });

    expect(result).not.toBeNull();
    expect(result?.assignments?.[0]?.duration).toBeUndefined();
  });

  it('duration 부재/null 도 레코드를 증발시키지 않는다', () => {
    const absent = parseApplicationDocument({
      ...baseDocument,
      assignments: [baseAssignment],
    });
    const nullish = parseApplicationDocument({
      ...baseDocument,
      assignments: [{ ...baseAssignment, duration: null }],
    });

    expect(absent).not.toBeNull();
    expect(nullish).not.toBeNull();
  });

  it('중첩 이력(originalApplication/confirmationHistory)의 duration도 보존된다', () => {
    const result = parseApplicationDocument({
      ...baseDocument,
      originalApplication: {
        assignments: [{ ...baseAssignment, duration: durationValue }],
      },
      confirmationHistory: [
        {
          confirmedAt: { seconds: 1735776000, nanoseconds: 0 },
          assignments: [{ ...baseAssignment, duration: durationValue }],
        },
      ],
    });

    expect(result?.originalApplication?.assignments?.[0]?.duration).toEqual(durationValue);
    expect(result?.confirmationHistory?.[0]?.assignments?.[0]?.duration).toEqual(durationValue);
  });
});
