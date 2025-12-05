/**
 * BasicInfoSection Props 타입
 *
 * @see app2/src/components/jobPosting/JobPostingForm/sections/BasicInfoSection.tsx
 */

import { SectionProps, ValidationState } from './sectionProps';
import { PostingType, FixedConfig } from './jobPosting';

/**
 * BasicInfo 섹션 데이터
 */
export interface BasicInfoData {
  /** 공고 제목 */
  title: string;

  /** 근무 장소 */
  location: string;

  /** 시/군/구 (선택) */
  district?: string;

  /** 상세 주소 (선택) */
  detailedAddress?: string;

  /** 공고 설명 */
  description: string;

  /** 공고 타입 */
  postingType: PostingType;

  /** 문의 연락처 (선택) */
  contactPhone?: string;

  /** 고정공고 설정 (postingType이 'fixed'일 때) */
  fixedConfig?: FixedConfig;
}

/**
 * BasicInfo 섹션 이벤트 핸들러
 */
export interface BasicInfoHandlers {
  /**
   * 폼 입력 변경 핸들러
   * - title, description, contactPhone 등
   */
  onFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;

  /**
   * 장소 변경 핸들러
   * - location과 district를 함께 변경
   */
  onLocationChange: (location: string, district?: string) => void;

  /**
   * 공고 타입 변경 핸들러
   * - 대회공고 선택 시 tournamentConfig 설정 필요
   */
  onPostingTypeChange: (postingType: PostingType) => void;

  /**
   * 고정공고 기간 변경 핸들러
   * - 7일/30일/90일 선택 시 호출
   */
  onFixedDurationChange?: (durationDays: 7 | 30 | 90) => void;
}

/**
 * BasicInfo 섹션 검증 에러
 */
export interface BasicInfoErrors {
  title?: string;
  location?: string;
  district?: string;
  detailedAddress?: string;
  description?: string;
  postingType?: string;
  contactPhone?: string;
}

/**
 * BasicInfo 섹션 검증 상태
 */
export type BasicInfoValidation = ValidationState<BasicInfoErrors>;

/**
 * BasicInfoSection Props
 */
export interface BasicInfoSectionProps
  extends SectionProps<BasicInfoData, BasicInfoHandlers, BasicInfoValidation> {
  /**
   * 폼 모드
   * - 'create': 공고 작성 모드 (기본값)
   * - 'edit': 공고 수정 모드 (공고 타입 변경 불가)
   */
  mode?: 'create' | 'edit';

  /**
   * 수정 중 비활성화 상태
   */
  isDisabled?: boolean;
}
