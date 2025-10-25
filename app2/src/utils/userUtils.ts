/**
 * 사용자 관련 유틸리티 함수
 */

/**
 * Firebase Auth의 displayName에서 실제 이름만 추출
 *
 * Firebase Auth의 displayName이 배열 형태로 저장된 경우:
 * "김승호 [{"role":"manager","phone":"010-9800-9039"}]" → "김승호"
 *
 * @param displayName - Firebase Auth의 displayName 필드
 * @returns 추출된 이름 또는 기본값
 *
 * @example
 * extractNameFromDisplayName("김승호 [{"phone":"010-1234-5678"}]") // "김승호"
 * extractNameFromDisplayName("홍길동") // "홍길동"
 * extractNameFromDisplayName(null) // "사용자"
 */
export function extractNameFromDisplayName(displayName: string | null | undefined): string {
  if (!displayName) return '사용자';

  // JSON 배열 형식이 포함된 경우 이름만 추출
  const match = displayName.match(/^(.+?)\s*\[/);
  if (match && match[1]) {
    return match[1].trim();
  }

  return displayName;
}

/**
 * 사용자 표시 이름 가져오기 (displayName 또는 email)
 *
 * @param displayName - Firebase Auth의 displayName
 * @param email - Firebase Auth의 email
 * @returns 표시할 이름
 *
 * @example
 * getUserDisplayName("김승호 [...]", "test@example.com") // "김승호"
 * getUserDisplayName(null, "test@example.com") // "test@example.com"
 */
export function getUserDisplayName(
  displayName: string | null | undefined,
  email: string | null | undefined
): string {
  const name = extractNameFromDisplayName(displayName);
  if (name !== '사용자') return name;
  return email || '사용자';
}

/**
 * 사용자 이니셜 가져오기 (아바타용)
 *
 * @param displayName - Firebase Auth의 displayName
 * @param email - Firebase Auth의 email
 * @returns 첫 글자 대문자
 *
 * @example
 * getUserInitial("김승호 [...]", "test@example.com") // "김"
 * getUserInitial(null, "test@example.com") // "T"
 */
export function getUserInitial(
  displayName: string | null | undefined,
  email: string | null | undefined
): string {
  const name = extractNameFromDisplayName(displayName);
  if (name !== '사용자') {
    return name[0]?.toUpperCase() || 'U';
  }
  return email?.[0]?.toUpperCase() || 'U';
}

/**
 * displayName에서 닉네임 추출
 *
 * Firebase Auth의 displayName이 JSON 배열 형태로 저장된 경우 닉네임을 추출
 * "김승호 [{"role":"manager","nickname":"김스노"}]" → "김스노"
 *
 * @param displayName - Firebase Auth의 displayName 필드
 * @returns 추출된 닉네임 또는 null
 *
 * @example
 * extractNicknameFromDisplayName("김승호 [{"nickname":"김스노"}]") // "김스노"
 * extractNicknameFromDisplayName("홍길동") // null
 */
export function extractNicknameFromDisplayName(displayName: string | null | undefined): string | null {
  if (!displayName) return null;

  // JSON 배열 형식이 포함된 경우 닉네임 추출
  const match = displayName.match(/\[(.+)\]/);
  if (match && match[1]) {
    try {
      const jsonData = JSON.parse(match[1]);
      if (jsonData.nickname) {
        return jsonData.nickname;
      }
    } catch {
      // JSON 파싱 실패 시 null 반환
      return null;
    }
  }

  return null;
}
