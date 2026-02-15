/**
 * UNIQN Mobile - JobPosting Schema Tests
 *
 * @description jobPosting.schema.ts Zod validation tests
 */

import {
  postingTypeSchema,
  salaryTypeSchema,
  roleSchema,
  roleRequirementSchema,
  salaryInfoSchema,
  allowancesSchema,
  basicInfoSchema,
  dateTimeSchema,
  createJobPostingSchema,
  jobFilterSchema,
  applicationMessageSchema,
  jobPostingDocumentSchema,
  parseJobPostingDocument,
  parseJobPostingDocuments,
  isJobPostingDocument,
} from '../jobPosting.schema';

// ============================================================================
// Mock Timestamp
// ============================================================================

const createMockTimestamp = (seconds = 1700000000, nanoseconds = 0) => ({
  seconds,
  nanoseconds,
  toDate: () => new Date(seconds * 1000),
  toMillis: () => seconds * 1000,
});

// ============================================================================
// postingTypeSchema
// ============================================================================

describe('postingTypeSchema', () => {
  it.each(['regular', 'fixed', 'tournament', 'urgent'])('should accept: %s', (type) => {
    expect(postingTypeSchema.safeParse(type).success).toBe(true);
  });

  it('should reject invalid type', () => {
    expect(postingTypeSchema.safeParse('part-time').success).toBe(false);
  });

  it('should reject empty string', () => {
    expect(postingTypeSchema.safeParse('').success).toBe(false);
  });
});

// ============================================================================
// salaryTypeSchema
// ============================================================================

describe('salaryTypeSchema', () => {
  it.each(['hourly', 'daily', 'monthly', 'other'])('should accept: %s', (type) => {
    expect(salaryTypeSchema.safeParse(type).success).toBe(true);
  });

  it('should reject invalid type', () => {
    expect(salaryTypeSchema.safeParse('yearly').success).toBe(false);
  });
});

// ============================================================================
// roleSchema
// ============================================================================

describe('roleSchema', () => {
  it.each(['dealer', 'floor', 'serving', 'manager', 'staff', 'other'])(
    'should accept: %s',
    (role) => {
      expect(roleSchema.safeParse(role).success).toBe(true);
    }
  );

  it('should reject invalid role', () => {
    expect(roleSchema.safeParse('chiprunner').success).toBe(false);
  });

  it('should reject legacy admin role', () => {
    expect(roleSchema.safeParse('admin').success).toBe(false);
  });
});

// ============================================================================
// roleRequirementSchema
// ============================================================================

describe('roleRequirementSchema', () => {
  it('should accept valid role requirement', () => {
    const result = roleRequirementSchema.safeParse({ role: 'dealer', count: 3 });
    expect(result.success).toBe(true);
  });

  it('should accept count of 1', () => {
    const result = roleRequirementSchema.safeParse({ role: 'manager', count: 1 });
    expect(result.success).toBe(true);
  });

  it('should accept count of 100', () => {
    const result = roleRequirementSchema.safeParse({ role: 'floor', count: 100 });
    expect(result.success).toBe(true);
  });

  it('should reject count of 0', () => {
    const result = roleRequirementSchema.safeParse({ role: 'dealer', count: 0 });
    expect(result.success).toBe(false);
  });

  it('should reject count over 100', () => {
    const result = roleRequirementSchema.safeParse({ role: 'dealer', count: 101 });
    expect(result.success).toBe(false);
  });

  it('should reject negative count', () => {
    const result = roleRequirementSchema.safeParse({ role: 'dealer', count: -1 });
    expect(result.success).toBe(false);
  });

  it('should reject invalid role', () => {
    const result = roleRequirementSchema.safeParse({ role: 'invalid', count: 2 });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// salaryInfoSchema
// ============================================================================

describe('salaryInfoSchema', () => {
  it('should accept valid salary info', () => {
    const result = salaryInfoSchema.safeParse({ type: 'daily', amount: 150000 });
    expect(result.success).toBe(true);
  });

  it('should accept zero amount', () => {
    const result = salaryInfoSchema.safeParse({ type: 'hourly', amount: 0 });
    expect(result.success).toBe(true);
  });

  it('should reject negative amount', () => {
    const result = salaryInfoSchema.safeParse({ type: 'daily', amount: -1 });
    expect(result.success).toBe(false);
  });

  it('should reject invalid salary type', () => {
    const result = salaryInfoSchema.safeParse({ type: 'yearly', amount: 50000 });
    expect(result.success).toBe(false);
  });

  it('should reject missing type', () => {
    const result = salaryInfoSchema.safeParse({ amount: 50000 });
    expect(result.success).toBe(false);
  });

  it('should reject missing amount', () => {
    const result = salaryInfoSchema.safeParse({ type: 'daily' });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// allowancesSchema
// ============================================================================

describe('allowancesSchema', () => {
  it('should accept undefined (optional)', () => {
    const result = allowancesSchema.safeParse(undefined);
    expect(result.success).toBe(true);
  });

  it('should accept empty object', () => {
    const result = allowancesSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept valid allowances', () => {
    const result = allowancesSchema.safeParse({
      guaranteedHours: 8,
      meal: 10000,
      transportation: 5000,
      accommodation: -1,
    });
    expect(result.success).toBe(true);
  });

  it('should accept -1 as provider flag', () => {
    const result = allowancesSchema.safeParse({ meal: -1 });
    expect(result.success).toBe(true);
  });

  it('should reject negative guaranteedHours', () => {
    const result = allowancesSchema.safeParse({ guaranteedHours: -1 });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// basicInfoSchema
// ============================================================================

describe('basicInfoSchema', () => {
  const validBasicInfo = {
    title: '딜러 모집',
    location: '서울 강남구',
    contactPhone: '010-1234-5678',
  };

  it('should accept valid basic info', () => {
    const result = basicInfoSchema.safeParse(validBasicInfo);
    expect(result.success).toBe(true);
  });

  it('should accept with optional fields', () => {
    const result = basicInfoSchema.safeParse({
      ...validBasicInfo,
      district: '강남구',
      detailedAddress: '테헤란로 123',
      description: '딜러를 모집합니다.',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty title', () => {
    const result = basicInfoSchema.safeParse({ ...validBasicInfo, title: '' });
    expect(result.success).toBe(false);
  });

  it('should reject title over 25 characters', () => {
    const result = basicInfoSchema.safeParse({
      ...validBasicInfo,
      title: 'x'.repeat(26),
    });
    expect(result.success).toBe(false);
  });

  it('should reject title with XSS pattern', () => {
    const result = basicInfoSchema.safeParse({
      ...validBasicInfo,
      title: '<script>alert("xss")</script>',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty location', () => {
    const result = basicInfoSchema.safeParse({ ...validBasicInfo, location: '' });
    expect(result.success).toBe(false);
  });

  it('should reject empty contactPhone', () => {
    const result = basicInfoSchema.safeParse({ ...validBasicInfo, contactPhone: '' });
    expect(result.success).toBe(false);
  });

  it('should reject contactPhone over 25 characters', () => {
    const result = basicInfoSchema.safeParse({
      ...validBasicInfo,
      contactPhone: '0'.repeat(26),
    });
    expect(result.success).toBe(false);
  });

  it('should reject description over 500 characters', () => {
    const result = basicInfoSchema.safeParse({
      ...validBasicInfo,
      description: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('should reject detailedAddress over 200 characters', () => {
    const result = basicInfoSchema.safeParse({
      ...validBasicInfo,
      detailedAddress: 'x'.repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it('should reject description with XSS pattern', () => {
    const result = basicInfoSchema.safeParse({
      ...validBasicInfo,
      description: 'Hello <script>alert(1)</script>',
    });
    expect(result.success).toBe(false);
  });

  it('should trim whitespace from title', () => {
    const result = basicInfoSchema.safeParse({
      ...validBasicInfo,
      title: '  딜러 모집  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('딜러 모집');
    }
  });
});

// ============================================================================
// dateTimeSchema
// ============================================================================

describe('dateTimeSchema', () => {
  it('should accept valid date and time', () => {
    const result = dateTimeSchema.safeParse({
      workDate: '2025-06-15',
      timeSlot: '09:00-18:00',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty workDate', () => {
    const result = dateTimeSchema.safeParse({ workDate: '', timeSlot: '09:00' });
    expect(result.success).toBe(false);
  });

  it('should reject invalid workDate format', () => {
    const result = dateTimeSchema.safeParse({ workDate: '06/15/2025', timeSlot: '09:00' });
    expect(result.success).toBe(false);
  });

  it('should reject empty timeSlot', () => {
    const result = dateTimeSchema.safeParse({ workDate: '2025-06-15', timeSlot: '' });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// createJobPostingSchema
// ============================================================================

describe('createJobPostingSchema', () => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const validData = {
    title: '딜러 모집',
    location: '서울',
    contactPhone: '010-1234-5678',
    workDate: tomorrowStr,
    timeSlot: '09:00-18:00',
    roles: [{ role: 'dealer' as const, count: 2 }],
    salary: { type: 'daily' as const, amount: 150000 },
  };

  it('should accept valid create data', () => {
    const result = createJobPostingSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should default postingType to regular', () => {
    const result = createJobPostingSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.postingType).toBe('regular');
    }
  });

  it('should default isUrgent to false', () => {
    const result = createJobPostingSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isUrgent).toBe(false);
    }
  });

  it('should accept with optional fields', () => {
    const result = createJobPostingSchema.safeParse({
      ...validData,
      postingType: 'fixed',
      isUrgent: false,
      tags: ['dealer', 'fulltime'],
      allowances: { guaranteedHours: 8, meal: 10000 },
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty roles array', () => {
    const result = createJobPostingSchema.safeParse({
      ...validData,
      roles: [],
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing salary', () => {
    const { salary, ...noSalary } = validData;
    const result = createJobPostingSchema.safeParse(noSalary);
    expect(result.success).toBe(false);
  });

  it('should reject urgent posting with date more than 7 days out', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const result = createJobPostingSchema.safeParse({
      ...validData,
      postingType: 'urgent',
      workDate: futureDateStr,
    });
    expect(result.success).toBe(false);
  });

  it('should accept urgent posting within 7 days', () => {
    const threeDaysLater = new Date();
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);
    const dateStr = threeDaysLater.toISOString().split('T')[0];

    const result = createJobPostingSchema.safeParse({
      ...validData,
      postingType: 'urgent',
      workDate: dateStr,
    });
    expect(result.success).toBe(true);
  });

  it('should reject urgent posting with past date', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    const pastDateStr = pastDate.toISOString().split('T')[0];

    const result = createJobPostingSchema.safeParse({
      ...validData,
      postingType: 'urgent',
      workDate: pastDateStr,
    });
    expect(result.success).toBe(false);
  });

  it('should allow non-urgent posting with any future date', () => {
    const farFuture = new Date();
    farFuture.setDate(farFuture.getDate() + 60);
    const dateStr = farFuture.toISOString().split('T')[0];

    const result = createJobPostingSchema.safeParse({
      ...validData,
      workDate: dateStr,
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// jobFilterSchema
// ============================================================================

describe('jobFilterSchema', () => {
  it('should accept empty object (all optional)', () => {
    const result = jobFilterSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept valid status filter', () => {
    const result = jobFilterSchema.safeParse({ status: 'active' });
    expect(result.success).toBe(true);
  });

  it('should accept valid roles filter', () => {
    const result = jobFilterSchema.safeParse({ roles: ['dealer', 'manager'] });
    expect(result.success).toBe(true);
  });

  it('should accept dateRange filter', () => {
    const result = jobFilterSchema.safeParse({
      dateRange: { start: '2025-01-01', end: '2025-12-31' },
    });
    expect(result.success).toBe(true);
  });

  it('should accept searchTerm filter', () => {
    const result = jobFilterSchema.safeParse({ searchTerm: '딜러' });
    expect(result.success).toBe(true);
  });

  it('should accept isUrgent filter', () => {
    const result = jobFilterSchema.safeParse({ isUrgent: true });
    expect(result.success).toBe(true);
  });

  it('should reject invalid status', () => {
    const result = jobFilterSchema.safeParse({ status: 'pending' });
    expect(result.success).toBe(false);
  });

  it('should reject invalid roles in array', () => {
    const result = jobFilterSchema.safeParse({ roles: ['invalid_role'] });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// applicationMessageSchema
// ============================================================================

describe('applicationMessageSchema', () => {
  it('should accept undefined (optional)', () => {
    const result = applicationMessageSchema.safeParse(undefined);
    expect(result.success).toBe(true);
  });

  it('should accept valid message', () => {
    const result = applicationMessageSchema.safeParse('안녕하세요, 지원합니다.');
    expect(result.success).toBe(true);
  });

  it('should accept empty string', () => {
    const result = applicationMessageSchema.safeParse('');
    expect(result.success).toBe(true);
  });

  it('should reject message over 200 characters', () => {
    const result = applicationMessageSchema.safeParse('x'.repeat(201));
    expect(result.success).toBe(false);
  });

  it('should reject XSS in message', () => {
    const result = applicationMessageSchema.safeParse('<script>alert(1)</script>');
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// jobPostingDocumentSchema
// ============================================================================

describe('jobPostingDocumentSchema', () => {
  const validDoc = {
    id: 'job-1',
    title: '딜러 모집',
    status: 'active' as const,
    location: { name: '서울' },
    workDate: '2025-06-15',
    timeSlot: '09:00-18:00',
    roles: [{ role: 'dealer', count: 2 }],
    totalPositions: 2,
    filledPositions: 0,
    ownerId: 'user-1',
    createdAt: createMockTimestamp(),
    updatedAt: createMockTimestamp(),
  };

  it('should accept valid document', () => {
    const result = jobPostingDocumentSchema.safeParse(validDoc);
    expect(result.success).toBe(true);
  });

  it('should accept with optional fields', () => {
    const result = jobPostingDocumentSchema.safeParse({
      ...validDoc,
      location: { name: '서울', district: '강남구' },
      detailedAddress: '테헤란로 123',
      contactPhone: '010-1234-5678',
      ownerName: '홍길동',
      postingType: 'tournament',
      isUrgent: true,
      viewCount: 50,
      applicationCount: 10,
    });
    expect(result.success).toBe(true);
  });

  it('should accept passthrough (unknown) fields', () => {
    const result = jobPostingDocumentSchema.safeParse({
      ...validDoc,
      customField: 'extra',
    });
    expect(result.success).toBe(true);
  });

  it('should accept roles with salary', () => {
    const result = jobPostingDocumentSchema.safeParse({
      ...validDoc,
      roles: [
        { role: 'dealer', count: 2, salary: { type: 'daily', amount: 150000 } },
        { role: 'manager', count: 1, filled: 0 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing id', () => {
    const { id, ...noId } = validDoc;
    const result = jobPostingDocumentSchema.safeParse(noId);
    expect(result.success).toBe(false);
  });

  it('should reject missing title', () => {
    const { title, ...noTitle } = validDoc;
    const result = jobPostingDocumentSchema.safeParse(noTitle);
    expect(result.success).toBe(false);
  });

  it('should reject invalid status', () => {
    const result = jobPostingDocumentSchema.safeParse({
      ...validDoc,
      status: 'pending',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing location', () => {
    const { location, ...noLocation } = validDoc;
    const result = jobPostingDocumentSchema.safeParse(noLocation);
    expect(result.success).toBe(false);
  });

  it('should reject missing workDate', () => {
    const { workDate, ...noWorkDate } = validDoc;
    const result = jobPostingDocumentSchema.safeParse(noWorkDate);
    expect(result.success).toBe(false);
  });

  it('should reject missing ownerId', () => {
    const { ownerId, ...noOwner } = validDoc;
    const result = jobPostingDocumentSchema.safeParse(noOwner);
    expect(result.success).toBe(false);
  });

  it('should reject invalid createdAt', () => {
    const result = jobPostingDocumentSchema.safeParse({
      ...validDoc,
      createdAt: 'not-a-timestamp',
    });
    expect(result.success).toBe(false);
  });

  it('should accept Date for timestamps', () => {
    const result = jobPostingDocumentSchema.safeParse({
      ...validDoc,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// parseJobPostingDocument
// ============================================================================

describe('parseJobPostingDocument', () => {
  const validDoc = {
    id: 'job-1',
    title: '모집',
    status: 'active',
    location: { name: '서울' },
    workDate: '2025-06-15',
    timeSlot: '09:00',
    roles: [{ role: 'dealer', count: 1 }],
    totalPositions: 1,
    filledPositions: 0,
    ownerId: 'user-1',
    createdAt: createMockTimestamp(),
    updatedAt: createMockTimestamp(),
  };

  it('should return parsed data for valid document', () => {
    const result = parseJobPostingDocument(validDoc);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('id', 'job-1');
  });

  it('should return null for invalid document', () => {
    const result = parseJobPostingDocument({ bad: 'data' });
    expect(result).toBeNull();
  });

  it('should return null for null input', () => {
    const result = parseJobPostingDocument(null);
    expect(result).toBeNull();
  });
});

// ============================================================================
// parseJobPostingDocuments
// ============================================================================

describe('parseJobPostingDocuments', () => {
  const validDoc = {
    id: 'job-1',
    title: '모집',
    status: 'active',
    location: { name: '서울' },
    workDate: '2025-06-15',
    timeSlot: '09:00',
    roles: [{ role: 'dealer', count: 1 }],
    totalPositions: 1,
    filledPositions: 0,
    ownerId: 'user-1',
    createdAt: createMockTimestamp(),
    updatedAt: createMockTimestamp(),
  };

  it('should parse valid documents and filter invalid ones', () => {
    const results = parseJobPostingDocuments([
      validDoc,
      { invalid: true },
      { ...validDoc, id: 'job-2' },
    ]);
    expect(results).toHaveLength(2);
  });

  it('should return empty array for empty input', () => {
    expect(parseJobPostingDocuments([])).toHaveLength(0);
  });
});

// ============================================================================
// isJobPostingDocument
// ============================================================================

describe('isJobPostingDocument', () => {
  const validDoc = {
    id: 'job-1',
    title: '모집',
    status: 'active',
    location: { name: '서울' },
    workDate: '2025-06-15',
    timeSlot: '09:00',
    roles: [{ role: 'dealer', count: 1 }],
    totalPositions: 1,
    filledPositions: 0,
    ownerId: 'user-1',
    createdAt: createMockTimestamp(),
    updatedAt: createMockTimestamp(),
  };

  it('should return true for valid document', () => {
    expect(isJobPostingDocument(validDoc)).toBe(true);
  });

  it('should return false for invalid document', () => {
    expect(isJobPostingDocument({ random: 'data' })).toBe(false);
  });

  it('should return false for null', () => {
    expect(isJobPostingDocument(null)).toBe(false);
  });
});
