# 09. 에러 처리 전략

## 목차
1. [에러 분류 체계](#1-에러-분류-체계)
2. [에러 처리 아키텍처](#2-에러-처리-아키텍처)
3. [에러 타입 정의](#3-에러-타입-정의)
4. [서비스별 에러 처리](#4-서비스별-에러-처리)
5. [사용자 피드백 전략](#5-사용자-피드백-전략)
6. [복구 및 재시도 전략](#6-복구-및-재시도-전략)
7. [에러 로깅 및 모니터링](#7-에러-로깅-및-모니터링)
8. [오프라인 에러 처리](#8-오프라인-에러-처리)

---

## 1. 에러 분류 체계

### 에러 심각도 레벨

```typescript
// src/types/error.ts
export enum ErrorSeverity {
  /** 앱 크래시 위험, 즉시 조치 필요 */
  CRITICAL = 'critical',
  /** 기능 사용 불가, 사용자에게 알림 필요 */
  ERROR = 'error',
  /** 기능 저하, 자동 복구 시도 */
  WARNING = 'warning',
  /** 정보성, 로깅만 수행 */
  INFO = 'info',
}

export enum ErrorCategory {
  /** 인증 관련 (로그인, 토큰 만료) */
  AUTH = 'auth',
  /** 네트워크 연결 */
  NETWORK = 'network',
  /** 서버 응답 에러 */
  SERVER = 'server',
  /** 입력값 검증 */
  VALIDATION = 'validation',
  /** 비즈니스 로직 */
  BUSINESS = 'business',
  /** 권한 부족 */
  PERMISSION = 'permission',
  /** 시스템/기기 */
  SYSTEM = 'system',
}
```

### 에러 코드 체계

```typescript
// src/constants/errorCodes.ts
export const ErrorCodes = {
  // AUTH (1xxx)
  AUTH_INVALID_CREDENTIALS: 'E1001',
  AUTH_TOKEN_EXPIRED: 'E1002',
  AUTH_SESSION_INVALID: 'E1003',
  AUTH_EMAIL_NOT_VERIFIED: 'E1004',
  AUTH_ACCOUNT_DISABLED: 'E1005',
  AUTH_TOO_MANY_ATTEMPTS: 'E1006',

  // NETWORK (2xxx)
  NETWORK_OFFLINE: 'E2001',
  NETWORK_TIMEOUT: 'E2002',
  NETWORK_SERVER_UNREACHABLE: 'E2003',

  // SERVER (3xxx)
  SERVER_INTERNAL_ERROR: 'E3001',
  SERVER_MAINTENANCE: 'E3002',
  SERVER_RATE_LIMITED: 'E3003',

  // VALIDATION (4xxx)
  VALIDATION_REQUIRED_FIELD: 'E4001',
  VALIDATION_INVALID_FORMAT: 'E4002',
  VALIDATION_OUT_OF_RANGE: 'E4003',

  // BUSINESS (5xxx)
  BUSINESS_INSUFFICIENT_CHIPS: 'E5001',
  BUSINESS_ALREADY_APPLIED: 'E5002',
  BUSINESS_APPLICATION_CLOSED: 'E5003',
  BUSINESS_ALREADY_CONFIRMED: 'E5004',
  BUSINESS_MAX_CAPACITY_REACHED: 'E5005',
  BUSINESS_INVALID_QR_CODE: 'E5006',
  BUSINESS_NOT_CHECKED_IN: 'E5007',
  BUSINESS_ALREADY_SETTLED: 'E5008',

  // PERMISSION (6xxx)
  PERMISSION_DENIED: 'E6001',
  PERMISSION_ROLE_REQUIRED: 'E6002',
  PERMISSION_NOT_OWNER: 'E6003',

  // SYSTEM (7xxx)
  SYSTEM_CAMERA_DENIED: 'E7001',
  SYSTEM_STORAGE_FULL: 'E7002',
  SYSTEM_NOTIFICATION_DENIED: 'E7003',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
```

---

## 2. 에러 처리 아키텍처

### 에러 처리 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                        Error Flow                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┐    ┌──────────┐    ┌────────────┐    ┌──────────┐ │
│  │ Service │───▶│ AppError │───▶│ ErrorStore │───▶│ UI Toast │ │
│  │  Layer  │    │  Class   │    │  (Zustand) │    │ / Modal  │ │
│  └─────────┘    └──────────┘    └────────────┘    └──────────┘ │
│       │              │                │                  │      │
│       ▼              ▼                ▼                  ▼      │
│  ┌─────────┐    ┌──────────┐    ┌────────────┐    ┌──────────┐ │
│  │ Logging │    │ Recovery │    │ Analytics  │    │  Retry   │ │
│  │ Service │    │ Strategy │    │  Report    │    │  Action  │ │
│  └─────────┘    └──────────┘    └────────────┘    └──────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### AppError 클래스

```typescript
// src/lib/errors/AppError.ts
import { ErrorSeverity, ErrorCategory, ErrorCode } from '@/types/error';

export interface AppErrorOptions {
  code: ErrorCode;
  message: string;
  category: ErrorCategory;
  severity?: ErrorSeverity;
  originalError?: unknown;
  metadata?: Record<string, unknown>;
  recoveryAction?: RecoveryAction;
}

export type RecoveryAction =
  | { type: 'retry'; maxAttempts?: number }
  | { type: 'navigate'; screen: string }
  | { type: 'logout' }
  | { type: 'refresh' }
  | { type: 'none' };

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly timestamp: Date;
  readonly originalError?: unknown;
  readonly metadata?: Record<string, unknown>;
  readonly recoveryAction: RecoveryAction;
  readonly userMessage: string;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = 'AppError';
    this.code = options.code;
    this.category = options.category;
    this.severity = options.severity ?? ErrorSeverity.ERROR;
    this.timestamp = new Date();
    this.originalError = options.originalError;
    this.metadata = options.metadata;
    this.recoveryAction = options.recoveryAction ?? { type: 'none' };
    this.userMessage = this.getUserFriendlyMessage();

    // 스택 트레이스 유지
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  private getUserFriendlyMessage(): string {
    return ErrorMessages[this.code] ?? '일시적인 오류가 발생했습니다.';
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      category: this.category,
      severity: this.severity,
      timestamp: this.timestamp.toISOString(),
      metadata: this.metadata,
    };
  }
}
```

### 사용자 친화적 에러 메시지

```typescript
// src/constants/errorMessages.ts
export const ErrorMessages: Record<ErrorCode, string> = {
  // AUTH
  E1001: '이메일 또는 비밀번호가 올바르지 않습니다.',
  E1002: '로그인이 만료되었습니다. 다시 로그인해주세요.',
  E1003: '세션이 만료되었습니다. 다시 로그인해주세요.',
  E1004: '이메일 인증이 필요합니다. 인증 메일을 확인해주세요.',
  E1005: '비활성화된 계정입니다. 고객센터에 문의해주세요.',
  E1006: '로그인 시도 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.',

  // NETWORK
  E2001: '인터넷 연결을 확인해주세요.',
  E2002: '서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.',
  E2003: '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.',

  // SERVER
  E3001: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  E3002: '서비스 점검 중입니다. 잠시 후 다시 이용해주세요.',
  E3003: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',

  // VALIDATION
  E4001: '필수 항목을 입력해주세요.',
  E4002: '입력 형식이 올바르지 않습니다.',
  E4003: '허용된 범위를 벗어났습니다.',

  // BUSINESS
  E5001: '칩이 부족합니다. 충전 후 다시 시도해주세요.',
  E5002: '이미 지원한 공고입니다.',
  E5003: '지원이 마감되었습니다.',
  E5004: '이미 확정된 지원자입니다.',
  E5005: '모집 인원이 마감되었습니다.',
  E5006: 'QR 코드가 유효하지 않습니다.',
  E5007: '출근 체크인을 먼저 해주세요.',
  E5008: '이미 정산이 완료된 내역입니다.',

  // PERMISSION
  E6001: '접근 권한이 없습니다.',
  E6002: '해당 기능을 사용할 권한이 없습니다.',
  E6003: '본인만 수정할 수 있습니다.',

  // SYSTEM
  E7001: '카메라 접근 권한이 필요합니다. 설정에서 허용해주세요.',
  E7002: '저장 공간이 부족합니다.',
  E7003: '알림 권한이 필요합니다. 설정에서 허용해주세요.',
};
```

### 에러 스토어

```typescript
// src/stores/errorStore.ts
import { create } from 'zustand';
import { AppError } from '@/lib/errors/AppError';

interface ErrorState {
  errors: AppError[];
  lastError: AppError | null;

  // Actions
  addError: (error: AppError) => void;
  clearError: (code: string) => void;
  clearAllErrors: () => void;

  // Error handling
  handleError: (error: unknown) => void;
}

export const useErrorStore = create<ErrorState>((set, get) => ({
  errors: [],
  lastError: null,

  addError: (error) => {
    set((state) => ({
      errors: [...state.errors.slice(-9), error], // 최대 10개 유지
      lastError: error,
    }));

    // 자동 로깅
    logError(error);

    // 심각도별 처리
    if (error.severity === ErrorSeverity.CRITICAL) {
      crashlytics().recordError(error);
    }
  },

  clearError: (code) => {
    set((state) => ({
      errors: state.errors.filter((e) => e.code !== code),
    }));
  },

  clearAllErrors: () => {
    set({ errors: [], lastError: null });
  },

  handleError: (error) => {
    const appError = normalizeError(error);
    get().addError(appError);

    // 복구 액션 처리
    executeRecoveryAction(appError.recoveryAction);
  },
}));
```

---

## 3. 에러 타입 정의

### Firebase 에러 매핑

```typescript
// src/lib/errors/firebaseErrors.ts
import { FirebaseError } from 'firebase/app';
import { AppError, ErrorCodes, ErrorCategory, ErrorSeverity } from '@/types/error';

const FirebaseAuthErrorMap: Record<string, AppErrorOptions> = {
  'auth/invalid-credential': {
    code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
    category: ErrorCategory.AUTH,
    message: 'Invalid credentials',
    recoveryAction: { type: 'none' },
  },
  'auth/user-disabled': {
    code: ErrorCodes.AUTH_ACCOUNT_DISABLED,
    category: ErrorCategory.AUTH,
    message: 'Account disabled',
    severity: ErrorSeverity.ERROR,
    recoveryAction: { type: 'none' },
  },
  'auth/too-many-requests': {
    code: ErrorCodes.AUTH_TOO_MANY_ATTEMPTS,
    category: ErrorCategory.AUTH,
    message: 'Too many attempts',
    recoveryAction: { type: 'retry', maxAttempts: 3 },
  },
  'auth/network-request-failed': {
    code: ErrorCodes.NETWORK_OFFLINE,
    category: ErrorCategory.NETWORK,
    message: 'Network request failed',
    recoveryAction: { type: 'retry', maxAttempts: 3 },
  },
  'auth/id-token-expired': {
    code: ErrorCodes.AUTH_TOKEN_EXPIRED,
    category: ErrorCategory.AUTH,
    message: 'Token expired',
    recoveryAction: { type: 'refresh' },
  },
};

const FirestoreErrorMap: Record<string, AppErrorOptions> = {
  'permission-denied': {
    code: ErrorCodes.PERMISSION_DENIED,
    category: ErrorCategory.PERMISSION,
    message: 'Permission denied',
    recoveryAction: { type: 'navigate', screen: '/login' },
  },
  'unavailable': {
    code: ErrorCodes.NETWORK_SERVER_UNREACHABLE,
    category: ErrorCategory.NETWORK,
    message: 'Service unavailable',
    recoveryAction: { type: 'retry', maxAttempts: 5 },
  },
  'deadline-exceeded': {
    code: ErrorCodes.NETWORK_TIMEOUT,
    category: ErrorCategory.NETWORK,
    message: 'Request timeout',
    recoveryAction: { type: 'retry', maxAttempts: 3 },
  },
  'not-found': {
    code: ErrorCodes.SERVER_INTERNAL_ERROR,
    category: ErrorCategory.SERVER,
    message: 'Resource not found',
    recoveryAction: { type: 'none' },
  },
};

export function mapFirebaseError(error: FirebaseError): AppError {
  const authMapping = FirebaseAuthErrorMap[error.code];
  const firestoreMapping = FirestoreErrorMap[error.code];
  const mapping = authMapping || firestoreMapping;

  if (mapping) {
    return new AppError({
      ...mapping,
      originalError: error,
      metadata: { firebaseCode: error.code },
    });
  }

  // 기본 에러
  return new AppError({
    code: ErrorCodes.SERVER_INTERNAL_ERROR,
    message: error.message,
    category: ErrorCategory.SERVER,
    originalError: error,
    metadata: { firebaseCode: error.code },
  });
}
```

### 비즈니스 에러

```typescript
// src/lib/errors/businessErrors.ts
import { AppError, ErrorCodes, ErrorCategory } from '@/types/error';

export class InsufficientChipsError extends AppError {
  constructor(required: number, available: number) {
    super({
      code: ErrorCodes.BUSINESS_INSUFFICIENT_CHIPS,
      message: `Insufficient chips: required ${required}, available ${available}`,
      category: ErrorCategory.BUSINESS,
      metadata: { required, available },
      recoveryAction: { type: 'navigate', screen: '/chips/purchase' },
    });
    this.name = 'InsufficientChipsError';
  }
}

export class AlreadyAppliedError extends AppError {
  constructor(jobPostingId: string) {
    super({
      code: ErrorCodes.BUSINESS_ALREADY_APPLIED,
      message: `Already applied to job posting: ${jobPostingId}`,
      category: ErrorCategory.BUSINESS,
      metadata: { jobPostingId },
      recoveryAction: { type: 'none' },
    });
    this.name = 'AlreadyAppliedError';
  }
}

export class ApplicationClosedError extends AppError {
  constructor(jobPostingId: string) {
    super({
      code: ErrorCodes.BUSINESS_APPLICATION_CLOSED,
      message: `Application closed for job posting: ${jobPostingId}`,
      category: ErrorCategory.BUSINESS,
      metadata: { jobPostingId },
      recoveryAction: { type: 'none' },
    });
    this.name = 'ApplicationClosedError';
  }
}

export class InvalidQRCodeError extends AppError {
  constructor(reason: string) {
    super({
      code: ErrorCodes.BUSINESS_INVALID_QR_CODE,
      message: `Invalid QR code: ${reason}`,
      category: ErrorCategory.BUSINESS,
      metadata: { reason },
      recoveryAction: { type: 'retry' },
    });
    this.name = 'InvalidQRCodeError';
  }
}

export class AlreadySettledError extends AppError {
  constructor(workLogId: string) {
    super({
      code: ErrorCodes.BUSINESS_ALREADY_SETTLED,
      message: `Work log already settled: ${workLogId}`,
      category: ErrorCategory.BUSINESS,
      metadata: { workLogId },
      recoveryAction: { type: 'none' },
    });
    this.name = 'AlreadySettledError';
  }
}
```

---

## 4. 서비스별 에러 처리

### 에러 처리 래퍼

```typescript
// src/lib/errors/errorWrapper.ts
import { mapFirebaseError } from './firebaseErrors';
import { AppError, ErrorCodes, ErrorCategory } from '@/types/error';

type AsyncFunction<T> = () => Promise<T>;

interface WrapOptions {
  context: string;
  rethrow?: boolean;
  onError?: (error: AppError) => void;
}

export async function withErrorHandling<T>(
  fn: AsyncFunction<T>,
  options: WrapOptions
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const appError = normalizeError(error, options.context);

    // 에러 로깅
    logError(appError);

    // 콜백 실행
    options.onError?.(appError);

    if (options.rethrow) {
      throw appError;
    }

    throw appError;
  }
}

export function normalizeError(error: unknown, context?: string): AppError {
  // 이미 AppError인 경우
  if (error instanceof AppError) {
    return error;
  }

  // Firebase 에러
  if (error && typeof error === 'object' && 'code' in error) {
    const firebaseError = mapFirebaseError(error as any);
    if (context) {
      firebaseError.metadata = { ...firebaseError.metadata, context };
    }
    return firebaseError;
  }

  // 일반 Error
  if (error instanceof Error) {
    return new AppError({
      code: ErrorCodes.SERVER_INTERNAL_ERROR,
      message: error.message,
      category: ErrorCategory.SYSTEM,
      originalError: error,
      metadata: { context },
    });
  }

  // 알 수 없는 에러
  return new AppError({
    code: ErrorCodes.SERVER_INTERNAL_ERROR,
    message: String(error),
    category: ErrorCategory.SYSTEM,
    metadata: { context, originalValue: error },
  });
}
```

### 서비스 레이어 에러 처리

```typescript
// src/services/applicationService.ts
import { withErrorHandling } from '@/lib/errors/errorWrapper';
import {
  AlreadyAppliedError,
  ApplicationClosedError,
  InsufficientChipsError
} from '@/lib/errors/businessErrors';

export const applicationService = {
  async applyToJob(userId: string, jobPostingId: string): Promise<Application> {
    return withErrorHandling(
      async () => {
        // 1. 중복 지원 체크
        const existingApplication = await this.checkExistingApplication(userId, jobPostingId);
        if (existingApplication) {
          throw new AlreadyAppliedError(jobPostingId);
        }

        // 2. 공고 상태 체크
        const jobPosting = await jobPostingService.getById(jobPostingId);
        if (jobPosting.status !== 'published') {
          throw new ApplicationClosedError(jobPostingId);
        }

        // 3. 마감 인원 체크
        if (jobPosting.currentApplicants >= jobPosting.maxApplicants) {
          throw new AppError({
            code: ErrorCodes.BUSINESS_MAX_CAPACITY_REACHED,
            message: 'Max capacity reached',
            category: ErrorCategory.BUSINESS,
            metadata: { jobPostingId },
          });
        }

        // 4. 칩 잔액 체크
        const chipBalance = await chipService.getBalance(userId);
        const requiredChips = jobPosting.applicationChipCost;
        if (chipBalance < requiredChips) {
          throw new InsufficientChipsError(requiredChips, chipBalance);
        }

        // 5. 트랜잭션으로 지원 처리
        return await runTransaction(async (transaction) => {
          // 칩 차감
          await chipService.deductChips(userId, requiredChips, transaction);

          // 지원 생성
          const application = await this.createApplication(
            userId,
            jobPostingId,
            transaction
          );

          return application;
        });
      },
      { context: 'applicationService.applyToJob' }
    );
  },
};
```

### Hook 레이어 에러 처리

```typescript
// src/hooks/useApplyJob.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToastStore } from '@/stores/toastStore';
import { useErrorStore } from '@/stores/errorStore';
import { applicationService } from '@/services/applicationService';
import { ErrorCodes } from '@/types/error';

export function useApplyJob() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { handleError } = useErrorStore();

  return useMutation({
    mutationFn: ({ userId, jobPostingId }: ApplyJobParams) =>
      applicationService.applyToJob(userId, jobPostingId),

    onSuccess: (application) => {
      // 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['applications', 'my'] });
      queryClient.invalidateQueries({ queryKey: ['jobPosting', application.jobPostingId] });

      addToast({
        type: 'success',
        message: '지원이 완료되었습니다.',
      });
    },

    onError: (error) => {
      handleError(error);

      // 특정 에러에 대한 커스텀 처리
      if (error instanceof AppError) {
        switch (error.code) {
          case ErrorCodes.BUSINESS_INSUFFICIENT_CHIPS:
            addToast({
              type: 'error',
              message: error.userMessage,
              action: {
                label: '칩 충전',
                onPress: () => router.push('/chips/purchase'),
              },
            });
            break;

          case ErrorCodes.BUSINESS_ALREADY_APPLIED:
            addToast({
              type: 'warning',
              message: error.userMessage,
            });
            break;

          default:
            addToast({
              type: 'error',
              message: error.userMessage,
            });
        }
      }
    },
  });
}
```

---

## 5. 사용자 피드백 전략

### 에러 심각도별 UI 전략

```typescript
// src/lib/errors/errorFeedback.ts
import { ErrorSeverity, ErrorCategory } from '@/types/error';
import { AppError } from './AppError';

export interface FeedbackConfig {
  /** Toast, Modal, FullScreen 중 선택 */
  display: 'toast' | 'modal' | 'fullscreen';
  /** 자동 닫힘 시간 (ms), 0이면 수동 닫기 */
  duration: number;
  /** 재시도 버튼 표시 여부 */
  showRetry: boolean;
  /** 추가 액션 버튼 */
  actions?: Array<{
    label: string;
    action: () => void;
    variant: 'primary' | 'secondary';
  }>;
}

export function getFeedbackConfig(error: AppError): FeedbackConfig {
  // 심각도 기반 기본 설정
  const baseConfig: Record<ErrorSeverity, Partial<FeedbackConfig>> = {
    [ErrorSeverity.CRITICAL]: {
      display: 'fullscreen',
      duration: 0,
      showRetry: true,
    },
    [ErrorSeverity.ERROR]: {
      display: 'modal',
      duration: 0,
      showRetry: true,
    },
    [ErrorSeverity.WARNING]: {
      display: 'toast',
      duration: 5000,
      showRetry: false,
    },
    [ErrorSeverity.INFO]: {
      display: 'toast',
      duration: 3000,
      showRetry: false,
    },
  };

  // 카테고리별 오버라이드
  const categoryOverride: Partial<Record<ErrorCategory, Partial<FeedbackConfig>>> = {
    [ErrorCategory.AUTH]: {
      display: 'modal',
      actions: [
        {
          label: '로그인',
          action: () => router.replace('/login'),
          variant: 'primary',
        },
      ],
    },
    [ErrorCategory.NETWORK]: {
      showRetry: true,
      actions: [
        {
          label: '새로고침',
          action: () => window.location.reload(),
          variant: 'primary',
        },
      ],
    },
    [ErrorCategory.PERMISSION]: {
      display: 'modal',
    },
  };

  return {
    ...baseConfig[error.severity],
    ...categoryOverride[error.category],
  } as FeedbackConfig;
}
```

### ErrorDisplay 컴포넌트

```typescript
// src/components/error/ErrorDisplay.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { AppError } from '@/lib/errors/AppError';
import { getFeedbackConfig } from '@/lib/errors/errorFeedback';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Toast } from '@/components/ui/Toast';

interface ErrorDisplayProps {
  error: AppError;
  onDismiss: () => void;
  onRetry?: () => void;
}

export function ErrorDisplay({ error, onDismiss, onRetry }: ErrorDisplayProps) {
  const config = getFeedbackConfig(error);

  const content = (
    <View className="items-center p-4">
      <ErrorIcon category={error.category} />
      <Text className="text-lg font-bold text-gray-900 dark:text-white mt-4">
        {getErrorTitle(error.category)}
      </Text>
      <Text className="text-center text-gray-600 dark:text-gray-400 mt-2">
        {error.userMessage}
      </Text>

      <View className="flex-row gap-3 mt-6">
        {config.showRetry && onRetry && (
          <Button variant="outline" onPress={onRetry}>
            다시 시도
          </Button>
        )}
        {config.actions?.map((action, index) => (
          <Button
            key={index}
            variant={action.variant}
            onPress={action.action}
          >
            {action.label}
          </Button>
        ))}
        <Button variant="ghost" onPress={onDismiss}>
          닫기
        </Button>
      </View>
    </View>
  );

  switch (config.display) {
    case 'fullscreen':
      return <FullScreenError>{content}</FullScreenError>;
    case 'modal':
      return <Modal visible onClose={onDismiss}>{content}</Modal>;
    case 'toast':
      return (
        <Toast
          type="error"
          message={error.userMessage}
          duration={config.duration}
          onHide={onDismiss}
        />
      );
  }
}

function getErrorTitle(category: ErrorCategory): string {
  const titles: Record<ErrorCategory, string> = {
    [ErrorCategory.AUTH]: '인증 오류',
    [ErrorCategory.NETWORK]: '연결 오류',
    [ErrorCategory.SERVER]: '서버 오류',
    [ErrorCategory.VALIDATION]: '입력 오류',
    [ErrorCategory.BUSINESS]: '처리 오류',
    [ErrorCategory.PERMISSION]: '권한 오류',
    [ErrorCategory.SYSTEM]: '시스템 오류',
  };
  return titles[category];
}
```

### 폼 에러 표시

```typescript
// src/components/form/FormField.tsx
import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { useController, Control } from 'react-hook-form';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

interface FormFieldProps {
  name: string;
  control: Control<any>;
  label: string;
  placeholder?: string;
  // ... other props
}

export function FormField({ name, control, label, ...props }: FormFieldProps) {
  const {
    field: { value, onChange, onBlur },
    fieldState: { error, isTouched },
  } = useController({ name, control });

  const showError = error && isTouched;

  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChange}
        onBlur={onBlur}
        className={`
          px-4 py-3 rounded-lg border
          ${showError
            ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
          }
        `}
        {...props}
      />

      {showError && (
        <Animated.View entering={FadeIn} exiting={FadeOut}>
          <Text className="text-sm text-red-500 mt-1">
            {error.message}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}
```

---

## 6. 복구 및 재시도 전략

### 재시도 유틸리티

```typescript
// src/lib/errors/retry.ts
interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryCondition?: (error: unknown) => boolean;
}

const defaultConfig: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const { maxAttempts, baseDelay, maxDelay, backoffFactor, retryCondition } = {
    ...defaultConfig,
    ...config,
  };

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 재시도 가능 여부 확인
      if (retryCondition && !retryCondition(error)) {
        throw error;
      }

      // 특정 에러는 재시도하지 않음
      if (!isRetryableError(error)) {
        throw error;
      }

      if (attempt < maxAttempts) {
        const delay = Math.min(
          baseDelay * Math.pow(backoffFactor, attempt - 1),
          maxDelay
        );

        // 지터 추가 (서버 부하 분산)
        const jitter = delay * 0.2 * Math.random();

        await sleep(delay + jitter);

        logger.info('Retrying operation', {
          attempt,
          maxAttempts,
          delay: delay + jitter,
        });
      }
    }
  }

  throw lastError;
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof AppError) {
    // 네트워크 에러는 재시도
    if (error.category === ErrorCategory.NETWORK) return true;

    // 서버 에러 중 일부는 재시도
    if (error.code === ErrorCodes.SERVER_INTERNAL_ERROR) return true;
    if (error.code === ErrorCodes.SERVER_RATE_LIMITED) return true;

    // 비즈니스 에러는 재시도하지 않음
    if (error.category === ErrorCategory.BUSINESS) return false;

    // 인증 에러는 재시도하지 않음
    if (error.category === ErrorCategory.AUTH) return false;
  }

  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

### 복구 액션 실행

```typescript
// src/lib/errors/recovery.ts
import { RecoveryAction } from './AppError';
import { router } from 'expo-router';
import { authService } from '@/services/authService';
import { queryClient } from '@/lib/queryClient';

export async function executeRecoveryAction(action: RecoveryAction): Promise<void> {
  switch (action.type) {
    case 'retry':
      // 재시도는 호출자가 처리
      break;

    case 'navigate':
      router.replace(action.screen);
      break;

    case 'logout':
      await authService.signOut();
      router.replace('/login');
      break;

    case 'refresh':
      // 토큰 갱신 시도
      try {
        await authService.refreshToken();
        // 실패한 쿼리 재시도
        queryClient.invalidateQueries();
      } catch {
        // 갱신 실패시 로그아웃
        await executeRecoveryAction({ type: 'logout' });
      }
      break;

    case 'none':
    default:
      // 아무것도 하지 않음
      break;
  }
}
```

### React Query 에러 복구

```typescript
// src/lib/queryClient.ts
import { QueryClient, MutationCache, QueryCache } from '@tanstack/react-query';
import { normalizeError } from '@/lib/errors/errorWrapper';
import { ErrorCodes } from '@/types/error';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const appError = normalizeError(error);

        // 인증/권한 에러는 재시도하지 않음
        if (appError.category === ErrorCategory.AUTH) return false;
        if (appError.category === ErrorCategory.PERMISSION) return false;

        // 비즈니스 에러는 재시도하지 않음
        if (appError.category === ErrorCategory.BUSINESS) return false;

        // 최대 3회 재시도
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5분
    },
    mutations: {
      retry: false, // 뮤테이션은 재시도하지 않음
    },
  },

  queryCache: new QueryCache({
    onError: (error, query) => {
      const appError = normalizeError(error);

      // 인증 에러시 전역 처리
      if (appError.code === ErrorCodes.AUTH_TOKEN_EXPIRED) {
        executeRecoveryAction({ type: 'refresh' });
      }

      // 에러 로깅
      logger.error('Query error', appError, {
        queryKey: query.queryKey,
      });
    },
  }),

  mutationCache: new MutationCache({
    onError: (error, variables, context, mutation) => {
      const appError = normalizeError(error);

      logger.error('Mutation error', appError, {
        mutationKey: mutation.options.mutationKey,
      });
    },
  }),
});
```

---

## 7. 에러 로깅 및 모니터링

### 로거 서비스

```typescript
// src/services/loggerService.ts
import crashlytics from '@react-native-firebase/crashlytics';
import analytics from '@react-native-firebase/analytics';
import { AppError, ErrorSeverity } from '@/types/error';

interface LogContext {
  component?: string;
  action?: string;
  userId?: string;
  [key: string]: unknown;
}

class LoggerService {
  private userId: string | null = null;

  setUserId(userId: string | null) {
    this.userId = userId;
    crashlytics().setUserId(userId ?? '');
  }

  info(message: string, context?: LogContext): void {
    if (__DEV__) {
      console.log(`[INFO] ${message}`, context);
    }

    // Production에서는 analytics로만 전송
    analytics().logEvent('log_info', {
      message,
      ...context,
    });
  }

  warn(message: string, context?: LogContext): void {
    if (__DEV__) {
      console.warn(`[WARN] ${message}`, context);
    }

    crashlytics().log(`[WARN] ${message}`);
    analytics().logEvent('log_warning', {
      message,
      ...context,
    });
  }

  error(message: string, error: unknown, context?: LogContext): void {
    const appError = error instanceof AppError ? error : normalizeError(error);

    if (__DEV__) {
      console.error(`[ERROR] ${message}`, appError, context);
    }

    // Crashlytics에 에러 기록
    crashlytics().log(`[ERROR] ${message}`);
    crashlytics().setAttributes({
      errorCode: appError.code,
      errorCategory: appError.category,
      ...context,
    });

    // Critical 에러는 Crashlytics에 기록
    if (appError.severity === ErrorSeverity.CRITICAL) {
      crashlytics().recordError(appError);
    }

    // Analytics 이벤트
    analytics().logEvent('error_occurred', {
      error_code: appError.code,
      error_category: appError.category,
      error_severity: appError.severity,
      error_message: appError.message,
      ...context,
    });
  }

  async withPerformanceTracking<T>(
    fn: () => Promise<T>,
    traceName: string,
    attributes?: Record<string, string>
  ): Promise<T> {
    const trace = await perf().startTrace(traceName);

    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        trace.putAttribute(key, value);
      });
    }

    try {
      const result = await fn();
      trace.putMetric('success', 1);
      return result;
    } catch (error) {
      trace.putMetric('error', 1);
      throw error;
    } finally {
      await trace.stop();
    }
  }
}

export const logger = new LoggerService();
```

### 에러 리포팅

```typescript
// src/lib/errors/errorReporting.ts
import crashlytics from '@react-native-firebase/crashlytics';
import { AppError, ErrorSeverity } from '@/types/error';

export function logError(error: AppError): void {
  // 개발 환경에서는 콘솔 출력
  if (__DEV__) {
    console.error('[AppError]', error.toJSON());
    return;
  }

  // Crashlytics 속성 설정
  crashlytics().setAttributes({
    error_code: error.code,
    error_category: error.category,
    error_severity: error.severity,
  });

  // 로그 메시지 추가
  crashlytics().log(`Error: ${error.code} - ${error.message}`);

  // CRITICAL 에러만 Crashlytics에 기록
  if (error.severity === ErrorSeverity.CRITICAL) {
    crashlytics().recordError(error);
  }
}

// 전역 에러 핸들러
export function setupGlobalErrorHandler(): void {
  // JS 에러 캐치
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    const appError = normalizeError(error);

    logger.error(
      isFatal ? 'Fatal error' : 'Uncaught error',
      appError,
      { isFatal }
    );

    if (isFatal) {
      crashlytics().recordError(appError);
    }
  });

  // Promise rejection 캐치
  const originalHandler = global.onunhandledrejection;
  global.onunhandledrejection = (event) => {
    const appError = normalizeError(event.reason);

    logger.error('Unhandled promise rejection', appError);

    originalHandler?.(event);
  };
}
```

---

## 8. 오프라인 에러 처리

### 네트워크 상태 관리

```typescript
// src/hooks/useNetworkStatus.ts
import { useEffect, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useToastStore } from '@/stores/toastStore';

interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
}

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
    type: 'unknown',
  });
  const { addToast } = useToastStore();
  const prevConnectedRef = useRef(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const newStatus = {
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      };

      setStatus(newStatus);

      // 연결 상태 변경 알림
      if (prevConnectedRef.current && !newStatus.isConnected) {
        addToast({
          type: 'warning',
          message: '인터넷 연결이 끊어졌습니다. 오프라인 모드로 전환됩니다.',
          duration: 0, // 수동 닫기
        });
      } else if (!prevConnectedRef.current && newStatus.isConnected) {
        addToast({
          type: 'success',
          message: '인터넷에 다시 연결되었습니다.',
        });

        // 연결 복구 시 캐시 동기화
        queryClient.invalidateQueries();
      }

      prevConnectedRef.current = newStatus.isConnected;
    });

    return () => unsubscribe();
  }, []);

  return status;
}
```

### 오프라인 큐

```typescript
// src/lib/offlineQueue.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

interface QueuedOperation {
  id: string;
  type: 'mutation';
  mutationKey: string;
  variables: unknown;
  timestamp: number;
  retryCount: number;
}

const QUEUE_KEY = '@offline_queue';

class OfflineQueue {
  private queue: QueuedOperation[] = [];
  private isProcessing = false;

  async init(): Promise<void> {
    const stored = await AsyncStorage.getItem(QUEUE_KEY);
    if (stored) {
      this.queue = JSON.parse(stored);
    }

    // 네트워크 연결 시 큐 처리
    NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable) {
        this.processQueue();
      }
    });
  }

  async add(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    const queuedOp: QueuedOperation = {
      ...operation,
      id: generateId(),
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.queue.push(queuedOp);
    await this.persist();

    logger.info('Operation queued for offline', {
      mutationKey: operation.mutationKey
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const operation = this.queue[0];

        try {
          await this.executeOperation(operation);
          this.queue.shift();
          await this.persist();

          logger.info('Queued operation completed', {
            mutationKey: operation.mutationKey,
          });
        } catch (error) {
          operation.retryCount++;

          if (operation.retryCount >= 3) {
            // 3회 실패 시 큐에서 제거
            this.queue.shift();
            await this.persist();

            logger.error('Queued operation failed permanently', error, {
              mutationKey: operation.mutationKey,
            });
          } else {
            // 재시도를 위해 대기
            await sleep(1000 * operation.retryCount);
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async executeOperation(operation: QueuedOperation): Promise<void> {
    // mutationKey에 따라 적절한 서비스 메서드 호출
    const handlers: Record<string, (variables: unknown) => Promise<unknown>> = {
      'application.apply': (vars: any) =>
        applicationService.applyToJob(vars.userId, vars.jobPostingId),
      'attendance.checkIn': (vars: any) =>
        attendanceService.checkIn(vars.workLogId, vars.checkInTime),
      'attendance.checkOut': (vars: any) =>
        attendanceService.checkOut(vars.workLogId, vars.checkOutTime),
    };

    const handler = handlers[operation.mutationKey];
    if (handler) {
      await handler(operation.variables);
    } else {
      throw new Error(`Unknown mutation: ${operation.mutationKey}`);
    }
  }

  private async persist(): Promise<void> {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

export const offlineQueue = new OfflineQueue();
```

### 오프라인 지원 뮤테이션

```typescript
// src/hooks/useOfflineMutation.ts
import { useMutation, UseMutationOptions } from '@tanstack/react-query';
import { useNetworkStatus } from './useNetworkStatus';
import { offlineQueue } from '@/lib/offlineQueue';
import { useToastStore } from '@/stores/toastStore';

export function useOfflineMutation<TData, TVariables>(
  mutationKey: string,
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: UseMutationOptions<TData, Error, TVariables>
) {
  const { isConnected } = useNetworkStatus();
  const { addToast } = useToastStore();

  return useMutation({
    ...options,
    mutationFn: async (variables: TVariables) => {
      if (!isConnected) {
        // 오프라인일 때 큐에 추가
        await offlineQueue.add({
          type: 'mutation',
          mutationKey,
          variables,
        });

        addToast({
          type: 'info',
          message: '오프라인 상태입니다. 연결되면 자동으로 처리됩니다.',
        });

        // 낙관적 응답 반환
        return { queued: true } as unknown as TData;
      }

      return mutationFn(variables);
    },
  });
}
```

---

## 요약

### 에러 처리 체크리스트

- [ ] 모든 서비스 메서드에 `withErrorHandling` 래퍼 적용
- [ ] Firebase 에러를 AppError로 변환
- [ ] 비즈니스 에러는 명확한 에러 클래스로 정의
- [ ] 사용자 친화적 에러 메시지 제공
- [ ] 심각도별 적절한 UI 피드백
- [ ] 네트워크 에러에 재시도 로직 적용
- [ ] 오프라인 상태 처리 및 큐잉
- [ ] Crashlytics로 Critical 에러 추적
- [ ] 전역 에러 핸들러 설정

### 에러 복구 흐름

```
에러 발생 → AppError 변환 → 심각도 판단 → 피드백 표시
    │                              │
    │                              ▼
    │                      복구 액션 실행
    │                              │
    ▼                              ▼
로깅/모니터링              재시도 / 페이지 이동 / 로그아웃
```
