# Phase 1B: Supabase Client + Auth Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Firebase Auth with Supabase Auth across the entire app — login, signup, Apple Sign-In, session management, and app initialization.

**Architecture:** `supabase-js` single SDK replaces Firebase Web SDK + Native SDK dual setup. All `httpsCallable` auth functions become `supabase.functions.invoke()` or `supabase.rpc()`. Phone SMS auth is removed (replaced by PortOne identity verification). The `authBridge.ts` dual SDK sync layer is deleted entirely.

**Tech Stack:** @supabase/supabase-js, Expo AsyncStorage, Zustand persist, expo-apple-authentication

**Supabase Project:** `ygfxukhktpqymahfrvbz` (ap-northeast-2)

---

## File Map

| Action | File                                                                  | Responsibility                             |
| ------ | --------------------------------------------------------------------- | ------------------------------------------ |
| CREATE | `src/lib/supabase.ts`                                                 | Supabase client singleton                  |
| MODIFY | `src/lib/env.ts`                                                      | Add Supabase env validation                |
| MODIFY | `src/services/auth/authTypes.ts`                                      | Replace FirebaseUser with Supabase User    |
| MODIFY | `src/stores/authStore.ts`                                             | Replace FirebaseUser, remove dual SDK      |
| MODIFY | `src/services/auth/authCoreService.ts`                                | Replace all Firebase Auth calls            |
| MODIFY | `src/services/auth/socialLoginService.ts`                             | Apple Sign-In via Supabase                 |
| MODIFY | `src/services/auth/profileService.ts`                                 | Remove getFirebaseAuth                     |
| MODIFY | `src/services/auth/accountDeletionService.ts`                         | Edge Function for deletion                 |
| MODIFY | `src/services/auth/portOneIdentityService.ts`                         | supabase.functions.invoke                  |
| MODIFY | `src/services/auth/authorizationService.ts`                           | Remove Firebase imports                    |
| MODIFY | `src/hooks/useAppInitialize.ts`                                       | Remove Firebase boot, use Supabase session |
| MODIFY | `src/hooks/internal/appInitializeAuthSession.ts`                      | Supabase session resolution                |
| MODIFY | `src/hooks/auth/useCurrentUser.ts`                                    | Supabase user check                        |
| MODIFY | `src/hooks/useBiometricAuth.ts`                                       | Remove getFirebaseAuth                     |
| MODIFY | `src/services/boardService.ts`                                        | Remove getFirebaseAuth                     |
| MODIFY | `src/services/admin/tournamentApprovalService.ts`                     | supabase.functions.invoke                  |
| MODIFY | `src/services/notifications/internal/notificationReadStateService.ts` | supabase.rpc                               |
| DELETE | `src/lib/nativeAuth.ts`                                               | Dual SDK unnecessary                       |
| DELETE | `src/lib/authBridge.ts`                                               | Dual SDK sync unnecessary                  |
| DELETE | `src/hooks/auth/usePhoneSMS.ts`                                       | PortOne replaces Phone SMS                 |
| DELETE | `src/hooks/auth/useRecaptcha.ts`                                      | Supabase doesn't need reCAPTCHA            |
| DELETE | `src/hooks/auth/useOTPVerification.ts`                                | PortOne replaces OTP                       |

---

## Task 1: Supabase Client + Env Setup

**Files:**

- Create: `src/lib/supabase.ts`
- Modify: `src/lib/env.ts`
- Run: `npm install @supabase/supabase-js`

- [ ] **Step 1: Install supabase-js**

```bash
cd uniqn-mobile && npm install @supabase/supabase-js
```

- [ ] **Step 2: Add Supabase env vars to env.ts**

Add to the Zod schema in `src/lib/env.ts`:

```typescript
// Add alongside existing Firebase vars (don't remove them yet)
EXPO_PUBLIC_SUPABASE_URL: z.string().url(),
EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
```

- [ ] **Step 3: Create `src/lib/supabase.ts`**

```typescript
/**
 * UNIQN Mobile - Supabase Client
 *
 * @description 단일 Supabase 클라이언트 인스턴스
 * Firebase의 Lazy Proxy 패턴 대신 직접 초기화 (supabase-js는 즉시 사용 가능)
 */

import 'react-native-url-polyfill/dist/polyfill';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getEnv } from './env';

function createSupabaseClient() {
  const env = getEnv();
  return createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      storage: Platform.OS === 'web' ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  });
}

let _client: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!_client) {
    _client = createSupabaseClient();
  }
  return _client;
}

export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_, prop) {
    const client = getSupabaseClient();
    const value = (client as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
```

- [ ] **Step 4: Verify import works**

```bash
cd uniqn-mobile && npx tsc --noEmit src/lib/supabase.ts 2>&1 | head -5
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase.ts src/lib/env.ts package.json package-lock.json
git commit -m "feat(mobile): Supabase 클라이언트 초기화 모듈 생성"
```

---

## Task 2: Auth Types + Auth Store Migration

**Files:**

- Modify: `src/services/auth/authTypes.ts`
- Modify: `src/stores/authStore.ts`

- [ ] **Step 1: Rewrite authTypes.ts**

Replace `FirebaseUser` with Supabase `User`. Replace `httpsCallable` with `supabase.functions.invoke`.

Key changes:

- `import type { User as SupabaseUser } from '@supabase/supabase-js'` replaces `User as FirebaseUser`
- `AuthResult.user` type changes from `FirebaseUser` to `SupabaseUser`
- `callVerifyAndSaveProfile` changes from `httpsCallable(functions, 'verifyAndSaveProfile')(payload)` to `supabase.functions.invoke('verify-and-save-profile', { body: payload })`

- [ ] **Step 2: Update authStore.ts**

Key changes in store:

- `import type { User as SupabaseUser } from '@supabase/supabase-js'` replaces `FirebaseUser`
- `setUser(user: SupabaseUser | null)` — convert to `AuthUser`:
  ```typescript
  const toAuthUser = (user: SupabaseUser): AuthUser => ({
    uid: user.id,
    email: user.email ?? '',
    displayName: user.user_metadata?.name ?? null,
    photoURL: user.user_metadata?.avatar_url ?? null,
    emailVerified: user.email_confirmed_at != null,
    phoneNumber: user.phone ?? null,
    providerIds: user.app_metadata?.providers ?? [],
  });
  ```
- Remove `syncSignOut()` import from `authBridge` — use `supabase.auth.signOut()` directly
- `checkAuthState()`: use `supabase.auth.getUser()` instead of `getFirebaseAuth().currentUser`
- Remove all `getFirebaseAuth()` references

- [ ] **Step 3: Run quality check**

```bash
npm run type-check 2>&1 | head -30
```

Expect: type errors in files that still import old types (authCoreService, etc.) — that's OK for now.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(mobile): authTypes + authStore를 Supabase User 타입으로 전환"
```

---

## Task 3: Auth Core Service Rewrite

**Files:**

- Modify: `src/services/auth/authCoreService.ts` (1,394 lines → ~800 lines)

- [ ] **Step 1: Replace all Firebase Auth calls**

| Current Firebase Call                                   | Supabase Replacement                                                                   |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `signInWithEmailAndPassword(auth, email, password)`     | `supabase.auth.signInWithPassword({ email, password })`                                |
| `createUserWithEmailAndPassword(auth, email, password)` | `supabase.auth.signUp({ email, password, options: { data: { name, nickname } } })`     |
| `sendPasswordResetEmail(auth, email)`                   | `supabase.auth.resetPasswordForEmail(email)`                                           |
| `reauthenticateWithCredential(user, credential)`        | `supabase.auth.signInWithPassword({ email, password })` (re-auth is just re-sign-in)   |
| `deleteUser(user)` / `nativeDeleteUser(user)`           | `supabase.functions.invoke('delete-account')`                                          |
| `getFirebaseAuth().currentUser`                         | `(await supabase.auth.getUser()).data.user`                                            |
| `onAuthStateChanged(auth, callback)`                    | `supabase.auth.onAuthStateChange((event, session) => callback(session?.user ?? null))` |
| `syncToWebAuth(email, password)`                        | DELETE (single SDK)                                                                    |
| `syncSignOut()`                                         | `supabase.auth.signOut()`                                                              |
| `httpsCallable(functions, 'checkEmailExists')`          | `supabase.rpc('check_email_exists', { p_email: email })` or Edge Function              |
| `httpsCallable(functions, 'checkNicknameExists')`       | `supabase.rpc('check_nickname_exists', { p_nickname: nickname })`                      |
| `httpsCallable(functions, 'checkPhoneExists')`          | `supabase.rpc('check_phone_exists', { p_phone: phone })`                               |

- [ ] **Step 2: Remove all Dual SDK code**

Delete these patterns throughout the file:

- All `nativeSignInWithEmailAndPassword` calls
- All `nativeLinkWithCredential` calls
- All `nativeDeleteUser` / `nativeUnlink` calls
- All `syncToWebAuth()` calls
- `import { ... } from '@/lib/nativeAuth'` → DELETE
- `import { syncToWebAuth, syncSignOut } from '@/lib/authBridge'` → DELETE

- [ ] **Step 3: Create RPC functions for existence checks**

Apply Supabase migration for the check functions:

```sql
-- check_email_exists
CREATE OR REPLACE FUNCTION check_email_exists(p_email TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(SELECT 1 FROM public.users WHERE email = p_email);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- check_nickname_exists
CREATE OR REPLACE FUNCTION check_nickname_exists(p_nickname TEXT, p_exclude_uid UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.users
    WHERE nickname = p_nickname
    AND (p_exclude_uid IS NULL OR id != p_exclude_uid)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- check_phone_exists
CREATE OR REPLACE FUNCTION check_phone_exists(p_phone TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(SELECT 1 FROM public.users WHERE phone = p_phone);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
```

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(mobile): authCoreService를 Supabase Auth로 전면 교체"
```

---

## Task 4: Social Login (Apple Sign-In) Rewrite

**Files:**

- Modify: `src/services/auth/socialLoginService.ts` (1,135 lines → ~500 lines)
- Keep: `src/services/auth/appleAuthService.ts` (unchanged — pure native, no Firebase)

- [ ] **Step 1: Replace Apple Sign-In flow**

Current flow:

```
expo-apple-auth → identityToken + rawNonce → OAuthProvider.credential('apple.com') → signInWithCredential(auth, credential)
```

New flow:

```
expo-apple-auth → identityToken + rawNonce → supabase.auth.signInWithIdToken({ provider: 'apple', token: identityToken, nonce: rawNonce })
```

Key change in `signInWithApple()`:

```typescript
// BEFORE
const appleCredential = OAuthProvider.credential('apple.com', idToken, rawNonce);
const userCredential = await signInWithCredential(getFirebaseAuth(), appleCredential);

// AFTER
const { data, error } = await supabase.auth.signInWithIdToken({
  provider: 'apple',
  token: idToken,
  nonce: rawNonce,
});
if (error) throw error;
const user = data.user;
```

- [ ] **Step 2: Remove mock social providers**

Delete `signInWithGoogle()` and `signInWithKakao()` mock implementations (or replace with Supabase OAuth if needed later).

- [ ] **Step 3: Remove all Firebase imports**

Delete: `signInWithCredential`, `OAuthProvider`, `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `updateProfile` from firebase/auth.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(mobile): Apple Sign-In을 Supabase signInWithIdToken으로 전환"
```

---

## Task 5: Delete Unnecessary Auth Files

**Files:**

- Delete: `src/lib/nativeAuth.ts` (81 lines)
- Delete: `src/lib/authBridge.ts` (161 lines)
- Delete: `src/hooks/auth/usePhoneSMS.ts` (466 lines — PortOne replaces Phone SMS)
- Delete: `src/hooks/auth/useRecaptcha.ts` (135 lines — Supabase doesn't need reCAPTCHA)
- Delete: `src/hooks/auth/useOTPVerification.ts` (if exists)

- [ ] **Step 1: Delete files**

```bash
rm src/lib/nativeAuth.ts src/lib/authBridge.ts
rm src/hooks/auth/usePhoneSMS.ts src/hooks/auth/useRecaptcha.ts
```

- [ ] **Step 2: Remove all imports of deleted files**

Search and update any files that import from the deleted modules:

```bash
grep -r "from '@/lib/nativeAuth'" src/ --include="*.ts" --include="*.tsx"
grep -r "from '@/lib/authBridge'" src/ --include="*.ts" --include="*.tsx"
grep -r "from '@/hooks/auth/usePhoneSMS'" src/ --include="*.ts" --include="*.tsx"
grep -r "from '@/hooks/auth/useRecaptcha'" src/ --include="*.ts" --include="*.tsx"
```

Remove or replace every import found.

- [ ] **Step 3: Update barrel exports**

Update `src/hooks/auth/index.ts` and `src/lib/index.ts` to remove deleted exports.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(mobile): Dual SDK + Phone SMS + reCAPTCHA 코드 삭제"
```

---

## Task 6: Remaining Auth-Adjacent File Updates

**Files:**

- Modify: `src/hooks/auth/useCurrentUser.ts`
- Modify: `src/hooks/useBiometricAuth.ts`
- Modify: `src/services/auth/profileService.ts`
- Modify: `src/services/auth/authorizationService.ts`
- Modify: `src/services/auth/accountDeletionService.ts`
- Modify: `src/services/auth/portOneIdentityService.ts`
- Modify: `src/services/boardService.ts`
- Modify: `src/services/admin/tournamentApprovalService.ts`
- Modify: `src/services/notifications/internal/notificationReadStateService.ts`

- [ ] **Step 1: Update useCurrentUser.ts**

Replace `getFirebaseAuth().currentUser` with `supabase.auth.getUser()`.

- [ ] **Step 2: Update service files**

For each file, replace:

- `getFirebaseAuth()` → `supabase.auth.getUser()` or `supabase.auth.getSession()`
- `httpsCallable(getFirebaseFunctions(), 'functionName')` → `supabase.functions.invoke('function-name')` or `supabase.rpc('function_name')`
- `getFirebaseDb()` → `supabase` client

Specific mappings:

- `tournamentApprovalService.ts`: `httpsCallable('approveJobPosting')` → `supabase.functions.invoke('approve-job-posting')`
- `notificationReadStateService.ts`: `httpsCallable('resetUnreadCounter')` → `supabase.rpc('reset_unread_counter')`
- `portOneIdentityService.ts`: `httpsCallable('verifyPortOneIdentity')` → `supabase.functions.invoke('verify-portone-identity')`
- `accountDeletionService.ts`: `httpsCallable('forceDeleteAccount')` → `supabase.functions.invoke('force-delete-account')`

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor(mobile): Auth 관련 서비스/훅 Firebase 의존 일괄 교체"
```

---

## Task 7: App Initialization Rewrite

**Files:**

- Modify: `src/hooks/useAppInitialize.ts` (967 lines → ~500 lines)
- Modify: `src/hooks/internal/appInitializeAuthSession.ts`

- [ ] **Step 1: Simplify bootstrapCore()**

Remove:

- `tryInitializeFirebase()` → Supabase auto-initializes on import
- `ensureDualSdkSync()` → DELETE (single SDK)
- `refreshRoleClaims()` → DELETE (role is in app_metadata, always fresh in JWT)

Replace:

- `checkForceUpdate()` → `supabase.from('app_config').select('value').eq('key', 'force_update_version').single()`
- `waitForInitialAuthUser()` → `supabase.auth.getSession()`
- `loadLatestProfile(uid)` → `supabase.from('users').select('*').eq('id', uid).single()`

- [ ] **Step 2: Simplify resolveSession()**

Replace `waitForFirebaseAuthToSettle()` with `supabase.auth.getSession()`.
Remove `refreshCustomRoleClaims()` — role is already in JWT via `app_metadata`.

- [ ] **Step 3: Update appInitializeAuthSession.ts**

Replace Firebase auth listener with:

```typescript
const {
  data: { session },
} = await supabase.auth.getSession();
return session?.user ?? null;
```

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(mobile): useAppInitialize를 Supabase 세션 기반으로 재작성"
```

---

## Task 8: Create RPC Functions for Auth Checks

**Purpose:** Supabase migrations for functions called by the auth service.

- [ ] **Step 1: Apply migration**

Use Supabase MCP `apply_migration` with name `create_auth_rpc_functions`:

```sql
-- Existence checks (used by authCoreService)
CREATE OR REPLACE FUNCTION check_email_exists(p_email TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(SELECT 1 FROM public.users WHERE email = p_email);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION check_nickname_exists(p_nickname TEXT, p_exclude_uid UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.users WHERE nickname = p_nickname
    AND (p_exclude_uid IS NULL OR id != p_exclude_uid)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION check_phone_exists(p_phone TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(SELECT 1 FROM public.users WHERE phone = p_phone);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Unread counter management (used by notificationReadStateService)
CREATE OR REPLACE FUNCTION reset_unread_counter(p_user_id UUID)
RETURNS VOID AS $$
  UPDATE public.notifications SET is_read = TRUE, read_at = now()
  WHERE recipient_id = p_user_id AND is_read = FALSE;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION decrement_unread_counter(p_notification_id UUID)
RETURNS VOID AS $$
  UPDATE public.notifications SET is_read = TRUE, read_at = now()
  WHERE id = p_notification_id AND is_read = FALSE;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Auto-create user profile on auth signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE((NEW.raw_app_meta_data ->> 'role')::user_role, 'staff')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

- [ ] **Step 2: Verify**

```sql
SELECT check_email_exists('test@test.com'); -- should return false
```

- [ ] **Step 3: Commit note**

No git commit needed — this is a Supabase migration, not app code.

---

## Task 9: Final Verification

- [ ] **Step 1: Run quality check**

```bash
cd uniqn-mobile && npm run quality
```

Expected: 0 errors, 0 warnings (or only pre-existing warnings).

- [ ] **Step 2: Verify no Firebase Auth imports in modified files**

```bash
grep -r "from 'firebase/auth'" src/services/auth/ src/stores/authStore.ts src/hooks/auth/ src/hooks/useAppInitialize.ts --include="*.ts"
```

Expected: 0 results (Firebase Auth imports remain only in `src/repositories/firebase/` which is Phase 2 scope).

- [ ] **Step 3: Verify deleted files don't exist**

```bash
ls src/lib/nativeAuth.ts src/lib/authBridge.ts src/hooks/auth/usePhoneSMS.ts src/hooks/auth/useRecaptcha.ts 2>&1
```

Expected: "No such file or directory" for all 4 files.

- [ ] **Step 4: Commit all remaining changes**

```bash
git add -A && git commit -m "feat(mobile): Phase 1B 완료 — Supabase Auth 전면 전환"
```
