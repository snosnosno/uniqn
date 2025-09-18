/**
 * 테스트 헬퍼 유틸리티
 * 공통 테스트 기능 및 모킹 유틸리티
 */

import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { ReactElement } from 'react';

import { AuthProvider } from '../contexts/AuthContext';
import { UnifiedDataProvider } from '../contexts/UnifiedDataContext';
import { TournamentProvider } from '../contexts/TournamentContextAdapter';

// React Query 테스트 클라이언트
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
    mutations: {
      retry: false,
    },
  },
});

// 테스트용 Wrapper 컴포넌트
interface TestWrapperProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
}

const TestWrapper: React.FC<TestWrapperProps> = ({
  children,
  queryClient = createTestQueryClient()
}) => {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <UnifiedDataProvider>
            <TournamentProvider>
              {children}
            </TournamentProvider>
          </UnifiedDataProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

// 커스텀 render 함수
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
}

export const renderWithProviders = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { queryClient, ...renderOptions } = options;

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <TestWrapper queryClient={queryClient}>
      {children}
    </TestWrapper>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Firebase Auth 모킹
export const mockFirebaseAuth = {
  currentUser: null,
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
};

// Firebase Firestore 모킹
export const mockFirestore = {
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn(),
  writeBatch: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
    fromDate: jest.fn((date: Date) => ({ seconds: date.getTime() / 1000, nanoseconds: 0 })),
  },
};

// 테스트용 사용자 데이터
export const mockUsers = {
  admin: {
    uid: 'admin-test-id',
    email: 'admin@test.com',
    displayName: '관리자',
    isAdmin: true,
  },
  staff: {
    uid: 'staff-test-id',
    email: 'staff@test.com',
    displayName: '스태프',
    isAdmin: false,
  },
  applicant: {
    uid: 'applicant-test-id',
    email: 'applicant@test.com',
    displayName: '지원자',
    isAdmin: false,
  },
};

// 테스트용 구인공고 데이터
export const mockJobPosting = {
  id: 'job-test-id',
  title: '테스트 구인공고',
  location: 'seoul',
  date: '2025-01-20',
  startTime: '18:00',
  endTime: '23:00',
  roles: ['dealer'],
  maxStaff: 5,
  hourlyWage: 30000,
  description: '테스트용 구인공고입니다.',
  status: 'active',
  createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
  creatorId: 'admin-test-id',
  eventId: 'job-test-id',
};

// 테스트용 지원서 데이터
export const mockApplication = {
  id: 'application-test-id',
  eventId: 'job-test-id',
  applicantId: 'applicant-test-id',
  applicantEmail: 'applicant@test.com',
  applicantName: '지원자',
  status: 'pending',
  appliedAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
  coverLetter: '테스트 지원서입니다.',
};

// 테스트용 출석 기록 데이터
export const mockAttendanceRecord = {
  id: 'attendance-test-id',
  staffId: 'staff-test-id',
  date: '2025-01-20',
  status: 'present',
  checkInTime: '18:00',
  checkOutTime: '23:00',
  notes: '',
  createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
};

// 로컬스토리지 모킹
export const mockLocalStorage = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    length: Object.keys(store).length,
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

// Window 객체 모킹
export const mockWindow = {
  location: {
    href: 'http://localhost:3000',
    pathname: '/',
    search: '',
    hash: '',
    assign: jest.fn(),
    reload: jest.fn(),
    replace: jest.fn(),
  },
  history: {
    pushState: jest.fn(),
    replaceState: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    go: jest.fn(),
  },
  navigator: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    language: 'ko-KR',
    geolocation: {
      getCurrentPosition: jest.fn(),
      watchPosition: jest.fn(),
      clearWatch: jest.fn(),
    },
  },
  alert: jest.fn(),
  confirm: jest.fn(() => true),
  prompt: jest.fn(() => 'test'),
  open: jest.fn(),
  close: jest.fn(),
};

// 비동기 작업 대기 헬퍼
export const waitForAsync = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

// 에러 경계 테스트 헬퍼
export const throwError = (message = 'Test error') => {
  throw new Error(message);
};

// 폼 데이터 생성 헬퍼
export const createFormData = (data: Record<string, string | File>) => {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value);
  });
  return formData;
};

// 날짜 형식 헬퍼
export const formatDateForTest = (date: Date) => {
  return date.toISOString().split('T')[0];
};

// 시간 형식 헬퍼
export const formatTimeForTest = (date: Date) => {
  return date.toTimeString().slice(0, 5);
};

// 무작위 문자열 생성
export const generateRandomString = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// 무작위 이메일 생성
export const generateRandomEmail = (domain = 'test.com') => {
  return `${generateRandomString(8)}@${domain}`;
};

// 테스트 에러 로그 억제
export const suppressConsoleError = () => {
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });
};

// 테스트 경고 로그 억제
export const suppressConsoleWarn = () => {
  const originalWarn = console.warn;
  beforeAll(() => {
    console.warn = jest.fn();
  });
  afterAll(() => {
    console.warn = originalWarn;
  });
};

// React Query 캐시 클리어
export const clearQueryCache = (queryClient: QueryClient) => {
  queryClient.clear();
};

// 환경 변수 모킹
export const mockEnvVars = (envVars: Record<string, string>) => {
  const originalEnv = process.env;
  beforeAll(() => {
    process.env = { ...originalEnv, ...envVars };
  });
  afterAll(() => {
    process.env = originalEnv;
  });
};

// 타이머 모킹 헬퍼
export const mockTimers = () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });
  afterAll(() => {
    jest.useRealTimers();
  });
};

// 네트워크 요청 모킹
export const mockFetch = (mockResponse: any, status = 200) => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(mockResponse),
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
    } as Response)
  );
};

// Intersection Observer 모킹
export const mockIntersectionObserver = () => {
  global.IntersectionObserver = jest.fn(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
    root: null,
    rootMargin: '',
    thresholds: [],
  })) as any;
};

// ResizeObserver 모킹
export const mockResizeObserver = () => {
  global.ResizeObserver = jest.fn(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  })) as any;
};

// 파일 업로드 모킹
export const createMockFile = (name = 'test.jpg', type = 'image/jpeg', size = 1024) => {
  const file = new File(['test content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

// 클립보드 API 모킹
export const mockClipboard = () => {
  const mockClipboard = {
    writeText: jest.fn(() => Promise.resolve()),
    readText: jest.fn(() => Promise.resolve('test content')),
  };

  Object.assign(navigator, {
    clipboard: mockClipboard,
  });

  return mockClipboard;
};

// 지오로케이션 API 모킹
export const mockGeolocation = () => {
  const mockGeolocation = {
    getCurrentPosition: jest.fn((success) =>
      success({
        coords: {
          latitude: 37.5665,
          longitude: 126.9780,
          accuracy: 10,
        },
      })
    ),
    watchPosition: jest.fn(),
    clearWatch: jest.fn(),
  };

  Object.assign(navigator, {
    geolocation: mockGeolocation,
  });

  return mockGeolocation;
};

export default {
  renderWithProviders,
  mockFirebaseAuth,
  mockFirestore,
  mockUsers,
  mockJobPosting,
  mockApplication,
  mockAttendanceRecord,
  mockLocalStorage,
  mockWindow,
  waitForAsync,
  throwError,
  createFormData,
  formatDateForTest,
  formatTimeForTest,
  generateRandomString,
  generateRandomEmail,
  suppressConsoleError,
  suppressConsoleWarn,
  clearQueryCache,
  mockEnvVars,
  mockTimers,
  mockFetch,
  mockIntersectionObserver,
  mockResizeObserver,
  createMockFile,
  mockClipboard,
  mockGeolocation,
};