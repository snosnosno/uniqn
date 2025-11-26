/**
 * CoreProviders - 핵심 Provider 그룹
 *
 * ErrorBoundary, Firebase, QueryClient, Theme, Auth를 하나의 그룹으로 묶어
 * Provider 중첩을 줄이고 Suspense 경계를 명확히 합니다.
 */
import React, { Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ErrorBoundary from '../errors/ErrorBoundary';
import FirebaseErrorBoundary from '../errors/FirebaseErrorBoundary';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { AuthProvider } from '../../contexts/AuthContext';
import LoadingSpinner from '../LoadingSpinner';

// QueryClient 인스턴스 (싱글톤)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5분
      gcTime: 10 * 60 * 1000, // 10분
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

interface CoreProvidersProps {
  children: React.ReactNode;
}

/**
 * 핵심 Provider 그룹
 * - ErrorBoundary: 전역 에러 처리
 * - FirebaseErrorBoundary: Firebase 특화 에러 처리
 * - QueryClientProvider: React Query 캐시
 * - ThemeProvider: 다크모드 지원
 * - AuthProvider: 인증 상태
 */
export const CoreProviders: React.FC<CoreProvidersProps> = ({ children }) => {
  return (
    <ErrorBoundary>
      <FirebaseErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </FirebaseErrorBoundary>
    </ErrorBoundary>
  );
};

export default CoreProviders;
