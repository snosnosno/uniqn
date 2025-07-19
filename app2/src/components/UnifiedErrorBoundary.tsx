import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { emergencyFirebaseReset } from '../utils/firebaseEmergencyReset';
import { logger } from '../utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  context?: 'firebase' | 'general' | 'auto';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isResetting: boolean;
  errorContext: 'firebase' | 'general' | 'auto';
}

// Error Boundary Fallback Component
const ErrorFallback: React.FC<{ 
  error: Error | null; 
  onRetry: () => void;
  onReset?: (() => Promise<void>) | undefined;
  isResetting: boolean;
  context: 'firebase' | 'general' | 'auto';
}> = ({ error, onRetry, onReset, isResetting, context }) => {
  const { t } = useTranslation();

  const getErrorMessage = (error: Error | null, context: string) => {
    if (!error) return t('errors.general');
    
    const message = error.message.toLowerCase();
    
    if (context === 'firebase') {
      if (message.includes('fir store') || message.includes('internal assertion failed')) {
        return t('errors.firebase.internal');
      }
      if (message.includes('permission') || message.includes('auth')) {
        return t('errors.firebase.permission');
      }
      if (message.includes('quota') || message.includes('limit')) {
        return t('errors.firebase.quota');
      }
      return t('errors.firebase.general');
    }
    
    if (message.includes('network') || message.includes('fetch')) {
      return t('errors.network');
    }
    if (message.includes('permission') || message.includes('auth')) {
      return t('errors.permission');
    }
    if (message.includes('quota') || message.includes('limit')) {
      return t('errors.quota');
    }
    
    return t('errors.general');
  };

  const getErrorTitle = (context: string) => {
    switch (context) {
      case 'firebase':
        return t('errors.firebase.title', 'Firebase 연결 오류');
      case 'general':
        return t('errors.title', '오류가 발생했습니다');
      default:
        return t('errors.title', '오류가 발생했습니다');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {getErrorTitle(context)}
          </h3>
          
          <p className="text-sm text-gray-600 mb-4">
            {getErrorMessage(error, context)}
          </p>

          {isResetting ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-sm text-gray-600">
                  {context === 'firebase' ? '재설정 중...' : '복구 중...'}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                잠시만 기다려주세요. 페이지가 자동으로 새로고침됩니다.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {context === 'firebase' && onReset ? <button
                  onClick={() => onReset()}
                  className="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
                >
                  🔄 긴급 재설정
                </button> : null}
              
              <button
                onClick={onRetry}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                🔄 다시 시도
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
              >
                🔄 페이지 새로고침
              </button>
            </div>
          )}

          {process.env.NODE_ENV === 'development' && error ? <details className="mt-4 text-left">
              <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                오류 세부 정보
              </summary>
              <pre className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded overflow-auto max-h-32">
                {error.message}
                {error.stack ? `\n\n${error.stack}` : null}
              </pre>
            </details> : null}
        </div>
      </div>
    </div>
  );
};

class UnifiedErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    isResetting: false,
    errorContext: 'general'
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    // Firebase 내부 오류인지 확인
    const isFirebaseError = error.message.includes('FIRESTORE') && 
                           error.message.includes('INTERNAL ASSERTION FAILED');
    
    return {
      hasError: true,
      error,
      errorContext: isFirebaseError ? 'firebase' : 'general'
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('UnifiedErrorBoundary caught an error', error, { 
      component: 'UnifiedErrorBoundary',
      errorInfo: errorInfo.toString() 
    });
    
    this.setState({
      error,
      errorInfo,
    });

    // Firebase 내부 오류인 경우 자동 재설정 시도
    if (error.message.includes('FIRESTORE') && 
        error.message.includes('INTERNAL ASSERTION FAILED')) {
      this.handleFirebaseError();
    }
  }

  private handleFirebaseError = async () => {
    logger.info('Handling Firebase internal error', { 
      component: 'UnifiedErrorBoundary',
      operation: 'firebase_error_recovery'
    });
    
    this.setState({ isResetting: true });
    
    try {
      await emergencyFirebaseReset();
      // 성공적으로 재설정되면 페이지 새로고침
      window.location.reload();
    } catch (resetError) {
      logger.error('Firebase reset failed', resetError as Error, { 
        component: 'UnifiedErrorBoundary',
        operation: 'firebase_reset'
      });
      this.setState({ isResetting: false });
    }
  };

  private handleManualReset = async () => {
    this.setState({ isResetting: true });
    
    try {
      await emergencyFirebaseReset();
      window.location.reload();
    } catch (error) {
      logger.error('Manual reset failed', error as Error, { 
        component: 'UnifiedErrorBoundary',
        operation: 'manual_reset'
      });
      this.setState({ isResetting: false });
    }
  };

  private handleRetry = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null, 
      isResetting: false 
    });
  };

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <ErrorFallback 
          error={this.state.error} 
          onRetry={this.handleRetry}
          onReset={this.state.errorContext === 'firebase' ? this.handleManualReset : undefined}
          isResetting={this.state.isResetting}
          context={this.state.errorContext}
        />
      );
    }

    return this.props.children;
  }
}

export default UnifiedErrorBoundary; 