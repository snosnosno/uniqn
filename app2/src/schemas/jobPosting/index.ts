/**
 * JobPosting 통합 Zod 스키마
 *
 * 4개 섹션 스키마를 조합하여 전체 폼 검증
 *
 * @see app2/src/components/jobPosting/JobPostingForm/index.tsx
 */

import { z } from 'zod';
import { basicInfoSchema } from './basicInfo.schema';
import { dateRequirementsSchema } from './dateRequirements.schema';
import { preQuestionsSchema, preQuestionsSchemaBase } from './preQuestions.schema';
import { salarySchema, salarySchemaBase } from './salary.schema';
import { toISODateString } from '../../utils/dateUtils';

/**
 * 통합 JobPostingForm 검증 스키마
 *
 * 4개 섹션 스키마를 `.merge()`로 조합:
 * 1. basicInfoSchema (제목, 장소, 설명, 공고 타입)
 * 2. dateRequirementsSchema (날짜별 요구사항)
 * 3. preQuestionsSchemaBase (사전 질문 - base)
 * 4. salarySchemaBase (급여 정보 - base)
 */
export const jobPostingFormSchema = basicInfoSchema
  .merge(dateRequirementsSchema)
  .merge(preQuestionsSchemaBase)
  .merge(salarySchemaBase)
  .refine(
    (data) => {
      // Cross-field 검증: 긴급 공고는 오늘부터 최대 7일 후까지만 가능
      if (data.postingType === 'urgent' && data.dateSpecificRequirements.length > 0) {
        const firstRequirement = data.dateSpecificRequirements[0];
        if (!firstRequirement || !firstRequirement.date) return true; // 안전한 체크

        const firstDate = firstRequirement.date;
        const dateStr = typeof firstDate === 'string'
          ? firstDate
          : toISODateString(new Date(firstDate.seconds * 1000)) || '';

        if (!dateStr) return true; // 날짜 문자열이 없으면 통과

        const targetDate = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const diffDays = Math.floor((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // 오늘부터 7일 후까지만 허용 (0 <= diffDays <= 7)
        return diffDays >= 0 && diffDays <= 7;
      }
      return true;
    },
    {
      message: '긴급 공고는 오늘부터 최대 7일 이내의 날짜만 가능합니다',
      path: ['dateSpecificRequirements']
    }
  );

/**
 * TypeScript 타입 추론
 */
export type JobPostingFormData = z.infer<typeof jobPostingFormSchema>;

/**
 * 개별 스키마 재export (컴포넌트에서 직접 사용)
 */
export {
  basicInfoSchema,
  dateRequirementsSchema,
  preQuestionsSchema,
  salarySchema
};

/**
 * 개별 타입 재export
 */
export type { BasicInfoData } from './basicInfo.schema';
export type { DateRequirementsData, DateSpecificRequirementData, TimeSlotData, RoleRequirementData } from './dateRequirements.schema';
export type { PreQuestionsData, PreQuestionData, QuestionType } from './preQuestions.schema';
export type { SalaryData, BenefitsData, RoleSalaryData, SalaryType } from './salary.schema';
