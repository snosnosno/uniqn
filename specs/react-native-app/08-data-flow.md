# 08. 핵심 데이터 흐름 설계

> **타입 참조**: 이 문서의 모든 타입 정의는 [23-api-reference.md](./23-api-reference.md)를 권위 있는 소스로 합니다.
> - `UserRole` vs `StaffRole` 구분: 23-api-reference.md의 "Role 타입 정의" 섹션 참조
> - `users` vs `staff` 컬렉션 책임: 23-api-reference.md의 "users vs staff 컬렉션 책임 분리" 섹션 참조

## 전체 비즈니스 플로우

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         UNIQN 핵심 데이터 흐름                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  공고작성  │───▶│   지원    │───▶│   확정    │───▶│  출퇴근   │───▶│   정산    │
│ (매니저)  │    │ (스태프)  │    │ (매니저)  │    │  (QR)    │    │ (매니저)  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │               │
     ▼               ▼               ▼               ▼               ▼
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│jobPostings│    │applications│   │applications│   │ workLogs  │    │ workLogs │
│  CREATE   │    │  CREATE   │    │  UPDATE   │    │  UPDATE   │    │  UPDATE  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │               │
     ▼               ▼               ▼               ▼               ▼
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  알림 →   │    │  알림 →   │    │  알림 →   │    │  상태 →   │    │  알림 →   │
│ (관리자)  │    │ (매니저)  │    │ (스태프)  │    │ (실시간)  │    │ (스태프)  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

---

## 1. 공고 작성 플로우

### 데이터 모델
```typescript
// src/types/jobPosting.ts
interface JobPosting {
  // 기본 정보
  id: string;
  creatorId: string;
  creatorName: string;
  title: string;
  description: string;

  // 위치
  location: {
    address: string;
    district: string;      // 구 (강남구)
    city: string;          // 시 (서울)
    coordinates?: {
      lat: number;
      lng: number;
    };
  };

  // 근무 조건
  postingType: 'regular' | 'fixed' | 'urgent';
  dates: string[];         // ['2024-12-20', '2024-12-21']
  timeSlot: {
    startTime: string;     // '18:00'
    endTime: string;       // '02:00'
  };

  // 고정 공고 전용
  fixedConfig?: {
    daysOfWeek: number[];  // [5, 6] (금, 토)
    startDate: string;
    endDate?: string;
  };

  // 역할 및 급여
  roles: JobRole[];

  // 추가 정보
  benefits: string[];
  requirements: string[];
  preQuestions: PreQuestion[];

  // 상태
  status: 'draft' | 'pending_approval' | 'active' | 'closed' | 'cancelled';
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;

  // 통계
  applicantCount: number;
  confirmedCount: number;

  // 칩 비용
  chipCost: number;
  chipDeducted: boolean;

  // 타임스탬프
  createdAt: Timestamp;
  updatedAt: Timestamp;
  publishedAt?: Timestamp;
}

interface JobRole {
  id: string;
  name: string;           // '딜러', '서버', '플로어'
  count: number;          // 모집 인원
  salary: number;         // 일당
  confirmedCount: number; // 확정 인원
}

interface PreQuestion {
  id: string;
  question: string;
  required: boolean;
}
```

### 공고 작성 서비스
```typescript
// src/services/job/jobPostingCreateService.ts
import firestore from '@react-native-firebase/firestore';
import { notificationService } from '@/services/notification';
import { chipService } from '@/services/chip';
import { validateJobPosting } from '@/schemas/jobPosting.schema';

export const jobPostingCreateService = {
  /**
   * 공고 작성 (초안 저장)
   */
  async saveDraft(
    userId: string,
    data: Partial<JobPosting>
  ): Promise<string> {
    const docRef = await firestore().collection('jobPostings').add({
      ...data,
      creatorId: userId,
      status: 'draft',
      applicantCount: 0,
      confirmedCount: 0,
      chipDeducted: false,
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    return docRef.id;
  },

  /**
   * 공고 제출 (승인 요청)
   */
  async submitForApproval(
    postingId: string,
    data: JobPosting
  ): Promise<void> {
    // 1. 유효성 검증
    const validation = validateJobPosting(data);
    if (!validation.success) {
      throw new ValidationError(validation.errors);
    }

    // 2. 칩 비용 계산
    const chipCost = this.calculateChipCost(data);

    // 3. 칩 잔액 확인
    const balance = await chipService.getBalance(data.creatorId);
    if (balance < chipCost) {
      throw new InsufficientChipsError(chipCost, balance);
    }

    // 4. 트랜잭션으로 업데이트
    await firestore().runTransaction(async (transaction) => {
      const postingRef = firestore().collection('jobPostings').doc(postingId);

      transaction.update(postingRef, {
        ...data,
        status: 'pending_approval',
        approvalStatus: 'pending',
        chipCost,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    });

    // 5. 관리자에게 알림
    await notificationService.notifyAdmins({
      type: 'job_posting_submitted',
      title: '새 공고 승인 요청',
      body: `${data.title} 공고가 승인을 기다리고 있습니다.`,
      data: { postingId },
    });
  },

  /**
   * 공고 승인 (관리자)
   */
  async approve(postingId: string, adminId: string): Promise<void> {
    const postingRef = firestore().collection('jobPostings').doc(postingId);
    const posting = (await postingRef.get()).data() as JobPosting;

    await firestore().runTransaction(async (transaction) => {
      // 1. 칩 차감
      await chipService.deduct(
        posting.creatorId,
        posting.chipCost,
        `공고 등록: ${posting.title}`,
        transaction
      );

      // 2. 공고 활성화
      transaction.update(postingRef, {
        status: 'active',
        approvalStatus: 'approved',
        chipDeducted: true,
        publishedAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    });

    // 3. 매니저에게 알림
    await notificationService.send(posting.creatorId, {
      type: 'job_posting_approved',
      title: '공고 승인 완료',
      body: `${posting.title} 공고가 승인되어 게시되었습니다.`,
      data: { postingId },
    });
  },

  /**
   * 칩 비용 계산
   */
  calculateChipCost(posting: JobPosting): number {
    const baseCost = 10; // 기본 비용
    const dayCount = posting.dates.length;
    const roleCount = posting.roles.reduce((sum, r) => sum + r.count, 0);

    // 긴급 공고 추가 비용
    const urgentMultiplier = posting.postingType === 'urgent' ? 1.5 : 1;

    return Math.ceil(baseCost * dayCount * roleCount * urgentMultiplier);
  },
};
```

### 공고 작성 화면 (멀티 스텝)
```typescript
// app/(employer)/job-posting/create.tsx
import { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { jobPostingSchema } from '@/schemas/jobPosting.schema';

// 5단계 스텝
const STEPS = [
  { key: 'basic', title: '기본 정보', component: BasicInfoStep },
  { key: 'schedule', title: '근무 일정', component: ScheduleStep },
  { key: 'roles', title: '역할 및 급여', component: RolesStep },
  { key: 'details', title: '상세 정보', component: DetailsStep },
  { key: 'preview', title: '미리보기', component: PreviewStep },
];

export default function CreateJobPostingScreen() {
  const [currentStep, setCurrentStep] = useState(0);
  const [draftId, setDraftId] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(jobPostingSchema),
    defaultValues: getDefaultValues(),
    mode: 'onChange', // 실시간 검증
  });

  // 자동 저장 (30초마다)
  useAutoSave(form.getValues, draftId, setDraftId);

  const CurrentStepComponent = STEPS[currentStep].component;

  const handleNext = async () => {
    // 현재 스텝 필드만 검증
    const stepFields = getStepFields(currentStep);
    const isValid = await form.trigger(stepFields);

    if (isValid) {
      if (currentStep < STEPS.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handleSubmit = async () => {
    const data = form.getValues();

    try {
      await jobPostingCreateService.submitForApproval(draftId!, data);

      toast.success('공고가 제출되었습니다. 승인을 기다려주세요.');
      navigation.toMyJobPostings();
    } catch (error) {
      if (error instanceof InsufficientChipsError) {
        showChipRechargeModal(error.required, error.current);
      } else {
        toast.error(error.userMessage);
      }
    }
  };

  return (
    <FormProvider {...form}>
      <SafeAreaView className="flex-1 bg-background">
        {/* 프로그레스 바 */}
        <StepProgress
          steps={STEPS}
          currentStep={currentStep}
        />

        {/* 스텝 내용 */}
        <ScrollView className="flex-1 px-4">
          <CurrentStepComponent />
        </ScrollView>

        {/* 네비게이션 버튼 */}
        <StepNavigation
          currentStep={currentStep}
          totalSteps={STEPS.length}
          onPrev={() => setCurrentStep(currentStep - 1)}
          onNext={handleNext}
          onSubmit={handleSubmit}
          isSubmitting={form.formState.isSubmitting}
        />
      </SafeAreaView>
    </FormProvider>
  );
}
```

---

## 2. 지원 플로우

### 데이터 모델
```typescript
// src/types/application.ts
interface Application {
  id: string;

  // 연결
  jobId: string;
  jobTitle: string;
  applicantId: string;
  applicantName: string;

  // 지원 정보
  appliedRole: string;           // 지원한 역할
  appliedDates: string[];        // 지원한 날짜들
  preAnswers: PreAnswer[];       // 사전질문 답변

  // 상태
  status: ApplicationStatus;
  statusHistory: StatusChange[]; // 상태 변경 이력

  // 확정 정보 (확정 시)
  confirmedRole?: string;
  confirmedDates?: string[];
  confirmedAt?: Timestamp;
  confirmedBy?: string;

  // 거절 정보 (거절 시)
  rejectedAt?: Timestamp;
  rejectedBy?: string;
  rejectionReason?: string;

  // 타임스탬프
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type ApplicationStatus =
  | 'pending'           // 대기중
  | 'confirmed'         // 확정
  | 'rejected'          // 거절
  | 'cancelled'         // 취소 (지원자)
  | 'completed'         // 완료
  | 'no_show';          // 노쇼

interface PreAnswer {
  questionId: string;
  question: string;
  answer: string;
}

interface StatusChange {
  from: ApplicationStatus;
  to: ApplicationStatus;
  changedAt: Timestamp;
  changedBy: string;
  reason?: string;
}
```

### 지원 서비스
```typescript
// src/services/job/applicationService.ts
export const applicationService = {
  /**
   * 공고 지원
   */
  async apply(
    userId: string,
    userProfile: UserProfile,
    jobId: string,
    data: ApplyData
  ): Promise<string> {
    // 1. 중복 지원 체크
    const existing = await this.checkDuplicateApplication(userId, jobId);
    if (existing) {
      throw new DuplicateApplicationError();
    }

    // 2. 공고 상태 확인
    const job = await jobPostingService.getById(jobId);
    if (job.status !== 'active') {
      throw new JobNotActiveError();
    }

    // 3. 역할 마감 확인
    const role = job.roles.find(r => r.name === data.appliedRole);
    if (!role || role.confirmedCount >= role.count) {
      throw new RoleFullError(data.appliedRole);
    }

    // 4. 지원 생성
    const applicationId = await firestore().runTransaction(async (transaction) => {
      const applicationRef = firestore().collection('applications').doc();

      transaction.set(applicationRef, {
        jobId,
        jobTitle: job.title,
        applicantId: userId,
        applicantName: userProfile.name,
        appliedRole: data.appliedRole,
        appliedDates: data.appliedDates,
        preAnswers: data.preAnswers,
        status: 'pending',
        statusHistory: [{
          from: null,
          to: 'pending',
          changedAt: firestore.FieldValue.serverTimestamp(),
          changedBy: userId,
        }],
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });

      // 공고 지원자 수 증가
      const postingRef = firestore().collection('jobPostings').doc(jobId);
      transaction.update(postingRef, {
        applicantCount: firestore.FieldValue.increment(1),
      });

      return applicationRef.id;
    });

    // 5. 매니저에게 알림
    await notificationService.send(job.creatorId, {
      type: 'new_application',
      title: '새로운 지원자',
      body: `${userProfile.name}님이 ${job.title}에 지원했습니다.`,
      data: { jobId, applicationId },
    });

    return applicationId;
  },

  /**
   * 지원 취소
   */
  async cancel(applicationId: string, userId: string): Promise<void> {
    const application = await this.getById(applicationId);

    if (application.applicantId !== userId) {
      throw new PermissionError('본인의 지원만 취소할 수 있습니다.');
    }

    if (application.status !== 'pending') {
      throw new InvalidStatusError('대기 중인 지원만 취소할 수 있습니다.');
    }

    await firestore().runTransaction(async (transaction) => {
      const appRef = firestore().collection('applications').doc(applicationId);

      transaction.update(appRef, {
        status: 'cancelled',
        statusHistory: firestore.FieldValue.arrayUnion({
          from: 'pending',
          to: 'cancelled',
          changedAt: firestore.FieldValue.serverTimestamp(),
          changedBy: userId,
        }),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });

      // 공고 지원자 수 감소
      const postingRef = firestore().collection('jobPostings').doc(application.jobId);
      transaction.update(postingRef, {
        applicantCount: firestore.FieldValue.increment(-1),
      });
    });
  },
};
```

---

## 3. 확정 플로우

### 확정 서비스
```typescript
// src/services/job/confirmationService.ts
export const confirmationService = {
  /**
   * 지원자 확정
   */
  async confirm(
    applicationId: string,
    managerId: string,
    data: ConfirmData
  ): Promise<string> {
    const application = await applicationService.getById(applicationId);
    const job = await jobPostingService.getById(application.jobId);

    // 1. 권한 확인
    if (job.creatorId !== managerId && !await isAdmin(managerId)) {
      throw new PermissionError('확정 권한이 없습니다.');
    }

    // 2. 역할 정원 확인
    const role = job.roles.find(r => r.name === data.confirmedRole);
    if (role.confirmedCount >= role.count) {
      throw new RoleFullError(data.confirmedRole);
    }

    // 3. 트랜잭션으로 확정 처리
    const workLogId = await firestore().runTransaction(async (transaction) => {
      // 3-1. 지원 상태 업데이트
      const appRef = firestore().collection('applications').doc(applicationId);
      transaction.update(appRef, {
        status: 'confirmed',
        confirmedRole: data.confirmedRole,
        confirmedDates: data.confirmedDates,
        confirmedAt: firestore.FieldValue.serverTimestamp(),
        confirmedBy: managerId,
        statusHistory: firestore.FieldValue.arrayUnion({
          from: 'pending',
          to: 'confirmed',
          changedAt: firestore.FieldValue.serverTimestamp(),
          changedBy: managerId,
        }),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });

      // 3-2. 역할 확정 인원 증가
      const postingRef = firestore().collection('jobPostings').doc(application.jobId);
      const roleIndex = job.roles.findIndex(r => r.name === data.confirmedRole);
      transaction.update(postingRef, {
        [`roles.${roleIndex}.confirmedCount`]: firestore.FieldValue.increment(1),
        confirmedCount: firestore.FieldValue.increment(1),
      });

      // 3-3. WorkLog 생성 (각 날짜별)
      const workLogIds: string[] = [];
      for (const date of data.confirmedDates) {
        const workLogRef = firestore().collection('workLogs').doc();
        transaction.set(workLogRef, {
          // 연결
          applicationId,
          jobId: application.jobId,
          jobTitle: job.title,
          staffId: application.applicantId,
          staffName: application.applicantName,

          // 근무 정보
          date,
          role: data.confirmedRole,
          scheduledStartTime: job.timeSlot.startTime,
          scheduledEndTime: job.timeSlot.endTime,

          // 급여 정보
          baseSalary: role.salary,

          // 출퇴근 (미정)
          attendanceStatus: 'scheduled',  // scheduled | checked_in | checked_out | no_show
          checkInTime: null,
          checkOutTime: null,

          // 정산 (미정)
          settlementStatus: 'pending',    // pending | calculated | settled
          actualWorkMinutes: null,
          overtimeMinutes: null,
          finalSalary: null,

          // 타임스탬프
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
        workLogIds.push(workLogRef.id);
      }

      return workLogIds[0]; // 첫 번째 workLog ID 반환
    });

    // 4. 스태프에게 알림
    await notificationService.send(application.applicantId, {
      type: 'application_confirmed',
      title: '지원 확정!',
      body: `${job.title}에 ${data.confirmedRole}로 확정되었습니다.`,
      data: {
        jobId: application.jobId,
        applicationId,
        dates: data.confirmedDates,
      },
    });

    // 5. 캘린더 이벤트 생성 (선택적)
    await calendarService.createEvents(application.applicantId, {
      title: job.title,
      role: data.confirmedRole,
      dates: data.confirmedDates,
      timeSlot: job.timeSlot,
      location: job.location,
    });

    return workLogId;
  },

  /**
   * 일괄 확정
   */
  async confirmBulk(
    applicationIds: string[],
    managerId: string,
    roleAssignments: Record<string, string> // applicationId -> role
  ): Promise<{ success: string[]; failed: Array<{ id: string; error: string }> }> {
    const results = {
      success: [] as string[],
      failed: [] as Array<{ id: string; error: string }>,
    };

    // 순차 처리 (트랜잭션 충돌 방지)
    for (const appId of applicationIds) {
      try {
        const application = await applicationService.getById(appId);
        await this.confirm(appId, managerId, {
          confirmedRole: roleAssignments[appId] || application.appliedRole,
          confirmedDates: application.appliedDates,
        });
        results.success.push(appId);
      } catch (error) {
        results.failed.push({
          id: appId,
          error: error.userMessage || '확정 실패'
        });
      }
    }

    return results;
  },
};
```

---

## 4. 출퇴근/QR 플로우

### WorkLog 데이터 모델
```typescript
// src/types/workLog.ts
interface WorkLog {
  id: string;

  // 연결
  applicationId: string;
  jobId: string;
  jobTitle: string;
  staffId: string;
  staffName: string;

  // 근무 정보
  date: string;                    // '2024-12-20'
  role: string;
  scheduledStartTime: string;      // '18:00'
  scheduledEndTime: string;        // '02:00'

  // 급여 정보
  baseSalary: number;              // 기본 일당

  // 출퇴근 상태
  attendanceStatus: AttendanceStatus;
  checkInTime: Timestamp | null;
  checkInMethod: 'qr' | 'manual' | null;
  checkInBy: string | null;        // QR 스캔한 매니저
  checkOutTime: Timestamp | null;
  checkOutMethod: 'qr' | 'manual' | null;
  checkOutBy: string | null;

  // 시간 계산
  actualWorkMinutes: number | null;
  overtimeMinutes: number | null;
  lateMinutes: number | null;
  earlyLeaveMinutes: number | null;

  // 정산
  settlementStatus: SettlementStatus;
  finalSalary: number | null;
  adjustments: SalaryAdjustment[];
  settledAt: Timestamp | null;
  settledBy: string | null;

  // 메모
  managerNote: string | null;
  staffNote: string | null;

  // 타임스탬프
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type AttendanceStatus =
  | 'scheduled'     // 예정
  | 'checked_in'    // 출근 완료
  | 'checked_out'   // 퇴근 완료
  | 'no_show'       // 노쇼
  | 'cancelled';    // 취소

type SettlementStatus =
  | 'pending'       // 대기
  | 'calculated'    // 계산 완료
  | 'settled'       // 정산 완료
  | 'disputed';     // 이의 제기

interface SalaryAdjustment {
  type: 'overtime' | 'late' | 'early_leave' | 'bonus' | 'deduction' | 'other';
  amount: number;
  reason: string;
  createdBy: string;
  createdAt: Timestamp;
}
```

### QR 출퇴근 서비스
```typescript
// src/services/attendance/attendanceService.ts
export const attendanceService = {
  /**
   * QR 스캔으로 출근 처리
   */
  async checkInWithQR(
    qrPayload: QRPayload,
    managerId: string,
    jobId: string
  ): Promise<CheckInResult> {
    // 1. QR 검증
    const verification = await qrService.verifyPayload(qrPayload);
    if (!verification.valid) {
      throw new InvalidQRError(verification.reason);
    }

    const staffId = verification.staffId;

    // 2. 해당 날짜의 WorkLog 찾기
    const today = formatDate(new Date(), 'yyyy-MM-dd');
    const workLog = await this.findWorkLog(staffId, jobId, today);

    if (!workLog) {
      throw new NoScheduleError('오늘 예정된 근무가 없습니다.');
    }

    if (workLog.attendanceStatus !== 'scheduled') {
      throw new AlreadyCheckedInError();
    }

    // 3. 출근 처리
    const now = new Date();
    const scheduledStart = parseTime(workLog.scheduledStartTime);
    const lateMinutes = Math.max(0, differenceInMinutes(now, scheduledStart));

    await firestore().collection('workLogs').doc(workLog.id).update({
      attendanceStatus: 'checked_in',
      checkInTime: firestore.FieldValue.serverTimestamp(),
      checkInMethod: 'qr',
      checkInBy: managerId,
      lateMinutes,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    // 4. 실시간 알림 (매니저 화면 갱신용)
    await realtimeService.broadcast(`job:${jobId}:attendance`, {
      type: 'check_in',
      staffId,
      staffName: workLog.staffName,
      time: now.toISOString(),
    });

    return {
      success: true,
      staffName: workLog.staffName,
      role: workLog.role,
      checkInTime: now,
      isLate: lateMinutes > 0,
      lateMinutes,
    };
  },

  /**
   * QR 스캔으로 퇴근 처리
   */
  async checkOutWithQR(
    qrPayload: QRPayload,
    managerId: string,
    jobId: string
  ): Promise<CheckOutResult> {
    const verification = await qrService.verifyPayload(qrPayload);
    if (!verification.valid) {
      throw new InvalidQRError(verification.reason);
    }

    const staffId = verification.staffId;
    const today = formatDate(new Date(), 'yyyy-MM-dd');
    const workLog = await this.findWorkLog(staffId, jobId, today);

    if (!workLog) {
      throw new NoScheduleError('오늘 예정된 근무가 없습니다.');
    }

    if (workLog.attendanceStatus !== 'checked_in') {
      throw new NotCheckedInError();
    }

    // 시간 계산
    const now = new Date();
    const checkInTime = workLog.checkInTime.toDate();
    const scheduledEnd = parseTime(workLog.scheduledEndTime);

    const actualWorkMinutes = differenceInMinutes(now, checkInTime);
    const scheduledWorkMinutes = differenceInMinutes(scheduledEnd, parseTime(workLog.scheduledStartTime));
    const overtimeMinutes = Math.max(0, actualWorkMinutes - scheduledWorkMinutes);
    const earlyLeaveMinutes = Math.max(0, differenceInMinutes(scheduledEnd, now));

    // 급여 계산
    const calculation = this.calculateSalary({
      baseSalary: workLog.baseSalary,
      actualWorkMinutes,
      scheduledWorkMinutes,
      overtimeMinutes,
      lateMinutes: workLog.lateMinutes,
      earlyLeaveMinutes,
    });

    await firestore().collection('workLogs').doc(workLog.id).update({
      attendanceStatus: 'checked_out',
      checkOutTime: firestore.FieldValue.serverTimestamp(),
      checkOutMethod: 'qr',
      checkOutBy: managerId,
      actualWorkMinutes,
      overtimeMinutes,
      earlyLeaveMinutes,
      finalSalary: calculation.finalSalary,
      adjustments: calculation.adjustments,
      settlementStatus: 'calculated',
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    // 실시간 알림
    await realtimeService.broadcast(`job:${jobId}:attendance`, {
      type: 'check_out',
      staffId,
      staffName: workLog.staffName,
      time: now.toISOString(),
    });

    // 스태프에게 근무 완료 알림
    await notificationService.send(staffId, {
      type: 'work_completed',
      title: '근무 완료',
      body: `${workLog.jobTitle} 근무가 완료되었습니다. 예상 급여: ${formatCurrency(calculation.finalSalary)}`,
      data: { workLogId: workLog.id },
    });

    return {
      success: true,
      staffName: workLog.staffName,
      actualWorkMinutes,
      overtimeMinutes,
      finalSalary: calculation.finalSalary,
    };
  },

  /**
   * 급여 계산
   */
  calculateSalary(params: SalaryCalculationParams): SalaryCalculation {
    const {
      baseSalary,
      actualWorkMinutes,
      scheduledWorkMinutes,
      overtimeMinutes,
      lateMinutes,
      earlyLeaveMinutes,
    } = params;

    const hourlyRate = baseSalary / (scheduledWorkMinutes / 60);
    const adjustments: SalaryAdjustment[] = [];
    let finalSalary = baseSalary;

    // 연장 근무 수당 (1.5배)
    if (overtimeMinutes > 0) {
      const overtimePay = Math.round((hourlyRate * 1.5 * overtimeMinutes) / 60);
      adjustments.push({
        type: 'overtime',
        amount: overtimePay,
        reason: `연장 근무 ${overtimeMinutes}분`,
      });
      finalSalary += overtimePay;
    }

    // 지각 공제 (30분 이상)
    if (lateMinutes >= 30) {
      const deduction = Math.round((hourlyRate * lateMinutes) / 60);
      adjustments.push({
        type: 'late',
        amount: -deduction,
        reason: `지각 ${lateMinutes}분`,
      });
      finalSalary -= deduction;
    }

    // 조퇴 공제
    if (earlyLeaveMinutes > 0) {
      const deduction = Math.round((hourlyRate * earlyLeaveMinutes) / 60);
      adjustments.push({
        type: 'early_leave',
        amount: -deduction,
        reason: `조퇴 ${earlyLeaveMinutes}분`,
      });
      finalSalary -= deduction;
    }

    return {
      baseSalary,
      adjustments,
      finalSalary: Math.max(0, finalSalary),
    };
  },
};
```

---

## 5. 정산 플로우

### 정산 서비스
```typescript
// src/services/settlement/settlementService.ts
export const settlementService = {
  /**
   * 정산 요약 조회
   */
  async getSettlementSummary(jobId: string): Promise<SettlementSummary> {
    const workLogs = await firestore()
      .collection('workLogs')
      .where('jobId', '==', jobId)
      .where('settlementStatus', 'in', ['calculated', 'settled'])
      .get();

    const byStaff = new Map<string, StaffSettlement>();

    for (const doc of workLogs.docs) {
      const log = doc.data() as WorkLog;

      if (!byStaff.has(log.staffId)) {
        byStaff.set(log.staffId, {
          staffId: log.staffId,
          staffName: log.staffName,
          totalDays: 0,
          totalMinutes: 0,
          totalSalary: 0,
          status: 'pending',
          workLogs: [],
        });
      }

      const staff = byStaff.get(log.staffId)!;
      staff.totalDays += 1;
      staff.totalMinutes += log.actualWorkMinutes || 0;
      staff.totalSalary += log.finalSalary || 0;
      staff.workLogs.push(log);

      // 하나라도 settled면 settled
      if (log.settlementStatus === 'settled') {
        staff.status = 'settled';
      }
    }

    return {
      totalStaff: byStaff.size,
      totalSalary: Array.from(byStaff.values()).reduce((s, v) => s + v.totalSalary, 0),
      byStaff: Array.from(byStaff.values()),
    };
  },

  /**
   * 개인 정산 완료 처리
   */
  async settleStaff(
    jobId: string,
    staffId: string,
    managerId: string
  ): Promise<void> {
    const workLogs = await firestore()
      .collection('workLogs')
      .where('jobId', '==', jobId)
      .where('staffId', '==', staffId)
      .where('settlementStatus', '==', 'calculated')
      .get();

    const batch = firestore().batch();
    let totalSalary = 0;

    for (const doc of workLogs.docs) {
      batch.update(doc.ref, {
        settlementStatus: 'settled',
        settledAt: firestore.FieldValue.serverTimestamp(),
        settledBy: managerId,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      totalSalary += doc.data().finalSalary || 0;
    }

    await batch.commit();

    // 스태프에게 정산 완료 알림
    await notificationService.send(staffId, {
      type: 'settlement_completed',
      title: '정산 완료',
      body: `총 ${formatCurrency(totalSalary)}이 정산되었습니다.`,
      data: { jobId, totalSalary },
    });
  },

  /**
   * 전체 정산 완료
   */
  async settleAll(jobId: string, managerId: string): Promise<void> {
    const summary = await this.getSettlementSummary(jobId);

    for (const staff of summary.byStaff) {
      if (staff.status !== 'settled') {
        await this.settleStaff(jobId, staff.staffId, managerId);
      }
    }

    // 공고 상태 업데이트
    await firestore().collection('jobPostings').doc(jobId).update({
      status: 'closed',
      closedAt: firestore.FieldValue.serverTimestamp(),
    });
  },
};
```

---

## 6. 내 스케줄 데이터 통합

### 스케줄 서비스
```typescript
// src/services/schedule/scheduleService.ts
export const scheduleService = {
  /**
   * 내 스케줄 조회 (통합)
   * - applications (pending) + workLogs (confirmed 이후)
   */
  async getMySchedule(
    userId: string,
    filters?: ScheduleFilters
  ): Promise<ScheduleEvent[]> {
    const events: ScheduleEvent[] = [];

    // 1. 대기 중인 지원 (아직 WorkLog 없음)
    const pendingApplications = await firestore()
      .collection('applications')
      .where('applicantId', '==', userId)
      .where('status', '==', 'pending')
      .get();

    for (const doc of pendingApplications.docs) {
      const app = doc.data() as Application;
      for (const date of app.appliedDates) {
        events.push({
          id: `app-${doc.id}-${date}`,
          type: 'application',
          sourceId: doc.id,
          date,
          title: app.jobTitle,
          role: app.appliedRole,
          status: 'pending',
          // 시간은 공고에서 가져와야 함
        });
      }
    }

    // 2. WorkLogs (확정 이후 모든 상태)
    let workLogsQuery = firestore()
      .collection('workLogs')
      .where('staffId', '==', userId);

    // 날짜 필터 적용
    if (filters?.dateFrom) {
      workLogsQuery = workLogsQuery.where('date', '>=', filters.dateFrom);
    }
    if (filters?.dateTo) {
      workLogsQuery = workLogsQuery.where('date', '<=', filters.dateTo);
    }

    const workLogs = await workLogsQuery
      .orderBy('date', 'desc')
      .get();

    for (const doc of workLogs.docs) {
      const log = doc.data() as WorkLog;
      events.push({
        id: `work-${doc.id}`,
        type: 'workLog',
        sourceId: doc.id,
        date: log.date,
        title: log.jobTitle,
        role: log.role,
        status: this.mapWorkLogStatus(log),
        startTime: log.scheduledStartTime,
        endTime: log.scheduledEndTime,
        checkInTime: log.checkInTime?.toDate(),
        checkOutTime: log.checkOutTime?.toDate(),
        salary: log.finalSalary || log.baseSalary,
        settlementStatus: log.settlementStatus,
      });
    }

    // 3. 상태 필터 적용
    let filtered = events;
    if (filters?.status?.length) {
      filtered = events.filter(e => filters.status.includes(e.status));
    }

    // 4. 날짜순 정렬
    return filtered.sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  },

  /**
   * 스케줄 상세 조회
   */
  async getScheduleDetail(
    eventId: string
  ): Promise<ScheduleDetail> {
    const [type, id] = eventId.split('-');

    if (type === 'app') {
      const application = await applicationService.getById(id);
      const job = await jobPostingService.getById(application.jobId);

      return {
        type: 'application',
        application,
        job,
      };
    }

    if (type === 'work') {
      const workLog = await this.getWorkLogById(id);
      const job = await jobPostingService.getById(workLog.jobId);

      return {
        type: 'workLog',
        workLog,
        job,
      };
    }

    throw new NotFoundError('스케줄을 찾을 수 없습니다.');
  },

  mapWorkLogStatus(log: WorkLog): ScheduleStatus {
    switch (log.attendanceStatus) {
      case 'scheduled':
        return 'confirmed';
      case 'checked_in':
        return 'in_progress';
      case 'checked_out':
        return log.settlementStatus === 'settled' ? 'settled' : 'completed';
      case 'no_show':
        return 'no_show';
      case 'cancelled':
        return 'cancelled';
      default:
        return 'confirmed';
    }
  },
};
```

---

## 7. 데이터 연결 다이어그램

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           데이터 연결 관계                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│   JobPosting     │
│  ┌────────────┐  │
│  │ id         │──┼──────────────────────────────────────┐
│  │ creatorId  │  │                                      │
│  │ title      │  │                                      │
│  │ dates[]    │  │                                      │
│  │ roles[]    │  │                                      │
│  │ timeSlot   │  │                                      │
│  └────────────┘  │                                      │
└────────┬─────────┘                                      │
         │                                                │
         │ 1:N                                            │
         ▼                                                │
┌──────────────────┐                                      │
│   Application    │                                      │
│  ┌────────────┐  │                                      │
│  │ id         │──┼───────────────────┐                  │
│  │ jobId      │◀─┼───────────────────┼──────────────────┘
│  │ applicantId│  │                   │
│  │ status     │  │                   │
│  │ appliedRole│  │                   │
│  │ appliedDates│ │                   │
│  └────────────┘  │                   │
└────────┬─────────┘                   │
         │                             │
         │ 1:N (확정 시)                │
         ▼                             │
┌──────────────────┐                   │
│    WorkLog       │                   │
│  ┌────────────┐  │                   │
│  │ id         │  │                   │
│  │ applicationId│◀───────────────────┘
│  │ jobId      │◀─┼───────────────────────────────────────
│  │ staffId    │  │
│  │ date       │  │      ┌──────────────────┐
│  │ role       │  │      │  ScheduleEvent   │ (조회용)
│  │ attendance │  │      │  ┌────────────┐  │
│  │ checkIn/Out│  │◀─────│  │ 통합 뷰    │  │
│  │ salary     │  │      │  │ application│  │
│  │ settlement │  │      │  │ + workLog  │  │
│  └────────────┘  │      │  └────────────┘  │
└──────────────────┘      └──────────────────┘
         │
         │
         ▼
┌──────────────────┐
│   Notification   │
│  ┌────────────┐  │
│  │ userId     │  │ ◀── 각 상태 변경 시 발송
│  │ type       │  │
│  │ data       │  │
│  └────────────┘  │
└──────────────────┘
```

---

## 8. 알림 트리거 포인트

```typescript
// 알림이 발송되는 모든 시점
const NOTIFICATION_TRIGGERS = {
  // 공고 관련
  JOB_POSTING: {
    submitted: '매니저 → 관리자: 승인 요청',
    approved: '관리자 → 매니저: 승인 완료',
    rejected: '관리자 → 매니저: 승인 거절',
  },

  // 지원 관련
  APPLICATION: {
    created: '스태프 → 매니저: 새 지원',
    confirmed: '매니저 → 스태프: 지원 확정',
    rejected: '매니저 → 스태프: 지원 거절',
    cancelled: '스태프 → 매니저: 지원 취소',
  },

  // 출퇴근 관련
  ATTENDANCE: {
    reminder: '시스템 → 스태프: 근무 1시간 전 알림',
    checked_in: '스태프 → 매니저: 출근 완료 (실시간)',
    checked_out: '스태프 → 매니저: 퇴근 완료 (실시간)',
    no_show: '시스템 → 매니저: 노쇼 알림',
  },

  // 정산 관련
  SETTLEMENT: {
    calculated: '시스템 → 스태프: 급여 계산 완료',
    settled: '매니저 → 스태프: 정산 완료',
  },
};
```
