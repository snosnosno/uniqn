/**
 * UNIQN Mobile - 회원가입 Draft 영속화 서비스 (A2)
 *
 * @description 소셜/일반 가입 도중 강제 종료 시 약관 동의·단계 손실 방지.
 *              MMKV 에 stepIndex + 일부 form 데이터를 저장하고, SignupForm mount 시 복원.
 *              보안: password 는 절대 저장하지 않음. 사용자가 account 단계로 돌아오면 재입력 요구.
 *              TTL 24시간 — 그 이상은 stale 로 간주하고 자동 폐기.
 */

import { getStorageItem, removeStorageItem, setStorageItem, STORAGE_KEYS } from '@/lib/mmkvStorage';

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24h
export const SIGNUP_DRAFT_VERSION = 1;

export type SignupDraftMode = 'default' | 'social';

/**
 * Draft 본문. terms 의 boolean, identity 의 verified 결과는 저장하지만
 * account.password 는 보안 상 저장하지 않음 — 복원 시 사용자가 재입력해야 한다.
 */
export interface SignupDraftPayload {
  version: number;
  mode: SignupDraftMode;
  /** 소셜 모드일 때 OAuth user.id 와 1:1 바인딩 — 다른 계정의 draft 가 섞이지 않도록 */
  socialUserId?: string;
  stepIndex: number;
  formData: {
    terms?: unknown;
    /** 보안: account 는 email 만 유지 (password 제외). */
    accountEmail?: string;
    identity?: unknown;
  };
  savedAt: number;
}

export function saveSignupDraft(draft: Omit<SignupDraftPayload, 'version' | 'savedAt'>): void {
  const payload: SignupDraftPayload = {
    ...draft,
    version: SIGNUP_DRAFT_VERSION,
    savedAt: Date.now(),
  };
  setStorageItem(STORAGE_KEYS.SIGNUP_DRAFT, payload);
}

/**
 * Draft 복원. mode 가 일치하지 않거나, social 모드인데 다른 user 의 draft 이거나,
 * TTL 초과 시 자동 폐기 후 null 반환.
 */
export function loadSignupDraft(args: {
  mode: SignupDraftMode;
  socialUserId?: string;
}): SignupDraftPayload | null {
  const draft = getStorageItem<SignupDraftPayload>(STORAGE_KEYS.SIGNUP_DRAFT);
  if (!draft) return null;

  // 버전 불일치 — 스키마가 바뀐 경우 안전하게 폐기
  if (draft.version !== SIGNUP_DRAFT_VERSION) {
    clearSignupDraft();
    return null;
  }

  // TTL 초과
  if (Date.now() - draft.savedAt > DRAFT_TTL_MS) {
    clearSignupDraft();
    return null;
  }

  // 모드 불일치
  if (draft.mode !== args.mode) {
    return null;
  }

  // 소셜 모드: user binding 검증
  if (args.mode === 'social' && draft.socialUserId !== args.socialUserId) {
    return null;
  }

  return draft;
}

export function clearSignupDraft(): void {
  removeStorageItem(STORAGE_KEYS.SIGNUP_DRAFT);
}
