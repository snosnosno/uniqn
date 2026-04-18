import type { AuthUser, UserProfile } from '@/types';

type IdentityProfile = Pick<UserProfile, 'name' | 'nickname' | 'photoURL' | 'photoURLBlurhash'>;
type IdentityAuthUser = Pick<AuthUser, 'displayName' | 'photoURL'>;

interface ResolveProfileIdentityOptions {
  userProfile?: IdentityProfile | null;
  userId?: string;
  fallbackName?: string;
  fallbackNickname?: string;
  fallbackPhotoURL?: string;
  fallbackPhotoURLBlurhash?: string | null;
}

export interface ProfileIdentity {
  baseName: string;
  displayName: string;
  nickname?: string;
  photoURL?: string;
  /** impeccable v2 §18 — photo placeholder 용 blurhash 해시 (DB null 허용) */
  photoURLBlurhash?: string | null;
}

interface BuildCurrentUserIdentityOptions {
  profile?: IdentityProfile | null;
  authUser?: IdentityAuthUser | null;
  fallbackName?: string;
}

export interface CurrentUserIdentitySnapshot extends ProfileIdentity {
  name?: string;
  preferredName?: string;
  reviewName?: string;
}

function resolveFallbackSafeField<Value>(
  userProfile: IdentityProfile | null | undefined,
  value: Value | null | undefined,
  fallbackValue: Value | undefined
): Value | undefined {
  if (userProfile === undefined || userProfile === null) {
    return fallbackValue;
  }

  return value ?? undefined;
}

export function resolveProfileIdentity({
  userProfile,
  userId,
  fallbackName,
  fallbackNickname,
  fallbackPhotoURL,
  fallbackPhotoURLBlurhash,
}: ResolveProfileIdentityOptions): ProfileIdentity {
  const nickname = resolveFallbackSafeField(userProfile, userProfile?.nickname, fallbackNickname);
  const namedBase = userProfile?.name || fallbackName;
  const baseName = namedBase || nickname || (userId ? userId.slice(-4) : '');
  const photoURL = resolveFallbackSafeField(userProfile, userProfile?.photoURL, fallbackPhotoURL);
  const photoURLBlurhash = resolveFallbackSafeField(
    userProfile,
    userProfile?.photoURLBlurhash ?? undefined,
    fallbackPhotoURLBlurhash ?? undefined
  );

  return {
    baseName,
    displayName:
      nickname && namedBase && nickname !== namedBase ? `${namedBase}(${nickname})` : baseName,
    nickname,
    photoURL,
    photoURLBlurhash: photoURLBlurhash ?? null,
  };
}

export function buildCurrentUserIdentitySnapshot({
  profile,
  authUser,
  fallbackName,
}: BuildCurrentUserIdentityOptions): CurrentUserIdentitySnapshot {
  const name = profile?.name || authUser?.displayName || fallbackName || undefined;
  const nickname = profile?.nickname ?? undefined;
  const baseName = name || nickname || fallbackName || '';
  const preferredName = profile?.name || profile?.nickname || authUser?.displayName || fallbackName;
  const reviewName = profile?.nickname || profile?.name || authUser?.displayName || fallbackName;
  const photoURL =
    profile?.photoURL !== undefined
      ? (profile.photoURL ?? undefined)
      : (authUser?.photoURL ?? undefined);
  const photoURLBlurhash = profile?.photoURLBlurhash ?? null;

  return {
    name,
    preferredName,
    reviewName,
    baseName,
    displayName: nickname && name && nickname !== name ? `${name}(${nickname})` : baseName,
    nickname,
    photoURL,
    photoURLBlurhash,
  };
}
