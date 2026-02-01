/**
 * UNIQN Mobile - Zod 스키마 중앙 인덱스
 *
 * @version 1.1.0 - Phase 1.5 공통 스키마 추가
 */

// 공통 스키마 (v1.1.0)
export {
  // Timestamp schemas
  timestampSchema,
  optionalTimestampSchema,
  nullableTimestampSchema,
  // Duration schemas (aliased to avoid conflict with assignment.schema)
  durationSchema as commonDurationSchema,
  optionalDurationSchema,
  // Metadata schema
  metadataSchema,
  optionalMetadataSchema,
  // Common field schemas
  documentIdSchema,
  emailSchema as commonEmailSchema,
  phoneSchema as commonPhoneSchema,
  dateStringSchema,
  timeStringSchema,
} from './common';

export type { TimestampInput, DurationInput, MetadataInput } from './common';

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
  // 문서 파서 (v2.0)
  jobPostingDocumentSchema,
  parseJobPostingDocument,
  parseJobPostingDocuments,
  isJobPostingDocument,
} from './jobPosting.schema';

export type {
  PostingType,
  SalaryTypeSchema,
  BasicInfoData,
  DateTimeData,
  CreateJobPostingFormData,
  JobFilterData,
  JobPostingDocumentData,
} from './jobPosting.schema';

// 지원서 스키마
export {
  applicationStatusSchema,
  staffRoleSchema,
  applicationMessageSchema as createApplicationMessageSchema,
  applicationFilterSchema,
  confirmApplicationSchema,
  rejectApplicationSchema,
  cancelApplicationSchema,
  // 문서 파서 (v2.0)
  applicationDocumentSchema,
  parseApplicationDocument,
  parseApplicationDocuments,
  isApplicationDocument,
} from './application.schema';

export type {
  ApplicationStatusSchema,
  StaffRoleSchema,
  ApplicationFilterData,
  ConfirmApplicationData,
  RejectApplicationData,
  CancelApplicationData,
  ApplicationDocumentData,
} from './application.schema';

// Assignment v3.0 스키마
export {
  roleIdsSchema,
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

// 스케줄 스키마
export {
  attendanceStatusSchema,
  scheduleTypeSchema,
  payrollStatusSchema,
  createScheduleEventSchema,
  scheduleFiltersSchema,
  qrCodeActionSchema,
} from './schedule.schema';

export type {
  AttendanceStatusSchema,
  ScheduleTypeSchema,
  PayrollStatusSchema,
  CreateScheduleEventData,
  ScheduleFiltersData,
  QRCodeActionSchema,
} from './schedule.schema';

// 근무 기록 스키마
export {
  workLogStatusSchema,
  workTimeModificationSchema,
  createWorkLogSchema,
  updateWorkLogSchema,
  modifyWorkTimeSchema,
  // 문서 파서 (v2.0)
  workLogDocumentSchema,
  parseWorkLogDocument,
  parseWorkLogDocuments,
  isWorkLogDocument,
} from './workLog.schema';

export type {
  WorkLogStatusSchema,
  WorkTimeModificationData,
  CreateWorkLogData,
  UpdateWorkLogData,
  ModifyWorkTimeData,
  WorkLogDocumentData,
} from './workLog.schema';

// 정산 스키마
export {
  settlementStatusSchema,
  settlementTypeSchema,
  settlementItemSchema,
  createSettlementSchema,
  settlementFiltersSchema,
  processSettlementSchema,
} from './settlement.schema';

export type {
  SettlementStatusSchema,
  SettlementTypeSchema,
  SettlementItemData,
  CreateSettlementData,
  SettlementFiltersData,
  ProcessSettlementData,
} from './settlement.schema';

// 사용자 스키마
export {
  userRoleSchema,
  userStatusSchema,
  updateProfileSchema,
  staffProfileSchema,
  employerProfileSchema,
  employerRegisterSchema,
  notificationSettingsSchema,
  userSettingsSchema,
  searchUsersSchema,
} from './user.schema';

export type {
  UserRoleSchema,
  UserStatusSchema,
  UpdateProfileData,
  StaffProfileData,
  EmployerProfileData,
  EmployerRegisterData,
  NotificationSettingsData,
  UserSettingsData,
  SearchUsersData,
} from './user.schema';

// 관리자 스키마
export {
  changeUserRoleSchema,
  changeUserStatusSchema,
  suspendUserSchema,
  reportTypeSchema,
  reportStatusSchema,
  createReportSchema,
  processReportSchema,
  announcementTypeSchema,
  createAnnouncementSchema,
  adminDashboardFiltersSchema,
} from './admin.schema';

export type {
  ChangeUserRoleData,
  ChangeUserStatusData,
  SuspendUserData,
  ReportTypeSchema,
  ReportStatusSchema,
  CreateReportData,
  ProcessReportData,
  AnnouncementTypeSchema,
  CreateAnnouncementData,
  AdminDashboardFiltersData,
} from './admin.schema';

// 알림 스키마
export {
  notificationTypeSchema,
  notificationCategorySchema,
  notificationPrioritySchema,
  createNotificationSchema,
  notificationFilterSchema,
  categoryNotificationSettingSchema,
  updateNotificationSettingsSchema,
  markNotificationReadSchema,
  deleteNotificationsSchema,
  markAllNotificationsReadSchema,
  // 문서 파서 (v2.0)
  notificationDocumentSchema,
  parseNotificationDocument,
  parseNotificationDocuments,
  isNotificationDocument,
  notificationSettingsDocumentSchema,
  parseNotificationSettingsDocument,
} from './notification.schema';

export type {
  NotificationTypeSchema,
  NotificationCategorySchema,
  NotificationPrioritySchema,
  CreateNotificationData,
  NotificationFilterData,
  CategoryNotificationSettingData,
  UpdateNotificationSettingsData,
  MarkNotificationReadData,
  DeleteNotificationsData,
  MarkAllNotificationsReadData,
  NotificationDocumentData,
  NotificationSettingsDocumentData,
} from './notification.schema';

// 페널티 스키마
export {
  penaltyTypeSchema,
  penaltyStatusSchema,
  penaltySeveritySchema,
  createPenaltySchema,
  updatePenaltySchema,
  penaltyFiltersSchema,
  appealPenaltySchema,
  processAppealSchema,
  PENALTY_DEFAULT_POINTS,
  SEVERITY_MULTIPLIERS,
} from './penalty.schema';

export type {
  PenaltyTypeSchema,
  PenaltyStatusSchema,
  PenaltySeveritySchema,
  CreatePenaltyData,
  UpdatePenaltyData,
  PenaltyFiltersData,
  AppealPenaltyData,
  ProcessAppealData,
} from './penalty.schema';

// 문의 스키마
export {
  inquiryCategorySchema,
  inquiryStatusSchema,
  inquirySubjectSchema,
  inquiryMessageSchema,
  inquiryAttachmentSchema,
  createInquirySchema,
  inquiryResponseSchema,
  respondInquirySchema,
  inquiryFilterSchema,
  faqItemSchema,
} from './inquiry.schema';

export type {
  InquiryCategorySchema,
  InquiryStatusSchema,
  InquiryAttachmentData,
  CreateInquiryFormData,
  RespondInquiryFormData,
  InquiryFilterData,
  FAQItemData,
} from './inquiry.schema';

// 대회공고 승인 스키마
export {
  tournamentApprovalStatusSchema,
  rejectionReasonSchema,
  approveTournamentSchema,
  rejectTournamentSchema,
  resubmitTournamentSchema,
  tournamentPostingFilterSchema,
} from './tournament.schema';

export type {
  TournamentApprovalStatusSchema,
  ApproveTournamentData,
  RejectTournamentData,
  ResubmitTournamentData,
  TournamentPostingFilterData,
} from './tournament.schema';

// 신고 스키마
export {
  employeeReportTypeSchema,
  employerReportTypeSchema,
  reportTypeUnionSchema,
  reporterTypeSchema,
  reportStatusUnionSchema,
  reportSeveritySchema,
  createReportInputSchema,
  reviewReportInputSchema,
  reportDocumentSchema,
  parseReportDocuments,
  parseReportDocument,
} from './report.schema';

export type {
  EmployeeReportTypeSchema,
  EmployerReportTypeSchema,
  ReportTypeUnionSchema,
  ReporterTypeSchemaData,
  ReportStatusUnionSchema,
  ReportSeveritySchema,
  CreateReportInputData,
  ReviewReportInputData,
  ReportDocumentData,
} from './report.schema';
