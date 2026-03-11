/**
 * Global Test Utilities
 *
 * @description 테스트에서 공통으로 사용하는 헬퍼 함수 및 mock 데이터 팩토리
 */

module.exports = {
  // Wait for async operations
  flushPromises: () => new Promise((resolve) => setImmediate(resolve)),

  // Create mock user
  createMockUser: (overrides = {}) => ({
    uid: 'test-user-id',
    email: 'test@example.com',
    displayName: 'Test User',
    phoneNumber: '+821012345678',
    ...overrides,
  }),

  // Create mock staff
  createMockStaff: (overrides = {}) => ({
    id: 'staff-id-1',
    userId: 'test-user-id',
    name: '테스트 스태프',
    role: 'staff',
    email: 'staff@example.com',
    phone: '010-1234-5678',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }),

  // Create mock job posting (v2.0 - roles[].salary 구조)
  createMockJobPosting: (overrides = {}) => ({
    id: 'job-id-1',
    title: '테스트 공고',
    description: '테스트 설명',
    location: '서울',
    defaultSalary: { type: 'daily', amount: 150000 },
    roles: [{ role: 'dealer', count: 2, salary: { type: 'daily', amount: 150000 } }],
    date: new Date().toISOString(),
    status: 'active',
    createdAt: new Date().toISOString(),
    ...overrides,
  }),
};
