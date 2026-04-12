# PortOne 웹 본인인증 연동 설계

**날짜**: 2026-04-12  
**상태**: 승인됨

---

## 목표

- `PhoneVerification.tsx` (Firebase SMS OTP stub) 완전 제거
- `PortOneIdentityVerification.web.tsx`를 `@portone/browser-sdk/v2`로 실제 구현
- 웹/네이티브 모두 동일한 PortOne 본인인증 UX 제공

---

## 아키텍처

```
SignupStepIdentity.tsx
  └─ isPortOneInicisIdentityConfigured() → true
       ├─ (native) PortOneIdentityVerification.tsx  [@portone/react-native-sdk]
       └─ (web)    PortOneIdentityVerification.web.tsx  [@portone/browser-sdk/v2]
             ├─ buildPortOneInicisIdentityRequest()  [재사용]
             ├─ PortOne.requestIdentityVerification() [신규]
             └─ callVerifyPortOneIdentity()  [재사용]
```

### 삭제 대상

| 파일                                                       | 이유                                          |
| ---------------------------------------------------------- | --------------------------------------------- |
| `src/components/auth/PhoneVerification.tsx`                | Firebase SMS OTP stub — PortOne으로 대체 완료 |
| `src/components/auth/PhoneVerifiedView.tsx`                | PhoneVerification 전용 서브컴포넌트           |
| `src/components/auth/phoneAuthErrors.ts`                   | Firebase 에러 코드 매핑 — 불필요              |
| `src/hooks/auth/useOTPVerification.ts`                     | Firebase OTP hook — stub화된 후 미사용        |
| `src/hooks/auth/usePhoneSMS.ts`                            | Firebase SMS hook — stub만 존재               |
| `src/components/auth/__tests__/PhoneVerification.test.tsx` | 삭제 대상 컴포넌트 테스트                     |

---

## 컴포넌트 설계: PortOneIdentityVerification.web.tsx

### Props (네이티브와 동일한 인터페이스)

```typescript
interface PortOneIdentityVerificationProps {
  onVerified: (identity: VerifiedPortOneIdentity) => void;
  onError?: (error: Error) => void;
  initialIdentity?: VerifiedPortOneIdentity | null;
  disabled?: boolean;
  customerId?: string;
  customerFullName?: string;
  customerPhoneNumber?: string;
}
```

### 상태 머신

```
idle → processing → verified
         ↓ (error)
       error (재시도 가능)
```

### 핵심 로직

```typescript
// SDK 실제 시그니처:
// requestIdentityVerification(request): Promise<IdentityVerificationResponse | undefined>
// - undefined: redirect 발생 (redirectUrl 미설정 시 발생하지 않음)
// - result.code 있음: 에러/취소
import { requestIdentityVerification } from '@portone/browser-sdk/v2';

const startVerification = async () => {
  const request = buildPortOneInicisIdentityRequest({
    customerId,
    customerFullName,
    customerPhoneNumber,
  });
  savePendingPortOneIdentityRequest(request);
  setIsProcessing(true);
  setErrorMessage(null);

  try {
    // redirectUrl 미설정 → iframe 방식 → result는 Promise로 반환
    const result = await requestIdentityVerification({
      storeId: request.storeId,
      channelKey: request.channelKey,
      identityVerificationId: request.identityVerificationId,
      bypass: request.bypass, // inicisUnified bypass 그대로 전달
      customData: request.customData,
    });

    // undefined → redirect 발생 (비정상)
    if (!result) throw new Error('본인인증 창이 닫혔습니다.');

    // 에러 코드 → 실패/취소
    if (result.code) {
      setIsProcessing(false);
      setErrorMessage(result.message ?? '본인인증이 완료되지 않았습니다.');
      return;
    }

    // Supabase Edge Function 검증 (기존 서비스 재사용)
    const verification = await callVerifyPortOneIdentity({
      identityVerificationId: result.identityVerificationId,
    });

    if (verification.hasDuplicatePhone) throw new Error('이미 가입된 휴대폰 번호입니다.');
    if (verification.hasDuplicateIdentity) throw new Error('이미 가입된 본인인증 정보입니다.');

    setVerifiedIdentity(verification.identity);
    onVerified(verification.identity);
  } catch (error) {
    // setErrorMessage + onError 콜백
  } finally {
    clearPendingPortOneIdentityRequest();
    setIsProcessing(false);
  }
};
```

### UI (네이티브와 동일한 구조)

- **미인증**: 회색 박스 + "본인인증 시작" 버튼
- **처리 중**: 버튼 비활성화 + "인증 확인 중..." 텍스트
- **완료**: 초록 박스 + 이름/생년월일/성별/휴대폰 표시 + "다시 인증하기" 버튼
- **에러**: 빨간 박스 + 에러 메시지

---

## SignupStepIdentity.tsx 변경

```typescript
// Before
const usePortOneIdentity = Platform.OS !== 'web' && isPortOneInicisIdentityConfigured();

// After
const usePortOneIdentity = isPortOneInicisIdentityConfigured();
// Platform import도 제거 (더 이상 사용 안 하면)
```

---

## 에러 처리

| 시나리오                         | 처리 방법                                             |
| -------------------------------- | ----------------------------------------------------- |
| PortOne SDK 에러 (네트워크)      | `setErrorMessage()` + `onError()` 콜백                |
| 사용자 취소 (`result.code` 존재) | `setErrorMessage('취소되었습니다.')`                  |
| 중복 전화번호                    | `setErrorMessage('이미 가입된 휴대폰 번호입니다.')`   |
| 중복 본인인증                    | `setErrorMessage('이미 가입된 본인인증 정보입니다.')` |
| 팝업 차단 가능성                 | PortOne SDK가 iframe 방식이므로 팝업 차단 무관        |

---

## 테스트 계획

### 삭제

- `src/components/auth/__tests__/PhoneVerification.test.tsx`

### 신규

`src/components/auth/__tests__/PortOneIdentityVerification.web.test.tsx`:

- `@portone/browser-sdk/v2` mock
- 인증 성공 → `onVerified` 호출 검증
- 사용자 취소 (code 있음) → 에러 메시지 표시
- `hasDuplicatePhone` → 에러 메시지
- `hasDuplicateIdentity` → 에러 메시지
- disabled 상태 → 버튼 비활성화

---

## 구현 순서

1. `PortOneIdentityVerification.web.tsx` 구현
2. `SignupStepIdentity.tsx` Platform 조건 제거
3. `components/auth/index.ts` PhoneVerification export 제거
4. 삭제 대상 파일 일괄 삭제
5. 테스트 작성 (`PortOneIdentityVerification.web.test.tsx`)
6. `npm run quality` + `npm test` 통과 확인
