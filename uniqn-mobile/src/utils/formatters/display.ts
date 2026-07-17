/**
 * 표시용 포맷터 — 역할·급여·상태·텍스트 라벨.
 *
 * 과거 동명 flat 파일(`src/utils/formatters.ts`)에 있던 함수들을 canonical
 * 배럴(`@/utils/formatters`)로 흡수한 것. flat 파일이 이 디렉토리를 가려
 * bare `@/utils/formatters` import가 파일 판으로 resolve 되던 그림자를 해소한다.
 * 출력 문자열은 flat 파일 판과 완전 동일(런타임 검증).
 */

import { SALARY_TYPE_LABELS, JOB_STATUS_LABELS } from '@/constants';
import { getRoleDisplayName } from '@/types/unified';
import type { StaffRole, UserRole } from '@/types';
import type { JobPostingStatus, SalaryType } from '@/types/jobPosting';
// formatCurrency 는 canonical currency 모듈 판(= flat 파일이 참조하던
// `@/utils/settlement`.formatCurrency 와 동일 바인딩, "₩1,234,567").
import { formatCurrency } from './currency';

/**
 * 이메일 마스킹 (h***@gmail.com)
 */
export const maskEmail = (email: string | undefined | null): string => {
  if (!email) return '';

  const [local, domain] = email.split('@');
  if (!local || !domain) return email;

  const maskedLocal = local.length <= 2 ? local[0] + '*' : local[0] + '***';

  return `${maskedLocal}@${domain}`;
};

/**
 * 역할 라벨 변환
 * @description getRoleDisplayName을 래핑하여 기존 API 유지
 */
export const formatRole = (role: StaffRole | UserRole | string | undefined): string => {
  if (!role) return '';
  return getRoleDisplayName(role);
};

/**
 * 복수 역할 라벨 변환
 */
export const formatRoles = (roles: string[] | undefined): string => {
  if (!roles || roles.length === 0) return '';
  return roles.map(formatRole).join(', ');
};

/**
 * 급여 타입 라벨 변환
 */
export const formatSalaryType = (type: SalaryType | string | undefined): string => {
  if (!type) return '';
  return SALARY_TYPE_LABELS[type as keyof typeof SALARY_TYPE_LABELS] || type;
};

/**
 * 급여 정보 포맷 (시급 ₩15,000)
 */
export const formatSalary = (type: SalaryType, amount: number): string => {
  return `${formatSalaryType(type)} ${formatCurrency(amount)}`;
};

/**
 * 공고 상태 라벨 변환
 */
export const formatJobStatus = (status: JobPostingStatus | string | undefined): string => {
  if (!status) return '';
  return JOB_STATUS_LABELS[status as keyof typeof JOB_STATUS_LABELS] || status;
};

/**
 * 모집 현황 포맷 (3/5명)
 */
export const formatPositions = (filled: number, total: number): string => {
  return `${filled}/${total}명`;
};

/**
 * 퍼센트 포맷
 */
export const formatPercent = (value: number, decimals: number = 0): string => {
  return `${value.toFixed(decimals)}%`;
};

/**
 * 파일 크기 포맷
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * 텍스트 줄임 (...)
 */
export const truncate = (text: string | undefined | null, maxLength: number): string => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
};

/**
 * 첫 글자 대문자 변환
 */
export const capitalize = (text: string | undefined | null): string => {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * 숫자 패딩 (01, 02, ...)
 */
export const padNumber = (num: number, length: number = 2): string => {
  return String(num).padStart(length, '0');
};

/**
 * 생년월일 포맷 (YYYYMMDD → YYYY.MM.DD)
 */
export const formatBirthDate = (birthDate: string | undefined | null): string => {
  if (!birthDate || birthDate.length !== 8) return '-';
  return `${birthDate.substring(0, 4)}.${birthDate.substring(4, 6)}.${birthDate.substring(6, 8)}`;
};

/**
 * 성별 라벨
 */
export const formatGenderLabel = (gender?: 'male' | 'female'): string => {
  if (gender === 'male') return '남성';
  if (gender === 'female') return '여성';
  return '확인 필요';
};
