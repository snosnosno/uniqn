/**
 * UNIQN Mobile - Global Test Types
 *
 * @description TypeScript declarations for global test utilities
 */

interface MockUser {
  uid: string;
  email: string;
  displayName: string;
  phoneNumber: string;
  [key: string]: unknown;
}

interface MockStaff {
  id: string;
  userId: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

interface MockJobPosting {
  id: string;
  title: string;
  description: string;
  location: string;
  salary: number;
  date: string;
  status: string;
  createdAt: string;
  [key: string]: unknown;
}

interface TestUtils {
  flushPromises: () => Promise<void>;
  createMockUser: (overrides?: Partial<MockUser>) => MockUser;
  createMockStaff: (overrides?: Partial<MockStaff>) => MockStaff;
  createMockJobPosting: (overrides?: Partial<MockJobPosting>) => MockJobPosting;
}

declare global {
  // eslint-disable-next-line no-var
  var testUtils: TestUtils;
}

export {};
