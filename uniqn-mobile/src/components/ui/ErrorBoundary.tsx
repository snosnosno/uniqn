/**
 * UNIQN Mobile - ErrorBoundary 컴포넌트
 *
 * @description React 에러 경계 컴포넌트 (Crashlytics 연동)
 * @version 1.0.0
 *
 * 주요 기능:
 * - 자식 컴포넌트 에러 캐치
 * - Crashlytics에 에러 리포팅
 * - 복구 UI 제공
 * - 컴포넌트 스택 추적
 */

import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { crashlyticsService } from '@/services/crashlyticsService';
import { logger } from '@/utils/logger';
import { env } from '@/config/env';
import { isAppError } from '@/errors';

// ============================================================================
// Error Type Detection Helpers (AppError 타입 기반 + 레거시 폴백)
// ============================================================================

/**
 * 네트워크 관련 에러인지 확인
 */
function isNetworkRelatedError(error: Error): boolean {
  // AppError 타입 체크 우선
  if (isAppError(error)) {
    return error.category === 'network';
  }
  // 레거시 폴백: 문자열 패턴 매칭
  const patterns = ['network', 'fetch', 'timeout', 'connection', 'offline'];
  const lowerMessage = error.message.toLowerCase();
  return patterns.some((p) => lowerMessage.includes(p)) || error.name === 'NetworkError';
}

/**
 * 인증 관련 에러인지 확인
 */
function isAuthRelatedError(error: Error): boolean {
  if (isAppError(error)) {
    return error.category === 'auth' || error.category === 'permission';
  }
  const patterns = ['auth', 'permission', 'unauthorized', '로그인', '권한', '만료', 'expired'];
  const lowerMessage = error.message.toLowerCase();
  return (
    patterns.some((p) => lowerMessage.includes(p)) ||
    error.name === 'AuthError' ||
    error.name === 'PermissionError'
  );
}

/**
 * 폼/검증 관련 에러인지 확인
 */
function isFormRelatedError(error: Error): boolean {
  if (isAppError(error)) {
    return error.category === 'validation';
  }
  const patterns = ['form', 'validation', 'submit', '검증', '입력'];
  const lowerMessage = error.message.toLowerCase();
  return (
    patterns.some((p) => lowerMessage.includes(p)) ||
    error.name === 'ValidationError' ||
    error.name === 'FormError'
  );
}

/**
 * 데이터 페칭 관련 에러인지 확인
 */
function isDataFetchRelatedError(error: Error): boolean {
  if (isAppError(error)) {
    return error.category === 'firebase' || error.code.includes('DOCUMENT_NOT_FOUND');
  }
  const patterns = ['fetch', 'data', 'load', 'not found', '404', '500'];
  const lowerMessage = error.message.toLowerCase();
  return (
    patterns.some((p) => lowerMessage.includes(p)) ||
    error.name === 'FetchError' ||
    error.name === 'DataError'
  );
}

// ============================================================================
// Types
// ============================================================================

export interface ErrorBoundaryProps {
  /** 자식 컴포넌트 */
  children: ReactNode;
  /** 컴포넌트 이름 (디버깅용) */
  name?: string;
  /** 에러 발생 시 표시할 대체 UI */
  fallback?: ReactNode;
  /** 에러 발생 시 콜백 */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** 에러 복구 시 콜백 */
  onReset?: () => void;
  /** 전체 화면 에러 UI 여부 */
  fullScreen?: boolean;
  /** 개발 모드에서 에러 상세 표시 여부 */
  showDetails?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// ============================================================================
// Component
// ============================================================================

/**
 * ErrorBoundary
 *
 * @description
 * React의 에러 경계 패턴을 구현하여 자식 컴포넌트에서 발생하는
 * JavaScript 에러를 캐치하고, 앱 크래시를 방지합니다.
 *
 * 에러 발생 시:
 * 1. Crashlytics에 에러 리포트 전송
 * 2. 로그 기록
 * 3. 대체 UI 표시
 * 4. 복구 옵션 제공
 *
 * @example
 * ```tsx
 * // 기본 사용
 * <ErrorBoundary name="MyFeature">
 *   <MyFeatureComponent />
 * </ErrorBoundary>
 *
 * // 커스텀 fallback
 * <ErrorBoundary fallback={<CustomErrorUI />}>
 *   <RiskyComponent />
 * </ErrorBoundary>
 *
 * // 전체 화면 에러
 * <ErrorBoundary fullScreen>
 *   <AppContent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * 에러 발생 시 상태 업데이트
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * 에러 캐치 후 처리
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { name = 'Unknown', onError } = this.props;

    // 상태 업데이트
    this.setState({ errorInfo });

    // 로깅
    logger.error(`ErrorBoundary [${name}] 에러 캐치`, error, {
      component: name,
      componentStack: errorInfo.componentStack || '',
    });

    // Crashlytics에 리포팅
    crashlyticsService.recordComponentError(error, {
      componentStack: errorInfo.componentStack || undefined,
    });

    // 사용자 정의 콜백
    if (onError) {
      onError(error, errorInfo);
    }
  }

  /**
   * 에러 복구 (상태 초기화)
   */
  handleReset = (): void => {
    const { onReset } = this.props;

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (onReset) {
      onReset();
    }
  };

  /**
   * 에러 UI 렌더링
   */
  renderError(): ReactNode {
    const { fallback, fullScreen = false, showDetails = env.isDevelopment, name } = this.props;
    const { error, errorInfo } = this.state;

    // 커스텀 fallback이 있으면 사용
    if (fallback) {
      return fallback;
    }

    const containerClass = fullScreen
      ? 'flex-1 bg-white dark:bg-gray-900'
      : 'p-4';

    return (
      <View className={containerClass}>
        <View className="flex-1 items-center justify-center p-6">
          {/* 에러 아이콘 */}
          <View className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 items-center justify-center mb-6">
            <Text className="text-4xl">💥</Text>
          </View>

          {/* 제목 */}
          <Text className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">
            문제가 발생했습니다
          </Text>

          {/* 설명 */}
          <Text className="text-gray-600 dark:text-gray-400 text-center mb-6 leading-6">
            {fullScreen
              ? '앱에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
              : '이 기능에 문제가 발생했습니다.'}
          </Text>

          {/* 개발 모드 상세 정보 */}
          {showDetails && error && (
            <ScrollView
              className="max-h-40 w-full bg-gray-100 dark:bg-gray-800 rounded-xl p-4 mb-6"
              showsVerticalScrollIndicator={true}
            >
              <Text className="text-xs text-red-600 dark:text-red-400 font-mono mb-2">
                {name && `[${name}] `}{error.name}: {error.message}
              </Text>
              {errorInfo?.componentStack && (
                <Text className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {errorInfo.componentStack.slice(0, 500)}
                </Text>
              )}
            </ScrollView>
          )}

          {/* 복구 버튼 */}
          <View className="flex-row gap-3">
            <Pressable
              onPress={this.handleReset}
              className="bg-blue-600 px-6 py-3 rounded-xl active:bg-blue-700"
              accessibilityRole="button"
              accessibilityLabel="다시 시도"
            >
              <Text className="text-white font-semibold">다시 시도</Text>
            </Pressable>

            {fullScreen && (
              <Pressable
                onPress={() => {
                  // 앱 재시작을 유도하는 UI (실제 재시작은 네이티브에서 처리)
                  this.handleReset();
                }}
                className="bg-gray-200 dark:bg-gray-700 px-6 py-3 rounded-xl active:bg-gray-300 dark:active:bg-gray-600"
                accessibilityRole="button"
                accessibilityLabel="홈으로"
              >
                <Text className="text-gray-700 dark:text-gray-200 font-semibold">홈으로</Text>
              </Pressable>
            )}
          </View>

          {/* 문의 안내 */}
          {fullScreen && (
            <Text className="text-xs text-gray-400 dark:text-gray-500 mt-6 text-center">
              문제가 계속되면 고객센터에 문의해주세요
            </Text>
          )}
        </View>
      </View>
    );
  }

  render(): ReactNode {
    const { children } = this.props;
    const { hasError } = this.state;

    if (hasError) {
      return this.renderError();
    }

    return children;
  }
}

// ============================================================================
// HOC (Higher Order Component)
// ============================================================================

/**
 * withErrorBoundary HOC
 *
 * @description 컴포넌트를 ErrorBoundary로 감싸는 HOC
 *
 * @example
 * ```tsx
 * const SafeComponent = withErrorBoundary(RiskyComponent, {
 *   name: 'RiskyComponent',
 *   fullScreen: true,
 * });
 * ```
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.FC<P> {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const ComponentWithErrorBoundary: React.FC<P> = (props) => {
    return (
      <ErrorBoundary name={displayName} {...errorBoundaryProps}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

  return ComponentWithErrorBoundary;
}

// ============================================================================
// Specialized Error Boundaries
// ============================================================================

/**
 * ScreenErrorBoundary
 *
 * @description 화면 단위 에러 경계 (전체 화면 에러 UI)
 */
export function ScreenErrorBoundary({
  children,
  name,
  onError,
  onReset,
}: {
  children: ReactNode;
  name?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
}): React.ReactElement {
  return (
    <ErrorBoundary
      name={name}
      fullScreen
      showDetails={env.isDevelopment}
      onError={onError}
      onReset={onReset}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * FeatureErrorBoundary
 *
 * @description 기능 단위 에러 경계 (인라인 에러 UI)
 */
export function FeatureErrorBoundary({
  children,
  name,
  fallback,
  onError,
  onReset,
}: {
  children: ReactNode;
  name?: string;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
}): React.ReactElement {
  return (
    <ErrorBoundary
      name={name}
      fullScreen={false}
      showDetails={env.isDevelopment}
      fallback={fallback}
      onError={onError}
      onReset={onReset}
    >
      {children}
    </ErrorBoundary>
  );
}

// ============================================================================
// Network Error Boundary
// ============================================================================

interface NetworkErrorFallbackProps {
  error: Error | null;
  onRetry: () => void;
  isOffline?: boolean;
}

/**
 * NetworkErrorFallback
 *
 * @description 네트워크 에러 시 표시할 UI
 */
function NetworkErrorFallback({
  error,
  onRetry,
  isOffline = false,
}: NetworkErrorFallbackProps): React.ReactElement {
  return (
    <View className="flex-1 items-center justify-center p-6 bg-white dark:bg-gray-900">
      <View className="w-20 h-20 rounded-full bg-orange-100 dark:bg-orange-900/30 items-center justify-center mb-6">
        <Text className="text-4xl">{isOffline ? '📡' : '🌐'}</Text>
      </View>

      <Text className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">
        {isOffline ? '오프라인 상태입니다' : '네트워크 오류'}
      </Text>

      <Text className="text-gray-600 dark:text-gray-400 text-center mb-6 leading-6">
        {isOffline
          ? '인터넷 연결을 확인해주세요.'
          : '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.'}
      </Text>

      {env.isDevelopment && error && (
        <View className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl p-4 mb-6">
          <Text className="text-xs text-orange-600 dark:text-orange-400 font-mono">
            {error.message}
          </Text>
        </View>
      )}

      <Pressable
        onPress={onRetry}
        className="bg-orange-600 px-6 py-3 rounded-xl active:bg-orange-700"
        accessibilityRole="button"
        accessibilityLabel="다시 시도"
      >
        <Text className="text-white font-semibold">다시 시도</Text>
      </Pressable>
    </View>
  );
}

/**
 * NetworkErrorBoundary
 *
 * @description 네트워크 관련 에러를 처리하는 에러 경계
 * - 오프라인 상태 감지
 * - 네트워크 타임아웃 처리
 * - 서버 연결 실패 처리
 */
export class NetworkErrorBoundary extends Component<
  ErrorBoundaryProps & { isOffline?: boolean },
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps & { isOffline?: boolean }) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // 네트워크 관련 에러인지 확인 (AppError 타입 기반 + 레거시 폴백)
    if (isNetworkRelatedError(error)) {
      return { hasError: true, error };
    }

    // 네트워크 에러가 아니면 상위로 전파
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { name = 'Network', onError } = this.props;

    this.setState({ errorInfo });

    logger.error(`NetworkErrorBoundary [${name}] 에러 캐치`, error, {
      component: name,
      errorType: 'network',
    });

    crashlyticsService.recordError(error, {
      domain: 'network',
      component: name,
    });

    if (onError) {
      onError(error, errorInfo);
    }
  }

  handleRetry = (): void => {
    const { onReset } = this.props;

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (onReset) {
      onReset();
    }
  };

  render(): ReactNode {
    const { children, isOffline = false, fallback } = this.props;
    const { hasError, error } = this.state;

    if (hasError) {
      if (fallback) return fallback;
      return (
        <NetworkErrorFallback
          error={error}
          onRetry={this.handleRetry}
          isOffline={isOffline}
        />
      );
    }

    return children;
  }
}

// ============================================================================
// Auth Error Boundary
// ============================================================================

interface AuthErrorFallbackProps {
  error: Error | null;
  onLogin: () => void;
  onRetry: () => void;
}

/**
 * AuthErrorFallback
 *
 * @description 인증 에러 시 표시할 UI
 */
function AuthErrorFallback({
  error,
  onLogin,
  onRetry,
}: AuthErrorFallbackProps): React.ReactElement {
  const isSessionExpired = error?.message.includes('expired') || error?.message.includes('만료');

  return (
    <View className="flex-1 items-center justify-center p-6 bg-white dark:bg-gray-900">
      <View className="w-20 h-20 rounded-full bg-yellow-100 dark:bg-yellow-900/30 items-center justify-center mb-6">
        <Text className="text-4xl">🔐</Text>
      </View>

      <Text className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">
        {isSessionExpired ? '세션이 만료되었습니다' : '로그인이 필요합니다'}
      </Text>

      <Text className="text-gray-600 dark:text-gray-400 text-center mb-6 leading-6">
        {isSessionExpired
          ? '보안을 위해 다시 로그인해주세요.'
          : '이 기능을 사용하려면 로그인이 필요합니다.'}
      </Text>

      {env.isDevelopment && error && (
        <View className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl p-4 mb-6">
          <Text className="text-xs text-yellow-600 dark:text-yellow-400 font-mono">
            {error.message}
          </Text>
        </View>
      )}

      <View className="flex-row gap-3">
        <Pressable
          onPress={onLogin}
          className="bg-indigo-600 px-6 py-3 rounded-xl active:bg-indigo-700"
          accessibilityRole="button"
          accessibilityLabel="로그인"
        >
          <Text className="text-white font-semibold">로그인</Text>
        </Pressable>

        <Pressable
          onPress={onRetry}
          className="bg-gray-200 dark:bg-gray-700 px-6 py-3 rounded-xl active:bg-gray-300 dark:active:bg-gray-600"
          accessibilityRole="button"
          accessibilityLabel="다시 시도"
        >
          <Text className="text-gray-700 dark:text-gray-200 font-semibold">다시 시도</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * AuthErrorBoundary
 *
 * @description 인증 관련 에러를 처리하는 에러 경계
 * - 세션 만료
 * - 권한 없음
 * - 인증 실패
 */
export class AuthErrorBoundary extends Component<
  ErrorBoundaryProps & { onLogin?: () => void },
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps & { onLogin?: () => void }) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // 인증 관련 에러인지 확인 (AppError 타입 기반 + 레거시 폴백)
    if (isAuthRelatedError(error)) {
      return { hasError: true, error };
    }

    // 인증 에러가 아니면 상위로 전파
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { name = 'Auth', onError } = this.props;

    this.setState({ errorInfo });

    logger.error(`AuthErrorBoundary [${name}] 에러 캐치`, error, {
      component: name,
      errorType: 'auth',
    });

    crashlyticsService.recordError(error, {
      domain: 'auth',
      component: name,
    });

    if (onError) {
      onError(error, errorInfo);
    }
  }

  handleRetry = (): void => {
    const { onReset } = this.props;

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (onReset) {
      onReset();
    }
  };

  handleLogin = (): void => {
    const { onLogin } = this.props;

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (onLogin) {
      onLogin();
    }
  };

  render(): ReactNode {
    const { children, fallback } = this.props;
    const { hasError, error } = this.state;

    if (hasError) {
      if (fallback) return fallback;
      return (
        <AuthErrorFallback
          error={error}
          onLogin={this.handleLogin}
          onRetry={this.handleRetry}
        />
      );
    }

    return children;
  }
}

// ============================================================================
// Form Error Boundary
// ============================================================================

interface FormErrorFallbackProps {
  error: Error | null;
  onRetry: () => void;
  onReset: () => void;
}

/**
 * FormErrorFallback
 *
 * @description 폼 에러 시 표시할 UI
 */
function FormErrorFallback({
  error,
  onRetry,
  onReset,
}: FormErrorFallbackProps): React.ReactElement {
  const isValidationError = error?.message.includes('validation') || error?.message.includes('검증');

  return (
    <View className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
      <View className="flex-row items-center mb-3">
        <Text className="text-2xl mr-3">⚠️</Text>
        <Text className="text-base font-semibold text-red-800 dark:text-red-200 flex-1">
          {isValidationError ? '입력값을 확인해주세요' : '폼 처리 중 오류 발생'}
        </Text>
      </View>

      {error && (
        <Text className="text-sm text-red-600 dark:text-red-400 mb-4 leading-5">
          {error.message}
        </Text>
      )}

      <View className="flex-row gap-2">
        <Pressable
          onPress={onRetry}
          className="flex-1 bg-red-600 min-h-[44px] py-2.5 rounded-lg active:bg-red-700 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="다시 시도"
        >
          <Text className="text-white font-medium text-center text-sm">다시 시도</Text>
        </Pressable>

        <Pressable
          onPress={onReset}
          className="flex-1 bg-gray-200 dark:bg-gray-700 min-h-[44px] py-2.5 rounded-lg active:bg-gray-300 dark:active:bg-gray-600 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="초기화"
        >
          <Text className="text-gray-700 dark:text-gray-200 font-medium text-center text-sm">초기화</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * FormErrorBoundary
 *
 * @description 폼 관련 에러를 처리하는 에러 경계
 * - 유효성 검증 실패
 * - 제출 실패
 * - 데이터 처리 오류
 */
export class FormErrorBoundary extends Component<
  ErrorBoundaryProps & { onFormReset?: () => void },
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps & { onFormReset?: () => void }) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // 폼 관련 에러인지 확인 (AppError 타입 기반 + 레거시 폴백)
    if (isFormRelatedError(error)) {
      return { hasError: true, error };
    }

    // 폼 에러가 아니면 상위로 전파
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { name = 'Form', onError } = this.props;

    this.setState({ errorInfo });

    logger.error(`FormErrorBoundary [${name}] 에러 캐치`, error, {
      component: name,
      errorType: 'form',
    });

    // 폼 에러는 Crashlytics에 보내지 않음 (사용자 입력 오류)
    if (onError) {
      onError(error, errorInfo);
    }
  }

  handleRetry = (): void => {
    const { onReset } = this.props;

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (onReset) {
      onReset();
    }
  };

  handleFormReset = (): void => {
    const { onFormReset } = this.props;

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (onFormReset) {
      onFormReset();
    }
  };

  render(): ReactNode {
    const { children, fallback } = this.props;
    const { hasError, error } = this.state;

    if (hasError) {
      if (fallback) return fallback;
      return (
        <FormErrorFallback
          error={error}
          onRetry={this.handleRetry}
          onReset={this.handleFormReset}
        />
      );
    }

    return children;
  }
}

// ============================================================================
// Data Fetch Error Boundary
// ============================================================================

interface DataFetchErrorFallbackProps {
  error: Error | null;
  onRetry: () => void;
  resourceName?: string;
}

/**
 * DataFetchErrorFallback
 *
 * @description 데이터 로딩 에러 시 표시할 UI
 */
function DataFetchErrorFallback({
  error,
  onRetry,
  resourceName = '데이터',
}: DataFetchErrorFallbackProps): React.ReactElement {
  return (
    <View className="flex-1 items-center justify-center p-6">
      <View className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center mb-4">
        <Text className="text-3xl">📭</Text>
      </View>

      <Text className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
        {resourceName}를 불러올 수 없습니다
      </Text>

      <Text className="text-gray-500 dark:text-gray-400 text-center mb-4 text-sm">
        잠시 후 다시 시도해주세요
      </Text>

      {env.isDevelopment && error && (
        <Text className="text-xs text-gray-400 dark:text-gray-500 text-center mb-4 font-mono">
          {error.message}
        </Text>
      )}

      <Pressable
        onPress={onRetry}
        className="bg-gray-200 dark:bg-gray-700 px-5 min-h-[44px] py-2.5 rounded-lg active:bg-gray-300 dark:active:bg-gray-600 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel="새로고침"
      >
        <Text className="text-gray-700 dark:text-gray-200 font-medium">새로고침</Text>
      </Pressable>
    </View>
  );
}

/**
 * DataFetchErrorBoundary
 *
 * @description 데이터 페칭 관련 에러를 처리하는 에러 경계
 * - API 호출 실패
 * - 데이터 파싱 오류
 * - 존재하지 않는 리소스
 */
export class DataFetchErrorBoundary extends Component<
  ErrorBoundaryProps & { resourceName?: string },
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps & { resourceName?: string }) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // 데이터 페칭 관련 에러인지 확인 (AppError 타입 기반 + 레거시 폴백)
    if (isDataFetchRelatedError(error)) {
      return { hasError: true, error };
    }

    // 데이터 에러가 아니면 상위로 전파
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { name = 'DataFetch', onError, resourceName } = this.props;

    this.setState({ errorInfo });

    logger.error(`DataFetchErrorBoundary [${name}] 에러 캐치`, error, {
      component: name,
      errorType: 'dataFetch',
      resourceName,
    });

    crashlyticsService.recordError(error, {
      domain: 'dataFetch',
      component: name,
      resourceName,
    });

    if (onError) {
      onError(error, errorInfo);
    }
  }

  handleRetry = (): void => {
    const { onReset } = this.props;

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (onReset) {
      onReset();
    }
  };

  render(): ReactNode {
    const { children, fallback, resourceName } = this.props;
    const { hasError, error } = this.state;

    if (hasError) {
      if (fallback) return fallback;
      return (
        <DataFetchErrorFallback
          error={error}
          onRetry={this.handleRetry}
          resourceName={resourceName}
        />
      );
    }

    return children;
  }
}

// ============================================================================
// Composite Error Boundary (다중 에러 타입 처리)
// ============================================================================

interface CompositeErrorBoundaryProps extends ErrorBoundaryProps {
  /** 처리할 에러 타입 */
  handleTypes?: ('network' | 'auth' | 'form' | 'data' | 'all')[];
  /** 오프라인 상태 */
  isOffline?: boolean;
  /** 로그인 콜백 */
  onLogin?: () => void;
  /** 폼 초기화 콜백 */
  onFormReset?: () => void;
  /** 리소스 이름 */
  resourceName?: string;
}

/**
 * CompositeErrorBoundary
 *
 * @description 여러 종류의 에러를 한 번에 처리하는 복합 에러 경계
 *
 * @example
 * ```tsx
 * <CompositeErrorBoundary
 *   handleTypes={['network', 'auth', 'data']}
 *   onLogin={() => router.push('/login')}
 *   resourceName="공고 목록"
 * >
 *   <JobPostingList />
 * </CompositeErrorBoundary>
 * ```
 */
export function CompositeErrorBoundary({
  children,
  handleTypes = ['all'],
  isOffline,
  onLogin,
  onFormReset,
  resourceName,
  ...props
}: CompositeErrorBoundaryProps): React.ReactElement {
  const shouldHandleAll = handleTypes.includes('all');

  // 에러 타입에 따라 중첩된 에러 경계 구성
  let wrappedChildren: ReactNode = children;

  if (shouldHandleAll || handleTypes.includes('form')) {
    wrappedChildren = (
      <FormErrorBoundary {...props} onFormReset={onFormReset}>
        {wrappedChildren}
      </FormErrorBoundary>
    );
  }

  if (shouldHandleAll || handleTypes.includes('data')) {
    wrappedChildren = (
      <DataFetchErrorBoundary {...props} resourceName={resourceName}>
        {wrappedChildren}
      </DataFetchErrorBoundary>
    );
  }

  if (shouldHandleAll || handleTypes.includes('auth')) {
    wrappedChildren = (
      <AuthErrorBoundary {...props} onLogin={onLogin}>
        {wrappedChildren}
      </AuthErrorBoundary>
    );
  }

  if (shouldHandleAll || handleTypes.includes('network')) {
    wrappedChildren = (
      <NetworkErrorBoundary {...props} isOffline={isOffline}>
        {wrappedChildren}
      </NetworkErrorBoundary>
    );
  }

  // 최상위에 기본 에러 경계 추가
  return (
    <ErrorBoundary {...props}>
      {wrappedChildren}
    </ErrorBoundary>
  );
}

export default ErrorBoundary;
