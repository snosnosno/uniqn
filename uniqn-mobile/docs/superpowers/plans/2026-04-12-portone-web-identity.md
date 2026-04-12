# PortOne 웹 본인인증 연동 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `PhoneVerification.tsx` (Firebase SMS OTP stub)를 제거하고, `PortOneIdentityVerification.web.tsx`를 `@portone/browser-sdk/v2`로 실제 구현하여 웹/네이티브 모두 동일한 PortOne 본인인증 UX 제공.

**Architecture:** `PortOneIdentityVerification.web.tsx`를 `requestIdentityVerification()` (iframe 방식, redirect 없음)으로 구현. 기존 `buildPortOneInicisIdentityRequest()`, `callVerifyPortOneIdentity()`, `clearPendingPortOneIdentityRequest()` 서비스 함수를 그대로 재사용. `SignupStepIdentity.tsx`에서 `Platform.OS !== 'web'` 조건 제거.

**Tech Stack:** TypeScript 5.9 strict, React Native 0.81, NativeWind 4.2, `@portone/browser-sdk/v2` 0.1.3, `@testing-library/react-native`, Jest 29

---

## File Map

| 파일                                                                     | 변경                                       |
| ------------------------------------------------------------------------ | ------------------------------------------ |
| `src/components/auth/PortOneIdentityVerification.web.tsx`                | **수정** — 실제 PortOne 브라우저 SDK 구현  |
| `src/components/auth/signup/SignupStepIdentity.tsx`                      | **수정** — Platform.OS !== 'web' 조건 제거 |
| `src/components/auth/index.ts`                                           | **수정** — PhoneVerification export 제거   |
| `src/components/auth/__tests__/PortOneIdentityVerification.web.test.tsx` | **신규** — 웹 컴포넌트 테스트              |
| `src/components/auth/PhoneVerification.tsx`                              | **삭제**                                   |
| `src/components/auth/PhoneVerifiedView.tsx`                              | **삭제**                                   |
| `src/components/auth/phoneAuthErrors.ts`                                 | **삭제**                                   |
| `src/hooks/auth/useOTPVerification.ts`                                   | **삭제**                                   |
| `src/hooks/auth/usePhoneSMS.ts`                                          | **삭제**                                   |
| `src/components/auth/__tests__/PhoneVerification.test.tsx`               | **삭제**                                   |

---

## Task 1: 테스트 파일 작성 (TDD - RED)

**Files:**

- Create: `src/components/auth/__tests__/PortOneIdentityVerification.web.test.tsx`

- [ ] **Step 1: 테스트 파일 생성**

`src/components/auth/__tests__/PortOneIdentityVerification.web.test.tsx` 생성:

```tsx
import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';

// PortOne 브라우저 SDK mock
const mockRequestIdentityVerification = jest.fn();
jest.mock('@portone/browser-sdk/v2', () => ({
  requestIdentityVerification: (...args: unknown[]) => mockRequestIdentityVerification(...args),
}));

// portOneIdentityService mock
const mockBuildRequest = jest.fn();
const mockSavePending = jest.fn();
const mockClearPending = jest.fn();
const mockSaveResult = jest.fn();
const mockCallVerify = jest.fn();

jest.mock('@/services/auth/portOneIdentityService', () => ({
  buildPortOneInicisIdentityRequest: (...args: unknown[]) => mockBuildRequest(...args),
  savePendingPortOneIdentityRequest: (...args: unknown[]) => mockSavePending(...args),
  clearPendingPortOneIdentityRequest: (...args: unknown[]) => mockClearPending(...args),
  savePortOneIdentityVerificationResult: (...args: unknown[]) => mockSaveResult(...args),
  callVerifyPortOneIdentity: (...args: unknown[]) => mockCallVerify(...args),
  getPortOneInicisIdentityConfig: () => ({ isReady: true }),
}));

// NativeWind mock
jest.mock('react-native-css-interop', () => ({
  cssInterop: jest.fn(),
  remapProps: jest.fn(),
}));

const mockRequest = {
  storeId: 'store-id',
  channelKey: 'channel-key',
  identityVerificationId: 'test-id-123',
  bypass: { inicisUnified: { flgFixedUser: 'N' } },
  customData: undefined,
};

const mockIdentity = {
  provider: 'portone' as const,
  channel: 'inicis_unified' as const,
  identityVerificationId: 'test-id-123',
  verifiedAt: '2026-04-12T00:00:00.000Z',
  name: '홍길동',
  birthDate: '19900101',
  gender: 'male' as const,
  phoneNumber: '01012345678',
};

const mockVerification = {
  success: true,
  identityVerified: true,
  phoneVerified: true,
  hasDuplicatePhone: false,
  hasDuplicateIdentity: false,
  identity: mockIdentity,
};

const mockSdkSuccess = {
  transactionType: 'IDENTITY_VERIFICATION' as const,
  identityVerificationId: 'test-id-123',
  identityVerificationTxId: 'tx-id-123',
};

describe('PortOneIdentityVerification (web)', () => {
  const defaultProps = {
    onVerified: jest.fn(),
    onError: jest.fn(),
    disabled: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockBuildRequest.mockReturnValue(mockRequest);
    mockCallVerify.mockResolvedValue(mockVerification);
    mockRequestIdentityVerification.mockResolvedValue(mockSdkSuccess);
  });

  it('본인인증 시작 버튼이 렌더링된다', () => {
    const { getByText } = render(<PortOneIdentityVerification {...defaultProps} />);
    expect(getByText('본인인증 시작')).toBeTruthy();
  });

  it('버튼 클릭 시 PortOne SDK를 호출한다', async () => {
    const { getByText } = render(<PortOneIdentityVerification {...defaultProps} />);
    await act(async () => {
      fireEvent.press(getByText('본인인증 시작'));
    });
    expect(mockRequestIdentityVerification).toHaveBeenCalledWith({
      storeId: 'store-id',
      channelKey: 'channel-key',
      identityVerificationId: 'test-id-123',
      bypass: { inicisUnified: { flgFixedUser: 'N' } },
      customData: undefined,
    });
  });

  it('인증 성공 시 onVerified가 identity와 함께 호출된다', async () => {
    const onVerified = jest.fn();
    const { getByText } = render(
      <PortOneIdentityVerification {...defaultProps} onVerified={onVerified} />
    );
    await act(async () => {
      fireEvent.press(getByText('본인인증 시작'));
    });
    await waitFor(() => {
      expect(onVerified).toHaveBeenCalledWith(mockIdentity);
    });
  });

  it('SDK가 undefined 반환 시 에러 메시지를 표시한다', async () => {
    mockRequestIdentityVerification.mockResolvedValue(undefined);
    const { getByText } = render(<PortOneIdentityVerification {...defaultProps} />);
    await act(async () => {
      fireEvent.press(getByText('본인인증 시작'));
    });
    await waitFor(() => {
      expect(getByText(/본인인증 창이 닫혔습니다/)).toBeTruthy();
    });
  });

  it('SDK result.code 있을 때 에러 메시지를 표시한다 (사용자 취소)', async () => {
    mockRequestIdentityVerification.mockResolvedValue({
      ...mockSdkSuccess,
      code: 'CANCEL',
      message: '사용자가 인증을 취소했습니다.',
    });
    const { getByText } = render(<PortOneIdentityVerification {...defaultProps} />);
    await act(async () => {
      fireEvent.press(getByText('본인인증 시작'));
    });
    await waitFor(() => {
      expect(getByText(/사용자가 인증을 취소했습니다/)).toBeTruthy();
    });
  });

  it('hasDuplicatePhone 시 에러 메시지를 표시한다', async () => {
    mockCallVerify.mockResolvedValue({
      ...mockVerification,
      hasDuplicatePhone: true,
    });
    const { getByText } = render(<PortOneIdentityVerification {...defaultProps} />);
    await act(async () => {
      fireEvent.press(getByText('본인인증 시작'));
    });
    await waitFor(() => {
      expect(getByText(/이미 가입된 휴대폰 번호/)).toBeTruthy();
    });
  });

  it('hasDuplicateIdentity 시 에러 메시지를 표시한다', async () => {
    mockCallVerify.mockResolvedValue({
      ...mockVerification,
      hasDuplicateIdentity: true,
    });
    const { getByText } = render(<PortOneIdentityVerification {...defaultProps} />);
    await act(async () => {
      fireEvent.press(getByText('본인인증 시작'));
    });
    await waitFor(() => {
      expect(getByText(/이미 가입된 본인인증 정보/)).toBeTruthy();
    });
  });

  it('disabled=true 시 버튼이 비활성화된다', () => {
    const { getByText } = render(<PortOneIdentityVerification {...defaultProps} disabled={true} />);
    // Button 컴포넌트가 disabled prop을 받는지 확인
    const button = getByText('본인인증 시작').parent?.parent;
    expect(button?.props.accessibilityState?.disabled).toBe(true);
  });

  it('initialIdentity 있을 때 완료 상태를 표시한다', () => {
    const { getByText } = render(
      <PortOneIdentityVerification {...defaultProps} initialIdentity={mockIdentity} />
    );
    expect(getByText('이니시스 본인인증 완료')).toBeTruthy();
    expect(getByText('홍길동')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인 (컴포넌트가 아직 미구현이므로 FAIL 예상)**

```bash
cd uniqn-mobile
npm test -- --testPathPattern="PortOneIdentityVerification.web" --passWithNoTests
```

예상: FAIL — "Cannot find module" 또는 컴포넌트 import 오류

---

## Task 2: PortOneIdentityVerification.web.tsx 구현

**Files:**

- Modify: `src/components/auth/PortOneIdentityVerification.web.tsx`

- [ ] **Step 1: 컴포넌트 전체 교체**

`src/components/auth/PortOneIdentityVerification.web.tsx` 전체를 다음으로 교체:

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { requestIdentityVerification } from '@portone/browser-sdk/v2';
import { CheckCircleIcon, ShieldCheckIcon, XCircleIcon } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { extractUserMessage } from '@/errors';
import {
  type PortOneInicisIdentityRequest,
  type VerifiedPortOneIdentity,
  buildPortOneInicisIdentityRequest,
  callVerifyPortOneIdentity,
  clearPendingPortOneIdentityRequest,
  savePendingPortOneIdentityRequest,
} from '@/services/auth/portOneIdentityService';
import { logger } from '@/utils/logger';

export interface PortOneIdentityVerificationProps {
  onVerified: (identity: VerifiedPortOneIdentity) => void;
  onError?: (error: Error) => void;
  initialIdentity?: VerifiedPortOneIdentity | null;
  disabled?: boolean;
  customerId?: string;
  customerFullName?: string;
  customerPhoneNumber?: string;
}

function formatBirthDate(value: string): string {
  if (!/^\d{8}$/.test(value)) return value;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function getGenderLabel(value?: 'male' | 'female'): string {
  if (value === 'male') return '남성';
  if (value === 'female') return '여성';
  return '확인 필요';
}

export function PortOneIdentityVerification({
  onVerified,
  onError,
  initialIdentity = null,
  disabled = false,
  customerId,
  customerFullName,
  customerPhoneNumber,
}: PortOneIdentityVerificationProps) {
  const [verifiedIdentity, setVerifiedIdentity] = useState<VerifiedPortOneIdentity | null>(
    initialIdentity
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setVerifiedIdentity(initialIdentity);
  }, [initialIdentity]);

  const handleVerificationFailure = useCallback(
    (error: unknown, fallbackMessage?: string) => {
      clearPendingPortOneIdentityRequest();
      setIsProcessing(false);

      const resolvedMessage =
        fallbackMessage ??
        (error instanceof Error ? error.message : extractUserMessage(error)) ??
        '본인인증 처리 중 오류가 발생했습니다.';

      setErrorMessage(resolvedMessage);

      const normalizedError =
        error instanceof Error ? error : new Error(fallbackMessage ?? 'PortOne identity failed');

      logger.error('PortOne web identity verification failed', normalizedError, {
        component: 'PortOneIdentityVerification.web',
      });
      onError?.(normalizedError);
    },
    [onError]
  );

  const startVerification = useCallback(async () => {
    let request: PortOneInicisIdentityRequest;

    try {
      request = buildPortOneInicisIdentityRequest({
        customerId,
        customerFullName,
        customerPhoneNumber,
      });
    } catch (error) {
      handleVerificationFailure(error);
      return;
    }

    savePendingPortOneIdentityRequest(request);
    setIsProcessing(true);
    setErrorMessage(null);
    setVerifiedIdentity(null);

    try {
      // redirectUrl 미설정 → iframe 방식 → Promise로 result 반환
      const result = await requestIdentityVerification({
        storeId: request.storeId,
        channelKey: request.channelKey,
        identityVerificationId: request.identityVerificationId,
        bypass: request.bypass,
        customData: request.customData,
      });

      // undefined → redirect 발생 (비정상)
      if (!result) {
        throw new Error('본인인증 창이 닫혔습니다.');
      }

      // 에러 코드 → 실패/취소
      if (result.code) {
        setIsProcessing(false);
        setErrorMessage(result.message ?? '본인인증이 완료되지 않았습니다.');
        clearPendingPortOneIdentityRequest();
        return;
      }

      // Supabase Edge Function으로 검증
      const verification = await callVerifyPortOneIdentity({
        identityVerificationId: result.identityVerificationId,
      });

      if (verification.hasDuplicatePhone) {
        throw new Error('이미 가입된 휴대폰 번호입니다.');
      }

      if (verification.hasDuplicateIdentity) {
        throw new Error('이미 가입된 본인인증 정보입니다.');
      }

      if (!verification.phoneVerified || !verification.identity.phoneNumber) {
        throw new Error('본인인증 결과에 휴대폰 번호가 없습니다. 채널 설정을 확인해주세요.');
      }

      if (!verification.identity.gender) {
        throw new Error('본인인증 결과에 성별 정보가 없습니다. 인증 수단을 다시 선택해주세요.');
      }

      setVerifiedIdentity(verification.identity);
      onVerified(verification.identity);
    } catch (error) {
      handleVerificationFailure(error);
    } finally {
      clearPendingPortOneIdentityRequest();
      setIsProcessing(false);
    }
  }, [customerId, customerFullName, customerPhoneNumber, handleVerificationFailure, onVerified]);

  return (
    <View className="w-full">
      {verifiedIdentity ? (
        <View className="rounded-md border border-success-200 bg-success-50 p-4 dark:border-success-900/40 dark:bg-success-900/10">
          <View className="mb-3 flex-row items-center">
            <CheckCircleIcon size={20} color="#22c55e" />
            <Text className="ml-2 font-sans-semibold text-success-700 dark:text-success-400">
              이니시스 본인인증 완료
            </Text>
          </View>

          <View className="gap-2 rounded-lg bg-white p-3 dark:bg-surface">
            <View className="flex-row justify-between">
              <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                이름
              </Text>
              <Text className="font-sans-medium text-secondary-900 dark:text-off-white">
                {verifiedIdentity.name}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                생년월일
              </Text>
              <Text className="font-sans-medium text-secondary-900 dark:text-off-white">
                {formatBirthDate(verifiedIdentity.birthDate)}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                성별
              </Text>
              <Text className="font-sans-medium text-secondary-900 dark:text-off-white">
                {getGenderLabel(verifiedIdentity.gender)}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                휴대폰 번호
              </Text>
              <Text className="font-sans-medium text-secondary-900 dark:text-off-white">
                {verifiedIdentity.phoneNumber}
              </Text>
            </View>
          </View>

          <Button
            onPress={startVerification}
            variant="outline"
            disabled={disabled || isProcessing}
            className="mt-3"
            fullWidth
          >
            다시 인증하기
          </Button>
        </View>
      ) : (
        <View className="rounded-md border border-secondary-200 bg-secondary-50 p-4 dark:border-surface-overlay dark:bg-surface-elevated">
          <View className="mb-3 flex-row items-center">
            <ShieldCheckIcon size={20} color="#4f46e5" />
            <Text className="ml-2 font-sans-semibold text-secondary-900 dark:text-off-white">
              이니시스 본인인증
            </Text>
          </View>
          <Text className="mb-4 text-sm leading-5 text-secondary-600 dark:text-secondary-300 font-sans">
            PASS, 토스, 카카오, 네이버 등 이니시스 통합인증 수단으로 본인인증을 진행합니다.
          </Text>
          <Button onPress={startVerification} disabled={disabled || isProcessing} fullWidth>
            {isProcessing ? '인증 확인 중...' : '본인인증 시작'}
          </Button>
        </View>
      )}

      {errorMessage && (
        <View className="mt-3 flex-row items-center rounded-lg bg-error-50 p-3 dark:bg-error-900/20">
          <XCircleIcon size={18} color="#DC2626" />
          <Text className="ml-2 flex-1 text-sm text-error-600 dark:text-error-400 font-sans">
            {errorMessage}
          </Text>
        </View>
      )}
    </View>
  );
}

export default PortOneIdentityVerification;
```

- [ ] **Step 2: 테스트 통과 확인**

```bash
cd uniqn-mobile
npm test -- --testPathPattern="PortOneIdentityVerification.web"
```

예상: 모든 테스트 PASS

- [ ] **Step 3: 타입 체크**

```bash
cd uniqn-mobile
npx tsc --noEmit 2>&1 | head -20
```

예상: 출력 없음 (에러 0건)

- [ ] **Step 4: 커밋**

```bash
cd ..
git add uniqn-mobile/src/components/auth/PortOneIdentityVerification.web.tsx \
        "uniqn-mobile/src/components/auth/__tests__/PortOneIdentityVerification.web.test.tsx"
git commit -m "feat(web): PortOne 브라우저 SDK 본인인증 구현 + 테스트"
```

---

## Task 3: SignupStepIdentity.tsx Platform 조건 제거

**Files:**

- Modify: `src/components/auth/signup/SignupStepIdentity.tsx`

- [ ] **Step 1: Platform.OS !== 'web' 조건 제거**

`src/components/auth/signup/SignupStepIdentity.tsx`에서:

```typescript
// Before (line ~71)
const usePortOneIdentity = Platform.OS !== 'web' && isPortOneInicisIdentityConfigured();

// After
const usePortOneIdentity = isPortOneInicisIdentityConfigured();
```

- [ ] **Step 2: Platform import 및 관련 import 정리**

`Platform`이 이 파일에서 더 이상 사용되지 않으면 import에서 제거:

```typescript
// Before
import { Platform, View, Text } from 'react-native';

// After (Platform 제거)
import { View, Text } from 'react-native';
```

단, `Platform`이 다른 곳에서도 사용된다면 유지. 파일 전체에서 `Platform` 사용처를 확인 후 결정.

- [ ] **Step 3: PhoneVerification import 제거**

`SignupStepIdentity.tsx`에서 PhoneVerification import와 사용 부분 제거:

```typescript
// 이 import 제거
import { PhoneVerification } from '@/components/auth/PhoneVerification';
```

JSX에서 PhoneVerification 사용 부분 (`{usePortOneIdentity ? ... : <PhoneVerification .../>}`) 을 단순화:

```tsx
// Before
{usePortOneIdentity ? (
  <PortOneIdentityVerification ... />
) : (
  <PhoneVerification ... />
)}

// After
<PortOneIdentityVerification ... />
```

- [ ] **Step 4: 타입 체크**

```bash
cd uniqn-mobile
npx tsc --noEmit 2>&1 | head -20
```

예상: 출력 없음

- [ ] **Step 5: 커밋**

```bash
cd ..
git add "uniqn-mobile/src/components/auth/signup/SignupStepIdentity.tsx"
git commit -m "refactor(signup): SignupStepIdentity Platform.OS 조건 제거 — 항상 PortOne 사용"
```

---

## Task 4: components/auth/index.ts PhoneVerification export 제거

**Files:**

- Modify: `src/components/auth/index.ts`

- [ ] **Step 1: PhoneVerification export 라인 제거**

`src/components/auth/index.ts`에서 다음 라인 제거:

```typescript
export { PhoneVerification } from './PhoneVerification';
```

- [ ] **Step 2: 타입 체크 및 전체 참조 확인**

```bash
cd uniqn-mobile
npx tsc --noEmit 2>&1 | head -20
```

`PhoneVerification`을 re-export를 통해 import하는 곳이 있으면 에러 발생. 그 경우 해당 파일도 정리.

- [ ] **Step 3: 커밋**

```bash
cd ..
git add "uniqn-mobile/src/components/auth/index.ts"
git commit -m "refactor(auth): index.ts PhoneVerification export 제거"
```

---

## Task 5: 더 이상 사용하지 않는 파일 삭제

**Files:**

- Delete: `src/components/auth/PhoneVerification.tsx`
- Delete: `src/components/auth/PhoneVerifiedView.tsx`
- Delete: `src/components/auth/phoneAuthErrors.ts`
- Delete: `src/hooks/auth/useOTPVerification.ts`
- Delete: `src/hooks/auth/usePhoneSMS.ts`
- Delete: `src/components/auth/__tests__/PhoneVerification.test.tsx`

- [ ] **Step 1: 파일 삭제**

```bash
cd uniqn-mobile
rm src/components/auth/PhoneVerification.tsx
rm src/components/auth/PhoneVerifiedView.tsx
rm src/components/auth/phoneAuthErrors.ts
rm src/hooks/auth/useOTPVerification.ts
rm src/hooks/auth/usePhoneSMS.ts
rm "src/components/auth/__tests__/PhoneVerification.test.tsx"
```

- [ ] **Step 2: 타입 체크 — 남은 의존성 없는지 확인**

```bash
npx tsc --noEmit 2>&1 | head -30
```

예상: 출력 없음. 만약 에러가 나면 해당 import를 제거.

- [ ] **Step 3: 전체 테스트 실행**

```bash
npm test
```

예상: 204 test suites passed, skipped 0

- [ ] **Step 4: 커밋**

```bash
cd ..
git add -A
git commit -m "refactor(auth): Firebase SMS OTP 잔재 파일 삭제 — PortOne으로 대체 완료"
```

---

## Task 6: 최종 검증

- [ ] **Step 1: quality 체크 실행**

```bash
cd uniqn-mobile
npm run quality
```

예상: type-check 0 에러, lint 0 에러, format 통과

- [ ] **Step 2: 전체 테스트 재확인**

```bash
npm test
```

예상: 모든 테스트 PASS, skipped 0

- [ ] **Step 3: 최종 커밋 (docs 업데이트)**

변경사항이 있다면:

```bash
cd ..
git add -A
git commit -m "docs(design): PortOne 웹 본인인증 연동 완료 반영"
```
