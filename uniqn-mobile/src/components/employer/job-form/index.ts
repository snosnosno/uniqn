/**
 * UNIQN Mobile - 공고 작성 폼 컴포넌트 배럴 export
 *
 * @version 2.0.0 - 6단계 폼 + 타입별 Step2 분기
 */

// Step 1: 타입 선택 + 기본 정보
export { Step1BasicInfo } from './Step1BasicInfo';

// Step 2: 일정 (타입별 분기)
export { Step2DateTime } from './Step2DateTime';             // regular/urgent
export { Step2FixedSchedule } from './Step2FixedSchedule';   // fixed
export { Step2TournamentDates } from './Step2TournamentDates'; // tournament

// Step 3: 역할/인원
export { Step3Roles } from './Step3Roles';

// Step 4: 급여
export { Step4Salary } from './Step4Salary';

// Step 5: 사전질문 (선택)
export { Step5PreQuestions } from './Step5PreQuestions';

// Step 6: 최종 확인
export { Step6Confirm } from './Step6Confirm';

// Shared Components
export * from './shared';
