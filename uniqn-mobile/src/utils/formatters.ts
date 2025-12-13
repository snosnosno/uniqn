/**
 * UNIQN Mobile - 포맷팅 유틸리티
 *
 * @description 숫자, 통화, 전화번호 등 포맷팅 함수들
 * @version 1.0.0
 */

import { ROLE_LABELS, SALARY_TYPE_LABELS, JOB_STATUS_LABELS } from '@/constants';
import type { StaffRole, UserRole } from '@/types';
import type { JobPostingStatus, SalaryType } from '@/types/jobPosting';

/**
 * 숫자에 천 단위 콤마 추가
 */
export const formatNumber = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return '0';
  return value.toLocaleString('ko-KR');
};

/**
 * 금액 포맷 (₩ 포함)
 */
export const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return '₩0';
  return `₩${formatNumber(value)}`;
};

/**
 * 금액 간략 표시 (만원 단위)
 */
export const formatCurrencyShort = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return '0원';

  if (value >= 10000) {
    const man = Math.floor(value / 10000);
    const remainder = value % 10000;
    if (remainder > 0) {
      return `${man}만 ${formatNumber(remainder)}원`;
    }
    return `${man}만원`;
  }

  return `${formatNumber(value)}원`;
};

/**
 * 전화번호 포맷 (010-1234-5678)
 */
export const formatPhone = (phone: string | undefined | null): string => {
  if (!phone) return '';

  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  }

  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }

  return phone;
};

/**
 * 전화번호 마스킹 (010-****-5678)
 */
export const maskPhone = (phone: string | undefined | null): string => {
  if (!phone) return '';

  const formatted = formatPhone(phone);
  const parts = formatted.split('-');

  if (parts.length === 3) {
    return `${parts[0]}-****-${parts[2]}`;
  }

  return phone;
};

/**
 * 이름 마스킹 (홍*동, 김**)
 */
export const maskName = (name: string | undefined | null): string => {
  if (!name) return '';

  if (name.length <= 1) return name;

  if (name.length === 2) {
    return `${name[0]}*`;
  }

  return `${name[0]}${'*'.repeat(name.length - 2)}${name[name.length - 1]}`;
};

/**
 * 이메일 마스킹 (h***@gmail.com)
 */
export const maskEmail = (email: string | undefined | null): string => {
  if (!email) return '';

  const [local, domain] = email.split('@');
  if (!local || !domain) return email;

  const maskedLocal =
    local.length <= 2 ? local[0] + '*' : local[0] + '***';

  return `${maskedLocal}@${domain}`;
};

/**
 * 역할 라벨 변환
 */
export const formatRole = (role: StaffRole | UserRole | string | undefined): string => {
  if (!role) return '';
  return ROLE_LABELS[role as keyof typeof ROLE_LABELS] || role;
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
 * 급여 정보 포맷 (시급 15,000원)
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
