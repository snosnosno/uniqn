import { Component, ErrorInfo, ReactNode } from 'react';

import { logger } from '../../utils/logger';
import { emergencyFirebaseReset } from '../../utils/firebaseEmergencyReset';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isResetting: boolean;
}

class FirebaseErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    isResetting: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // Firebase 내부 오류인지 확인
    const isFirebaseError = error.message.includes('FIRESTORE') && 
                           error.message.includes('INTERNAL ASSERTION FAILED');
    
    return {
      hasError: isFirebaseError,
      error,
      isResetting: false
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('🚨 Firebase Error Boundary caught an error:', error instanceof Error ? error : new Error(String(error)), { 
      component: 'FirebaseErrorBoundary', 
      data: errorInfo.componentStack 
    });
    
    // Firebase 내부 오류인 경우 자동 재설정 시도
    if (error.message.includes('FIRESTORE') && 
        error.message.includes('INTERNAL ASSERTION FAILED')) {
      this.handleFirebaseError();
    }
  }

  private handleFirebaseError = async () => {
    logger.debug('🔥 Handling Firebase internal error...', { component: 'FirebaseErrorBoundary' });
    
    this.setState({ isResetting: true });
    
    try {
      // 긴급 재설정 실행
      await emergencyFirebaseReset();
    } catch (resetError) {
      logger.error('❌ Emergency reset failed:', resetError instanceof Error ? resetError : new Error(String(resetError)), { component: 'FirebaseErrorBoundary' });
      // 수동 재설정 버튼 표시
      this.setState({ isResetting: false });
    }
  };

  private handleManualReset = async () => {
    this.setState({ isResetting: true });
    
    try {
      await emergencyFirebaseReset();
    } catch (error) {
      logger.error('❌ Manual reset failed:', error instanceof Error ? error : new Error(String(error)), { component: 'FirebaseErrorBoundary' });
      this.setState({ isResetting: false });
    }
  };

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, isResetting: false });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Firebase 연결 오류
              </h3>

              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Firebase 서비스에 일시적인 문제가 발생했습니다. 
                자동으로 복구를 시도하고 있습니다.
              </p>

              {this.state.isResetting ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">재설정 중...</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    잠시만 기다려주세요. 페이지가 자동으로 새로고침됩니다.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={this.handleManualReset}
                    className="w-full bg-red-600 dark:bg-red-700 text-white px-4 py-2 rounded-md hover:bg-red-700 dark:hover:bg-red-800 transition-colors"
                  >
                    🔄 긴급 재설정
                  </button>
                  
                  <button
                    onClick={this.handleRetry}
                    className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
                  >
                    🔄 다시 시도
                  </button>
                  
                  <button
                    onClick={() => window.location.reload()}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    🔄 페이지 새로고침
                  </button>
                </div>
              )}

              {this.state.error ? <details className="mt-4 text-left">
                  <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                    오류 세부 정보
                  </summary>
                  <pre className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded overflow-auto max-h-32">
                    {this.state.error.message}
                  </pre>
                </details> : null}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default FirebaseErrorBoundary; 