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
  signUpStep4Schema,
  signUpSchema,
  resetPasswordSchema,
  verificationCodeSchema,
} from './auth.schema';

export type {
  LoginFormData,
  SignUpStep1Data,
  SignUpStep2Data,
  SignUpStep3Data,
  SignUpStep4Data,
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

// 지원서 스키마
export {
  applicationStatusSchema,
  staffRoleSchema,
  applicationMessageSchema as createApplicationMessageSchema,
  createApplicationSchema,
  applicationFilterSchema,
  confirmApplicationSchema,
  rejectApplicationSchema,
  cancelApplicationSchema,
} from './application.schema';

export type {
  ApplicationStatusSchema,
  StaffRoleSchema,
  CreateApplicationFormData,
  ApplicationFilterData,
  ConfirmApplicationData,
  RejectApplicationData,
  CancelApplicationData,
} from './application.schema';

// Assignment v2.0 스키마
export {
  roleSchema as assignmentRoleSchema,
  rolesArraySchema,
  timeSlotSchema,
  dateSchema,
  datesArraySchema,
  durationTypeSchema,
  durationSchema,
  checkMethodSchema,
  assignmentSchema,
  assignmentsArraySchema,
  createApplicationV2Schema,
  confirmApplicationV2Schema,
  cancelConfirmationSchema,
} from './assignment.schema';

export type {
  AssignmentFormData,
  AssignmentsArrayData,
  CreateApplicationV2FormData,
  ConfirmApplicationV2Data,
  CancelConfirmationData,
} from './assignment.schema';

// 사전질문 스키마
export {
  preQuestionTypeSchema,
  preQuestionSchema,
  preQuestionsArraySchema,
  preQuestionAnswerSchema,
  preQuestionAnswersArraySchema,
  validateRequiredAnswersSchema,
  createApplicationWithPreQuestionsSchema,
} from './preQuestion.schema';

export type {
  PreQuestionTypeData,
  PreQuestionFormData,
  PreQuestionsArrayData,
  PreQuestionAnswerData,
  PreQuestionAnswersArrayData,
  CreateApplicationWithPreQuestionsData,
} from './preQuestion.schema';
