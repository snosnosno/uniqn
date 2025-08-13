import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../utils/logger';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: ErrorInfo, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'page' | 'section' | 'component';
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

/**
 * 향상된 에러 바운더리 컴포넌트
 * - 에러 로깅 및 리포팅
 * - 에러 복구 메커니즘
 * - 사용자 친화적인 에러 메시지
 * - 개발/프로덕션 환경별 다른 표시
 */
class EnhancedErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      errorCount: 0,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, componentName, level = 'component' } = this.props;
    
    // 에러 로깅
    logger.error(`ErrorBoundary caught error in ${componentName || 'Unknown Component'}`, error, {
      component: 'EnhancedErrorBoundary',
      operation: `errorBoundary-${level}`,
      data: {
        componentName,
        componentStack: errorInfo.componentStack,
        errorBoundary: level,
        timestamp: new Date().toISOString(),
      }
    });

    // 에러 카운트 증가
    this.setState(prevState => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // 커스텀 에러 핸들러 호출
    if (onError) {
      onError(error, errorInfo);
    }

    // Sentry로 에러 리포팅 (프로덕션 환경)
    if (process.env.NODE_ENV === 'production' && window.Sentry) {
      window.Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
            componentName,
            level,
          },
        },
      });
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    });
  };

  render() {
    const { hasError, error, errorInfo, errorCount } = this.state;
    const { children, fallback, level = 'component' } = this.props;

    if (hasError && error) {
      // 커스텀 fallback이 제공된 경우
      if (fallback) {
        return <>{fallback(error, errorInfo!, this.handleReset)}</>;
      }

      // 에러 발생 횟수가 3번 이상이면 더 간단한 에러 메시지 표시
      if (errorCount >= 3) {
        return (
          <div className="min-h-[200px] flex items-center justify-center p-8">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                반복적인 오류가 발생했습니다
              </h2>
              <p className="text-gray-600 mb-4">
                페이지를 새로고침 해주세요.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                페이지 새로고침
              </button>
            </div>
          </div>
        );
      }

      // 레벨별 다른 에러 UI 표시
      const errorUI = {
        page: (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
              <div className="text-center">
                <svg
                  className="mx-auto h-12 w-12 text-red-500 mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  페이지 오류
                </h1>
                <p className="text-gray-600 mb-6">
                  예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
                </p>
                {process.env.NODE_ENV === 'development' && (
                  <details className="text-left mb-4">
                    <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                      오류 상세 정보
                    </summary>
                    <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto">
                      {error.toString()}
                      {errorInfo && errorInfo.componentStack}
                    </pre>
                  </details>
                )}
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={this.handleReset}
                    className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                  >
                    다시 시도
                  </button>
                  <button
                    onClick={() => window.history.back()}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    뒤로 가기
                  </button>
                </div>
              </div>
            </div>
          </div>
        ),
        section: (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 my-4">
            <div className="flex items-start">
              <svg
                className="h-5 w-5 text-red-400 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-red-800">
                  섹션 로딩 오류
                </h3>
                <p className="mt-1 text-sm text-red-700">
                  이 섹션을 불러오는 중 문제가 발생했습니다.
                </p>
                {process.env.NODE_ENV === 'development' && (
                  <p className="mt-2 text-xs text-red-600">
                    {error.message}
                  </p>
                )}
                <button
                  onClick={this.handleReset}
                  className="mt-3 text-sm font-medium text-red-600 hover:text-red-500"
                >
                  다시 불러오기 →
                </button>
              </div>
            </div>
          </div>
        ),
        component: (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
            <div className="flex items-center">
              <svg
                className="h-4 w-4 text-yellow-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="ml-3 flex-1">
                <p className="text-sm text-yellow-700">
                  컴포넌트 로딩 실패
                </p>
                {process.env.NODE_ENV === 'development' && (
                  <p className="text-xs text-yellow-600 mt-1">
                    {error.message}
                  </p>
                )}
              </div>
              <button
                onClick={this.handleReset}
                className="ml-3 text-sm text-yellow-600 hover:text-yellow-500"
              >
                재시도
              </button>
            </div>
          </div>
        ),
      };

      return errorUI[level];
    }

    return children;
  }
}

// 에러 바운더리 HOC (Higher Order Component)
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <EnhancedErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </EnhancedErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

// 에러 리포팅 유틸리티
export const reportError = (error: Error, context?: Record<string, any>) => {
  logger.error('Manual error report', error, {
    component: 'ErrorReporter',
    ...context,
  });

  if (process.env.NODE_ENV === 'production' && window.Sentry) {
    window.Sentry.captureException(error, {
      extra: context,
    });
  }
};

// Window 타입 확장
declare global {
  interface Window {
    Sentry?: {
      captureException: (error: Error, context?: any) => void;
    };
  }
}

export default EnhancedErrorBoundary;