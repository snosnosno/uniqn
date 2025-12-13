/**
 * UNIQN Mobile - Zod 스키마 중앙 인덱스
 *
 * @version 1.0.0
 */

// 인증 스키마
export {
  emailSchema,
  passwordSchema,
  nameSchema,
  nicknameSchema,
  phoneSchema,
  roleSelectSchema,
  loginSchema,
  signUpStep1Schema,
  signUpStep2Schema,
  signUpStep3Schema,
  signUpSchema,
  resetPasswordSchema,
  verificationCodeSchema,
} from './auth.schema';

export type {
  LoginFormData,
  SignUpStep1Data,
  SignUpStep2Data,
  SignUpStep3Data,
  SignUpFormData,
  ResetPasswordFormData,
  VerificationCodeData,
} from './auth.schema';

// 구인공고 스키마
export {
  postingTypeSchema,
  salaryTypeSchema,
  roleSchema,
  roleRequirementSchema,
  salaryInfoSchema,
  allowancesSchema,
  basicInfoSchema,
  dateTimeSchema,
  createJobPostingSchema,
  jobFilterSchema,
  applicationMessageSchema,
} from './jobPosting.schema';

export type {
  PostingType,
  SalaryTypeSchema,
  BasicInfoData,
  DateTimeData,
  CreateJobPostingFormData,
  JobFilterData,
} from './jobPosting.schema';
