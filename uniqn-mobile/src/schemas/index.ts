/**
 * UNIQN Mobile - Zod 스키마 중앙 인덱스
 *
 * ⚠️ **실제로 `@/schemas` 경로로 소비되는 심볼만** 재수출한다. 스키마 대부분은
 * `@/schemas/<도메인>.schema` 직접 경로로 쓰이며, 그게 이 저장소의 지배적 관행이다.
 * 여기에 전량을 재수출하면 쓰이지 않는 재수출이 쌓여 진짜 죽은 코드가 안 보인다.
 * 새 심볼이 배럴 경유로 필요해지면 그때 이 목록에 추가하라.
 *
 * @version 2.0.0
 */

// 인증 스키마
export {
  loginSchema,
  resetPasswordSchema,
  signUpAccountSchema,
  signUpIdentitySchema,
  signUpProfileSchema,
  signUpTermsSchema,
} from './auth.schema';

export type {
  LoginFormData,
  ResetPasswordFormData,
  SignUpAccountData,
  SignUpFormData,
  SignUpIdentityData,
  SignUpProfileData,
  SignUpTermsData,
} from './auth.schema';

// 구인공고 스키마
export { parseJobPostingDocument } from './jobPosting.schema';

// 지원서 스키마
export {
  confirmApplicationSchema,
  parseApplicationDocument,
  rejectApplicationSchema,
} from './application.schema';

// 근무 기록 스키마
export { parseWorkLogDocument, parseWorkLogDocuments } from './workLog.schema';

// 사용자 스키마
export { employerIntroSchema, parseUserDocument } from './user.schema';

// 알림 스키마
export { parseNotificationSettingsDocument } from './notification.schema';

// 문의 스키마
export {
  attachInquiryFilesSchema,
  createInquirySchema,
  respondInquirySchema,
} from './inquiry.schema';

// 대회공고 승인 스키마
export type {
  ApproveTournamentData,
  RejectTournamentData,
  ResubmitTournamentData,
} from './tournament.schema';

// 신고 스키마
export { createReportInputSchema, reviewReportInputSchema } from './report.schema';
