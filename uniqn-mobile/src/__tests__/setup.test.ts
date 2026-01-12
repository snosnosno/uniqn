/**
 * UNIQN Mobile - Setup Test
 *
 * @description Verifies that Jest is properly configured
 */

describe('Jest Setup', () => {
  it('should run a basic test', () => {
    expect(true).toBe(true);
  });

  it('should have access to global test utilities', () => {
    expect(global.testUtils).toBeDefined();
    expect(typeof global.testUtils.createMockUser).toBe('function');
    expect(typeof global.testUtils.createMockStaff).toBe('function');
    expect(typeof global.testUtils.createMockJobPosting).toBe('function');
  });

  it('should create mock user correctly', () => {
    const mockUser = global.testUtils.createMockUser({ displayName: 'Custom Name' });

    expect(mockUser.uid).toBe('test-user-id');
    expect(mockUser.displayName).toBe('Custom Name');
    expect(mockUser.email).toBe('test@example.com');
  });

  it('should create mock staff correctly', () => {
    const mockStaff = global.testUtils.createMockStaff({ name: '김철수' });

    expect(mockStaff.id).toBe('staff-id-1');
    expect(mockStaff.name).toBe('김철수');
    expect(mockStaff.role).toBe('staff');
  });

  it('should create mock job posting correctly', () => {
    const mockJob = global.testUtils.createMockJobPosting({
      defaultSalary: { type: 'daily', amount: 200000 },
    });

    expect(mockJob.id).toBe('job-id-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((mockJob as any).defaultSalary.amount).toBe(200000);
    expect(mockJob.status).toBe('active');
  });
});
