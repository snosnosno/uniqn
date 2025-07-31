// 테스트 유틸리티 함수
import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { JobPostingProvider } from '../../contexts/JobPostingContext';
import { TournamentProvider } from '../../contexts/TournamentContext';
import type { User } from '../../contexts/AuthContext';

// 모킹된 사용자 데이터
export const mockUser: User = {
  uid: 'test-user-id',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: null,
  emailVerified: true,
  isAnonymous: false,
  metadata: {} as any,
  providerData: [],
  refreshToken: '',
  tenantId: null,
  delete: async () => {},
  getIdToken: async () => '',
  getIdTokenResult: async () => ({} as any),
  reload: async () => {},
  toJSON: () => ({}),
  phoneNumber: null,
  providerId: 'firebase',
  region: 'kr'
};

// 모킹된 Auth Context 값
export const mockAuthContextValue = {
  currentUser: mockUser,
  loading: false,
  isAdmin: true,
  role: 'admin',
  signOut: vi.fn(),
  signIn: vi.fn(),
  sendPasswordReset: vi.fn(),
  signInWithGoogle: vi.fn()
};

// 커스텀 렌더러 옵션
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  authValue?: any;
  initialRoute?: string;
}

// 테스트용 Provider Wrapper
const AllTheProviders = ({ children, authValue }: { children: React.ReactNode; authValue?: any }) => {
  return (
    <BrowserRouter>
      <AuthContext.Provider value={authValue || mockAuthContextValue}>
        <ToastProvider>
          <JobPostingProvider>
            <TournamentProvider>
              {children}
            </TournamentProvider>
          </JobPostingProvider>
        </ToastProvider>
      </AuthContext.Provider>
    </BrowserRouter>
  );
};

// 커스텀 render 함수
export const customRender = (
  ui: ReactElement,
  options?: CustomRenderOptions
) => {
  const { authValue, ...renderOptions } = options || {};
  
  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders authValue={authValue}>
        {children}
      </AllTheProviders>
    ),
    ...renderOptions
  });
};

// 날짜 모킹 헬퍼
export const mockDate = (dateString: string) => {
  const RealDate = Date;
  global.Date = class extends RealDate {
    constructor(...args: any[]) {
      if (args.length === 0) {
        super(dateString);
      } else {
        super(...args);
      }
    }
    
    static now() {
      return new RealDate(dateString).getTime();
    }
  } as any;
};

// 비동기 작업 대기 헬퍼
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));

// Firebase Timestamp 모킹 헬퍼
export const mockTimestamp = (date: Date) => ({
  toDate: () => date,
  seconds: Math.floor(date.getTime() / 1000),
  nanoseconds: 0
});

// re-export testing library
export * from '@testing-library/react';
export { customRender as render };