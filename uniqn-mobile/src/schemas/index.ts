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
} from './workLog.schema';

export type {
  WorkLogStatusSchema,
  WorkTimeModificationData,
  CreateWorkLogData,
  UpdateWorkLogData,
  ModifyWorkTimeData,
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
