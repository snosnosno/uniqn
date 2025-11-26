/**
 * 프로필 필수 필드 검증 유틸리티
 */

export interface ProfileValidationResult {
  isValid: boolean;
  missingFields: string[];
  missingFieldLabels: string[];
}

/**
 * 구인공고 지원을 위한 필수 프로필 필드 검증
 * ProfilePage의 필수 필드와 동일:
 * - nationality (국적)
 * - region (지역)
 * - phone (연락처)
 * - age (나이)
 * - experience (경력)
 */
export const validateRequiredProfileFields = (
  profileData: Record<string, unknown>
): ProfileValidationResult => {
  const requiredFields = [
    { field: 'nationality', label: '국적' },
    { field: 'region', label: '지역' },
    { field: 'phone', label: '연락처' },
    { field: 'age', label: '나이' },
    { field: 'experience', label: '경력' },
  ];

  const missingFields: string[] = [];
  const missingFieldLabels: string[] = [];

  requiredFields.forEach(({ field, label }) => {
    const value = profileData[field];
    // 값이 없거나 빈 문자열인 경우
    if (!value || value === '' || (typeof value === 'string' && value.trim() === '')) {
      missingFields.push(field);
      missingFieldLabels.push(label);
    }
  });

  return {
    isValid: missingFields.length === 0,
    missingFields,
    missingFieldLabels,
  };
};
