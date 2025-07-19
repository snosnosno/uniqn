import { render, RenderOptions } from '@testing-library/react';
import React from 'react';
import { I18nextProvider } from 'react-i18next';
import { BrowserRouter } from 'react-router-dom';

import { AuthProvider } from '../../contexts/AuthContext';
import { JobPostingProvider } from '../../contexts/JobPostingContext';
import { ToastProvider } from '../../contexts/ToastContext';
import i18n from '../../i18n';

// 테스트용 커스텀 렌더러
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string;
  withAuth?: boolean;
  withToast?: boolean;
  withJobPosting?: boolean;
}

const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <BrowserRouter>
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <ToastProvider>
            <JobPostingProvider jobPostingId="test-job-id">
              {children}
            </JobPostingProvider>
          </ToastProvider>
        </AuthProvider>
      </I18nextProvider>
    </BrowserRouter>
  );
};

const customRender = (
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
) => {
  const {
    route = '/',
    withAuth = true,
    withToast = true,
    withJobPosting = true,
    ...renderOptions
  } = options;

  // 라우트 설정
  window.history.pushState({}, 'Test page', route);

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    let content = children;

    if (withJobPosting) {
      content = <JobPostingProvider jobPostingId="test-job-id">{content}</JobPostingProvider>;
    }

    if (withToast) {
      content = <ToastProvider>{content}</ToastProvider>;
    }

    if (withAuth) {
      content = <AuthProvider>{content}</AuthProvider>;
    }

    return (
      <BrowserRouter>
        <I18nextProvider i18n={i18n}>
          {content}
        </I18nextProvider>
      </BrowserRouter>
    );
  };

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Firebase 모킹 유틸리티
export const mockFirebase = {
  auth: {
    currentUser: {
      uid: 'test-user-id',
      email: 'test@example.com',
      displayName: 'Test User'
    },
    onAuthStateChanged: jest.fn(),
    signOut: jest.fn()
  },
  firestore: {
    collection: jest.fn(),
    doc: jest.fn(),
    addDoc: jest.fn(),
    updateDoc: jest.fn(),
    deleteDoc: jest.fn(),
    getDocs: jest.fn(),
    getDoc: jest.fn(),
    onSnapshot: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn()
  },
  functions: {
    httpsCallable: jest.fn()
  }
};

// 테스트 데이터 팩토리
export const createTestJobPosting = (overrides = {}) => ({
  id: 'test-job-id',
  title: 'Test Job Posting',
  description: 'Test description',
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-02'),
  status: 'active',
  position: 'dealer',
  salary: 50000,
  createdBy: 'test-user-id',
  createdAt: new Date(),
  applicationDeadline: new Date('2025-01-01'),
  ...overrides
});

export const createTestUser = (overrides = {}) => ({
  uid: 'test-user-id',
  email: 'test@example.com',
  displayName: 'Test User',
  role: 'staff',
  photoURL: null,
  ...overrides
});

export const createTestStaff = (overrides = {}) => ({
  id: 'test-staff-id',
  name: 'Test Staff',
  role: 'dealer',
  email: 'staff@example.com',
  photoURL: null,
  status: 'active',
  assignedTableId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

// 비동기 작업 대기 유틸리티
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 에러 경계 테스트 유틸리티
export const createErrorComponent = (error: Error) => {
  const ErrorComponent = () => {
    throw error;
  };
  return ErrorComponent;
};

// 스냅샷 테스트 유틸리티
export const createSnapshotTest = (Component: React.ComponentType<any>, props = {}) => {
  it('should match snapshot', () => {
    const { container } = customRender(<Component {...props} />);
    expect(container).toMatchSnapshot();
  });
};

// 사용자 상호작용 시뮬레이션 유틸리티
export const simulateUserInteraction = {
  click: (element: HTMLElement) => {
    element.click();
  },
  type: (element: HTMLInputElement, value: string) => {
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  },
  change: (element: HTMLSelectElement, value: string) => {
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }
};

// 성능 테스트 유틸리티
export const measurePerformance = async (fn: () => void | Promise<void>) => {
  const start = performance.now();
  await fn();
  const end = performance.now();
  return end - start;
};

// 재내보내기
export * from '@testing-library/react';
export { customRender as render }; 