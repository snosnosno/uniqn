# 08. 핵심 데이터 흐름 설계

> **최종 업데이트**: 2026-02-02 | **버전**: v1.0.0 | **상태**: 구현 완료
>
> **타입 참조**: 이 문서의 모든 타입 정의는 [23-api-reference.md](./23-api-reference.md)를 권위 있는 소스로 합니다.

---

## 아키텍처 레이어

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Presentation Layer (app/, components/)                                     │
│  └─ UI 렌더링만, 비즈니스 로직/Firebase 직접 호출 금지                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Hooks Layer (40개 커스텀 훅)                                               │
│  └─ 상태와 서비스 연결, 로딩/에러 상태 관리                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  State Layer (Zustand 8개 + TanStack Query)                                 │
│  └─ Zustand: UI/세션 상태  |  Query: 서버 데이터 캐싱                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Shared Layer (22개 공유 모듈)                                              │
│  └─ IdNormalizer, RoleResolver, StatusMapper, TimeNormalizer                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Service Layer (44개 서비스)                                                │
│  └─ 비즈니스 로직, Repository 호출, 에러 처리                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Repository Layer (7개) ⭐                                                  │
│  └─ 데이터 접근 추상화, Firebase Modular API 캡슐화                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  Firebase Layer (Auth, Firestore, Storage, Functions)                       │
│  └─ lib/firebase.ts (지연 초기화, Proxy 패턴)                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

**의존성 규칙**:
```
✅ Hooks → Service → Repository → Firebase (권장 경로)
❌ Presentation → Firebase 직접 호출 금지
❌ Service → Firebase 직접 호출 (Repository 통해서만)
```

---

## 전체 비즈니스 플로우

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         UNIQN 핵심 데이터 흐름                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  공고작성  │───▶│   지원    │───▶│   확정    │───▶│  출퇴근   │───▶│   정산    │
│ (구인자)  │    │ (스태프)  │    │ (구인자)  │    │  (QR)    │    │ (구인자)  │
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
│ (관리자)  │    │ (구인자)  │    │ (스태프)  │    │ (실시간)  │    │ (스태프)  │
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
  dates: string[];         // ['2026-02-20', '2026-02-21']
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
```

### Repository 패턴 적용

```typescript
// src/repositories/interfaces/IJobPostingRepository.ts
export interface IJobPostingRepository {
  findById(id: string): Promise<JobPosting | null>;
  findActive(filters?: JobFilters): Promise<JobPosting[]>;
  findByEmployer(employerId: string): Promise<JobPosting[]>;
  create(data: CreateJobPostingDTO): Promise<JobPosting>;
  update(id: string, data: Partial<JobPosting>): Promise<void>;
  delete(id: string): Promise<void>;
  updateStatus(id: string, status: JobPostingStatus): Promise<void>;
}

// src/repositories/firebase/JobPostingRepository.ts
export class JobPostingRepository implements IJobPostingRepository {
  async findById(id: string): Promise<JobPosting | null> {
    const normalizedId = IdNormalizer.normalize(id);
    const docRef = doc(db, 'jobPostings', normalizedId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;

    return {
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: TimeNormalizer.fromFirestore(docSnap.data().createdAt),
      updatedAt: TimeNormalizer.fromFirestore(docSnap.data().updatedAt),
    } as JobPosting;
  }

  async create(data: CreateJobPostingDTO): Promise<JobPosting> {
    const docRef = await addDoc(collection(db, 'jobPostings'), {
      ...data,
      applicantCount: 0,
      confirmedCount: 0,
      status: 'draft',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return this.findById(docRef.id) as Promise<JobPosting>;
  }
}
```

### 공고 관리 서비스 (실제 구현)

```typescript
// src/services/jobManagementService.ts (487줄)
import { jobPostingRepository } from '@/repositories';
import { notificationService } from '@/services/notificationService';
import { RoleResolver } from '@/shared/role';
import { TimeNormalizer } from '@/shared/time';
import { handleServiceError } from '@/errors/serviceErrorHandler';

export const jobManagementService = {
  /**
   * 공고 작성 (초안 저장)
   */
  async saveDraft(
    userId: string,
    data: Partial<JobPosting>
  ): Promise<string> {
    try {
      const posting = await jobPostingRepository.create({
        ...data,
        creatorId: userId,
        status: 'draft',
      });

      logger.info('공고 초안 저장', { postingId: posting.id, userId });
      return posting.id;
    } catch (error) {
      throw handleServiceError(error, 'jobManagement.saveDraft');
    }
  },

  /**
   * 공고 제출 (승인 요청)
   */
  async submitForApproval(postingId: string): Promise<void> {
    try {
      const posting = await jobPostingRepository.findById(postingId);

      if (!posting) {
        throw new DocumentNotFoundError('jobPostings', postingId);
      }

      // 유효성 검증
      const validation = jobPostingSchema.safeParse(posting);
      if (!validation.success) {
        throw new ValidationError(validation.error);
      }

      // 상태 업데이트
      await jobPostingRepository.update(postingId, {
        status: 'pending_approval',
        approvalStatus: 'pending',
      });

      // 관리자에게 알림
      await notificationService.notifyAdmins({
        type: 'job_posting_submitted',
        title: '새 공고 승인 요청',
        body: `${posting.title} 공고가 승인을 기다리고 있습니다.`,
        data: { postingId },
      });

      logger.info('공고 승인 요청', { postingId });
    } catch (error) {
      throw handleServiceError(error, 'jobManagement.submitForApproval');
    }
  },

  /**
   * 공고 승인 (관리자)
   */
  async approve(postingId: string, adminId: string): Promise<void> {
    try {
      const posting = await jobPostingRepository.findById(postingId);

      if (!posting) {
        throw new DocumentNotFoundError('jobPostings', postingId);
      }

      await jobPostingRepository.update(postingId, {
        status: 'active',
        approvalStatus: 'approved',
        publishedAt: TimeNormalizer.toFirestore(new Date()),
      });

      // 작성자에게 알림
      await notificationService.send(posting.creatorId, {
        type: 'job_posting_approved',
        title: '공고 승인 완료',
        body: `${posting.title} 공고가 승인되어 게시되었습니다.`,
        data: { postingId },
      });

      logger.info('공고 승인', { postingId, adminId });
    } catch (error) {
      throw handleServiceError(error, 'jobManagement.approve');
    }
  },
};
```

---

## 2. 지원 플로우 (v2 Assignment 모델)

### 데이터 모델

```typescript
// src/types/application.ts
interface Application {
  id: string;

  // 연결
  jobPostingId: string;       // ⚠️ 필드명 변경: jobId → jobPostingId
  jobTitle: string;
  applicantId: string;
  applicantName: string;

  // 지원 정보
  appliedRole: string;
  appliedDates: string[];
  preAnswers: PreAnswer[];

  // 상태
  status: ApplicationStatus;
  statusHistory: StatusChange[];

  // 확정 정보 (확정 시)
  confirmedRole?: string;
  confirmedDates?: string[];
  confirmedAt?: Timestamp;
  confirmedBy?: string;

  // 취소 요청 정보
  cancellationRequest?: {
    requestedAt: Timestamp;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
  };

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
```

### Repository 패턴 적용

```typescript
// src/repositories/interfaces/IApplicationRepository.ts
export interface IApplicationRepository {
  findById(id: string): Promise<Application | null>;
  findByJobPosting(jobPostingId: string): Promise<Application[]>;
  findByUser(userId: string): Promise<Application[]>;
  checkDuplicate(jobPostingId: string, userId: string): Promise<boolean>;
  create(data: CreateApplicationDTO): Promise<Application>;
  updateStatus(id: string, status: ApplicationStatus, metadata?: object): Promise<void>;
  requestCancellation(id: string, reason: string): Promise<void>;
}

// src/repositories/firebase/ApplicationRepository.ts
export class ApplicationRepository implements IApplicationRepository {
  async checkDuplicate(jobPostingId: string, userId: string): Promise<boolean> {
    const q = query(
      collection(db, 'applications'),
      where('jobPostingId', '==', jobPostingId),
      where('applicantId', '==', userId),
      where('status', 'in', ['pending', 'confirmed']),
      limit(1)
    );

    const snapshot = await getDocs(q);
    return !snapshot.empty;
  }

  async create(data: CreateApplicationDTO): Promise<Application> {
    // 트랜잭션으로 중복 체크 + 생성 + 카운트 증가
    return runTransaction(db, async (transaction) => {
      // 1. 중복 체크
      const isDuplicate = await this.checkDuplicate(data.jobPostingId, data.applicantId);
      if (isDuplicate) {
        throw new AlreadyAppliedError();
      }

      // 2. 공고 상태 확인
      const postingRef = doc(db, 'jobPostings', data.jobPostingId);
      const postingSnap = await transaction.get(postingRef);

      if (!postingSnap.exists() || postingSnap.data()?.status !== 'active') {
        throw new ApplicationClosedError();
      }

      // 3. 역할 정원 확인
      const posting = postingSnap.data() as JobPosting;
      const role = posting.roles.find(r => r.name === data.appliedRole);
      if (!role || role.confirmedCount >= role.count) {
        throw new MaxCapacityReachedError();
      }

      // 4. 지원서 생성
      const appRef = doc(collection(db, 'applications'));
      transaction.set(appRef, {
        ...data,
        status: 'pending',
        statusHistory: [{
          from: null,
          to: 'pending',
          changedAt: serverTimestamp(),
          changedBy: data.applicantId,
        }],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 5. 공고 지원자 수 증가
      transaction.update(postingRef, {
        applicantCount: increment(1),
      });

      return { id: appRef.id, ...data } as Application;
    });
  }
}
```

### 지원 서비스 (실제 구현)

```typescript
// src/services/applicationService.ts (341줄)
import { applicationRepository, jobPostingRepository } from '@/repositories';
import { StatusMapper } from '@/shared/status';
import { handleServiceError } from '@/errors/serviceErrorHandler';

export const applicationService = {
  /**
   * 공고 지원 (v2 Assignment)
   */
  async apply(
    userId: string,
    userProfile: UserProfile,
    jobPostingId: string,
    data: ApplyData
  ): Promise<string> {
    try {
      // Repository가 트랜잭션 내에서 모든 검증 수행
      const application = await applicationRepository.create({
        jobPostingId,
        jobTitle: data.jobTitle,
        applicantId: userId,
        applicantName: userProfile.name,
        appliedRole: data.appliedRole,
        appliedDates: data.appliedDates,
        preAnswers: data.preAnswers || [],
      });

      // 구인자에게 알림
      const posting = await jobPostingRepository.findById(jobPostingId);
      if (posting) {
        await notificationService.send(posting.creatorId, {
          type: 'new_application',
          title: '새로운 지원자',
          body: `${userProfile.name}님이 ${posting.title}에 지원했습니다.`,
          data: { jobPostingId, applicationId: application.id },
        });
      }

      logger.info('지원 완료', { applicationId: application.id, userId, jobPostingId });
      return application.id;
    } catch (error) {
      throw handleServiceError(error, 'application.apply');
    }
  },

  /**
   * 지원 취소 요청
   */
  async requestCancellation(
    applicationId: string,
    userId: string,
    reason: string
  ): Promise<void> {
    try {
      const application = await applicationRepository.findById(applicationId);

      if (!application) {
        throw new DocumentNotFoundError('applications', applicationId);
      }

      if (application.applicantId !== userId) {
        throw new PermissionError('본인의 지원만 취소할 수 있습니다.');
      }

      // 상태 전이 검증
      const validTransitions = StatusMapper.getValidTransitions(application.status);
      if (!validTransitions.includes('cancelled')) {
        throw new InvalidStatusTransitionError(application.status, 'cancelled');
      }

      await applicationRepository.requestCancellation(applicationId, reason);

      logger.info('지원 취소 요청', { applicationId, userId });
    } catch (error) {
      throw handleServiceError(error, 'application.requestCancellation');
    }
  },

  /**
   * 중복 지원 확인
   */
  async isAlreadyApplied(jobPostingId: string, userId: string): Promise<boolean> {
    return applicationRepository.checkDuplicate(jobPostingId, userId);
  },
};
```

---

## 3. 확정 플로우

### 지원자 관리 서비스 (실제 구현)

```typescript
// src/services/applicantManagementService.ts (643줄)
import { applicationRepository, workLogRepository } from '@/repositories';
import { RoleResolver } from '@/shared/role';
import { StatusMapper } from '@/shared/status';
import { TimeNormalizer } from '@/shared/time';

export const applicantManagementService = {
  /**
   * 지원자 확정 (트랜잭션)
   */
  async confirmApplicant(
    applicationId: string,
    employerId: string,
    data: ConfirmData
  ): Promise<string> {
    try {
      const application = await applicationRepository.findById(applicationId);
      const posting = await jobPostingRepository.findById(application.jobPostingId);

      // 1. 권한 확인
      if (!RoleResolver.hasPermission(employerId, posting.creatorId, 'employer')) {
        throw new PermissionError('확정 권한이 없습니다.');
      }

      // 2. 상태 전이 검증
      if (!StatusMapper.canTransition(application.status, 'confirmed')) {
        throw new InvalidStatusTransitionError(application.status, 'confirmed');
      }

      // 3. 역할 정원 확인
      const role = posting.roles.find(r => r.name === data.confirmedRole);
      if (!role || role.confirmedCount >= role.count) {
        throw new MaxCapacityReachedError(data.confirmedRole);
      }

      // 4. 트랜잭션 실행 (지원 확정 + WorkLog 생성)
      const workLogId = await runTransaction(db, async (transaction) => {
        // 4-1. 지원 상태 업데이트
        const appRef = doc(db, 'applications', applicationId);
        transaction.update(appRef, {
          status: 'confirmed',
          confirmedRole: data.confirmedRole,
          confirmedDates: data.confirmedDates,
          confirmedAt: serverTimestamp(),
          confirmedBy: employerId,
          statusHistory: arrayUnion({
            from: 'pending',
            to: 'confirmed',
            changedAt: serverTimestamp(),
            changedBy: employerId,
          }),
          updatedAt: serverTimestamp(),
        });

        // 4-2. 역할 확정 인원 증가
        const postingRef = doc(db, 'jobPostings', application.jobPostingId);
        const roleIndex = posting.roles.findIndex(r => r.name === data.confirmedRole);
        transaction.update(postingRef, {
          [`roles.${roleIndex}.confirmedCount`]: increment(1),
          confirmedCount: increment(1),
        });

        // 4-3. WorkLog 생성 (각 날짜별)
        const workLogIds: string[] = [];
        for (const date of data.confirmedDates) {
          const workLogRef = doc(collection(db, 'workLogs'));
          transaction.set(workLogRef, {
            applicationId,
            jobPostingId: application.jobPostingId,
            jobTitle: posting.title,
            staffId: application.applicantId,
            staffName: application.applicantName,
            date,
            role: data.confirmedRole,
            scheduledStartTime: posting.timeSlot.startTime,
            scheduledEndTime: posting.timeSlot.endTime,
            baseSalary: role.salary,
            attendanceStatus: 'scheduled',
            settlementStatus: 'pending',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          workLogIds.push(workLogRef.id);
        }

        return workLogIds[0];
      });

      // 5. 스태프에게 알림
      await notificationService.send(application.applicantId, {
        type: 'application_confirmed',
        title: '지원 확정!',
        body: `${posting.title}에 ${data.confirmedRole}로 확정되었습니다.`,
        data: {
          jobPostingId: application.jobPostingId,
          applicationId,
          dates: data.confirmedDates,
        },
      });

      logger.info('지원 확정', { applicationId, employerId, workLogId });
      return workLogId;
    } catch (error) {
      throw handleServiceError(error, 'applicantManagement.confirm');
    }
  },

  /**
   * 일괄 확정
   */
  async confirmBulk(
    applicationIds: string[],
    employerId: string,
    roleAssignments: Record<string, string>
  ): Promise<BulkResult> {
    const results: BulkResult = { success: [], failed: [] };

    // 순차 처리 (트랜잭션 충돌 방지)
    for (const appId of applicationIds) {
      try {
        const application = await applicationRepository.findById(appId);
        await this.confirmApplicant(appId, employerId, {
          confirmedRole: roleAssignments[appId] || application.appliedRole,
          confirmedDates: application.appliedDates,
        });
        results.success.push(appId);
      } catch (error) {
        results.failed.push({
          id: appId,
          error: error.userMessage || '확정 실패',
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
  jobPostingId: string;       // ⚠️ 필드명 변경: jobId → jobPostingId
  jobTitle: string;
  staffId: string;
  staffName: string;

  // 근무 정보
  date: string;                    // '2026-02-20'
  role: string;
  scheduledStartTime: string;      // '18:00'
  scheduledEndTime: string;        // '02:00'

  // 급여 정보
  baseSalary: number;

  // 출퇴근 상태
  attendanceStatus: AttendanceStatus;
  checkInTime: Timestamp | null;
  checkInMethod: 'qr' | 'manual' | null;
  checkInBy: string | null;
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
```

### QR 서비스 (실제 구현)

```typescript
// src/services/eventQRService.ts (~500줄)
import { eventQRRepository, workLogRepository } from '@/repositories';
import { TimeNormalizer } from '@/shared/time';

const QR_VALIDITY_SECONDS = 180; // 3분

export const eventQRService = {
  /**
   * 이벤트 QR 생성
   */
  async generateEventQR(input: GenerateQRInput): Promise<EventQRData> {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + QR_VALIDITY_SECONDS * 1000);

      const qrData: EventQRData = {
        type: 'event',
        jobPostingId: input.jobPostingId,
        date: input.date,
        action: input.action,
        securityCode: crypto.randomUUID(),
        createdAt: now.getTime(),
        expiresAt: expiresAt.getTime(),
      };

      // Firestore에 저장 (검증용)
      await eventQRRepository.create({
        ...qrData,
        createdBy: input.employerId,
      });

      logger.info('QR 생성', { jobPostingId: input.jobPostingId, action: input.action });
      return qrData;
    } catch (error) {
      throw handleServiceError(error, 'eventQR.generate');
    }
  },

  /**
   * QR 검증 및 출퇴근 처리
   */
  async processEventQR(
    qrData: EventQRData,
    staffId: string
  ): Promise<QRProcessResult> {
    try {
      // 1. QR 유효성 검증
      const validation = await this.validateEventQR(qrData);
      if (!validation.valid) {
        throw new InvalidQRCodeError(validation.reason);
      }

      // 2. 만료 확인
      if (Date.now() > qrData.expiresAt) {
        throw new ExpiredQRCodeError();
      }

      // 3. 해당 날짜의 WorkLog 찾기
      const workLog = await workLogRepository.findByStaffAndDate(
        staffId,
        qrData.jobPostingId,
        qrData.date
      );

      if (!workLog) {
        throw new QRWrongEventError('오늘 예정된 근무가 없습니다.');
      }

      // 4. 출근/퇴근 처리
      if (qrData.action === 'checkIn') {
        return this.processCheckIn(workLog, staffId);
      } else {
        return this.processCheckOut(workLog, staffId);
      }
    } catch (error) {
      throw handleServiceError(error, 'eventQR.process');
    }
  },

  /**
   * 출근 처리
   */
  async processCheckIn(workLog: WorkLog, staffId: string): Promise<QRProcessResult> {
    if (workLog.attendanceStatus !== 'scheduled') {
      throw new AlreadyCheckedInError();
    }

    const now = new Date();
    const scheduledStart = TimeNormalizer.parseTime(workLog.scheduledStartTime);
    const lateMinutes = Math.max(0, TimeNormalizer.differenceInMinutes(now, scheduledStart));

    await workLogRepository.update(workLog.id, {
      attendanceStatus: 'checked_in',
      checkInTime: TimeNormalizer.toFirestore(now),
      checkInMethod: 'qr',
      checkInBy: staffId,
      lateMinutes,
    });

    logger.info('출근 처리', { workLogId: workLog.id, staffId, lateMinutes });

    return {
      success: true,
      action: 'checkIn',
      staffName: workLog.staffName,
      role: workLog.role,
      checkInTime: now,
      isLate: lateMinutes > 0,
      lateMinutes,
    };
  },

  /**
   * 퇴근 처리
   */
  async processCheckOut(workLog: WorkLog, staffId: string): Promise<QRProcessResult> {
    if (workLog.attendanceStatus !== 'checked_in') {
      throw new NotCheckedInError();
    }

    const now = new Date();
    const checkInTime = TimeNormalizer.fromFirestore(workLog.checkInTime!);

    // 시간 계산
    const calculation = this.calculateWorkTime(workLog, checkInTime, now);

    await workLogRepository.update(workLog.id, {
      attendanceStatus: 'checked_out',
      checkOutTime: TimeNormalizer.toFirestore(now),
      checkOutMethod: 'qr',
      checkOutBy: staffId,
      actualWorkMinutes: calculation.actualWorkMinutes,
      overtimeMinutes: calculation.overtimeMinutes,
      earlyLeaveMinutes: calculation.earlyLeaveMinutes,
      finalSalary: calculation.finalSalary,
      adjustments: calculation.adjustments,
      settlementStatus: 'calculated',
    });

    // 스태프에게 알림
    await notificationService.send(staffId, {
      type: 'work_completed',
      title: '근무 완료',
      body: `${workLog.jobTitle} 근무가 완료되었습니다. 예상 급여: ${formatCurrency(calculation.finalSalary)}`,
      data: { workLogId: workLog.id },
    });

    logger.info('퇴근 처리', { workLogId: workLog.id, staffId, finalSalary: calculation.finalSalary });

    return {
      success: true,
      action: 'checkOut',
      staffName: workLog.staffName,
      actualWorkMinutes: calculation.actualWorkMinutes,
      overtimeMinutes: calculation.overtimeMinutes,
      finalSalary: calculation.finalSalary,
    };
  },
};
```

---

## 5. 정산 플로우

### 정산 모듈 (실제 구현)

```typescript
// src/services/settlement/ (1,320줄)
// ├── settlementQuery.ts      (372줄) - 조회
// ├── settlementMutation.ts   (563줄) - 생성/수정/삭제
// ├── settlementCalculation.ts (155줄) - 계산 로직
// └── types.ts                (162줄) - 타입 정의

// src/services/settlement/settlementQuery.ts
export const settlementQuery = {
  /**
   * 정산 요약 조회
   */
  async getSettlementSummary(jobPostingId: string): Promise<SettlementSummary> {
    try {
      const workLogs = await workLogRepository.findByJobPosting(jobPostingId, {
        settlementStatus: ['calculated', 'settled'],
      });

      const byStaff = new Map<string, StaffSettlement>();

      for (const log of workLogs) {
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

        if (log.settlementStatus === 'settled') {
          staff.status = 'settled';
        }
      }

      return {
        jobPostingId,
        totalStaff: byStaff.size,
        totalSalary: Array.from(byStaff.values()).reduce((s, v) => s + v.totalSalary, 0),
        byStaff: Array.from(byStaff.values()),
      };
    } catch (error) {
      throw handleServiceError(error, 'settlement.getSummary');
    }
  },
};

// src/services/settlement/settlementMutation.ts
export const settlementMutation = {
  /**
   * 개인 정산 완료 처리
   */
  async settleStaff(
    jobPostingId: string,
    staffId: string,
    employerId: string
  ): Promise<void> {
    try {
      const workLogs = await workLogRepository.findByStaffAndJob(staffId, jobPostingId, {
        settlementStatus: 'calculated',
      });

      if (workLogs.length === 0) {
        throw new NoWorkLogsToSettleError();
      }

      // 배치 업데이트
      const batch = writeBatch(db);
      let totalSalary = 0;

      for (const log of workLogs) {
        const ref = doc(db, 'workLogs', log.id);
        batch.update(ref, {
          settlementStatus: 'settled',
          settledAt: serverTimestamp(),
          settledBy: employerId,
          updatedAt: serverTimestamp(),
        });
        totalSalary += log.finalSalary || 0;
      }

      await batch.commit();

      // 스태프에게 정산 완료 알림
      await notificationService.send(staffId, {
        type: 'settlement_completed',
        title: '정산 완료',
        body: `총 ${formatCurrency(totalSalary)}이 정산되었습니다.`,
        data: { jobPostingId, totalSalary },
      });

      logger.info('정산 완료', { jobPostingId, staffId, totalSalary });
    } catch (error) {
      throw handleServiceError(error, 'settlement.settleStaff');
    }
  },
};

// src/services/settlement/settlementCalculation.ts
export const settlementCalculation = {
  /**
   * 급여 계산
   */
  calculate(params: SalaryCalculationParams): SalaryCalculation {
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

## 6. 내 스케줄 데이터 통합

### 스케줄 서비스 (실제 구현)

```typescript
// src/services/scheduleService.ts (760줄)
import { applicationRepository, workLogRepository } from '@/repositories';
import { StatusMapper } from '@/shared/status';
import { TimeNormalizer } from '@/shared/time';
import { RealtimeManager } from '@/shared/realtime';

export const scheduleService = {
  /**
   * 내 스케줄 조회 (통합)
   * - applications (pending) + workLogs (confirmed 이후)
   */
  async getMySchedules(
    userId: string,
    filters?: ScheduleFilters
  ): Promise<ScheduleEvent[]> {
    try {
      const events: ScheduleEvent[] = [];

      // 1. 대기 중인 지원 (아직 WorkLog 없음)
      const pendingApplications = await applicationRepository.findByUser(userId, {
        status: ['pending'],
      });

      for (const app of pendingApplications) {
        for (const date of app.appliedDates) {
          events.push({
            id: `app-${app.id}-${date}`,
            type: 'application',
            sourceId: app.id,
            date,
            title: app.jobTitle,
            role: app.appliedRole,
            status: 'pending',
          });
        }
      }

      // 2. WorkLogs (확정 이후 모든 상태)
      const workLogs = await workLogRepository.findByStaff(userId, {
        dateFrom: filters?.dateFrom,
        dateTo: filters?.dateTo,
      });

      for (const log of workLogs) {
        events.push({
          id: `work-${log.id}`,
          type: 'workLog',
          sourceId: log.id,
          date: log.date,
          title: log.jobTitle,
          role: log.role,
          status: StatusMapper.mapWorkLogToSchedule(log.attendanceStatus, log.settlementStatus),
          startTime: log.scheduledStartTime,
          endTime: log.scheduledEndTime,
          checkInTime: TimeNormalizer.fromFirestoreOptional(log.checkInTime),
          checkOutTime: TimeNormalizer.fromFirestoreOptional(log.checkOutTime),
          salary: log.finalSalary || log.baseSalary,
          settlementStatus: log.settlementStatus,
        });
      }

      // 3. 상태 필터 적용
      let filtered = events;
      if (filters?.status?.length) {
        filtered = events.filter(e => filters.status!.includes(e.status));
      }

      // 4. 날짜순 정렬
      return filtered.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    } catch (error) {
      throw handleServiceError(error, 'schedule.getMySchedules');
    }
  },

  /**
   * 월별 스케줄 조회 (캘린더용)
   */
  async getSchedulesByMonth(
    userId: string,
    year: number,
    month: number
  ): Promise<Map<string, ScheduleEvent[]>> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const events = await this.getMySchedules(userId, {
      dateFrom: startDate,
      dateTo: endDate,
    });

    // 날짜별 그룹핑
    const byDate = new Map<string, ScheduleEvent[]>();
    for (const event of events) {
      const dateEvents = byDate.get(event.date) || [];
      dateEvents.push(event);
      byDate.set(event.date, dateEvents);
    }

    return byDate;
  },

  /**
   * 실시간 구독
   */
  subscribeToSchedules(
    userId: string,
    callback: (events: ScheduleEvent[]) => void
  ): () => void {
    return RealtimeManager.subscribe(
      'workLogs',
      [where('staffId', '==', userId)],
      async () => {
        const events = await this.getMySchedules(userId);
        callback(events);
      }
    );
  },
};
```

---

## 7. Shared 모듈 활용

### 주요 모듈 사용 패턴

```typescript
// IdNormalizer - ID 정규화
import { IdNormalizer } from '@/shared/id';
const normalizedId = IdNormalizer.normalize('job_123');  // 'job123'
const fieldId = IdNormalizer.toFieldName('jobPostingId'); // 'jobPosting_id'

// RoleResolver - 권한 처리
import { RoleResolver } from '@/shared/role';
const role = RoleResolver.normalizeUserRole('Manager'); // 'employer'
const hasAccess = RoleResolver.hasPermission(userRole, 'employer');
const flags = RoleResolver.computeRoleFlags(role); // { isAdmin, isEmployer, isStaff }

// StatusMapper - 상태 흐름
import { StatusMapper } from '@/shared/status';
const canTransition = StatusMapper.canTransition('pending', 'confirmed'); // true
const validNext = StatusMapper.getValidTransitions('pending'); // ['confirmed', 'rejected', 'cancelled']
const label = StatusMapper.getLabel('confirmed', 'application'); // '확정'

// TimeNormalizer - 시간 정규화
import { TimeNormalizer } from '@/shared/time';
const timestamp = TimeNormalizer.toFirestore(new Date());
const date = TimeNormalizer.fromFirestore(timestamp);
const isoString = TimeNormalizer.toISOString(date); // '2026-02-02'
const formatted = TimeNormalizer.formatTime(date, 'HH:mm'); // '18:00'

// RealtimeManager - 실시간 구독
import { RealtimeManager } from '@/shared/realtime';
const unsubscribe = RealtimeManager.subscribe(
  'notifications',
  [where('userId', '==', userId), where('isRead', '==', false)],
  (docs) => setUnreadCount(docs.length)
);
// 컴포넌트 언마운트 시: unsubscribe();
```

---

## 8. 데이터 연결 다이어그램

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
│  │jobPostingId│◀─┼───────────────────┼──────────────────┘
│  │ applicantId│  │                   │
│  │ status     │  │                   │
│  │ appliedRole│  │                   │
│  │appliedDates│  │                   │
│  └────────────┘  │                   │
└────────┬─────────┘                   │
         │                             │
         │ 1:N (확정 시)                │
         ▼                             │
┌──────────────────┐                   │
│    WorkLog       │                   │
│  ┌────────────┐  │                   │
│  │ id         │  │                   │
│  │applicationId│◀───────────────────┘
│  │jobPostingId│◀─┼───────────────────────────────────────
│  │ staffId    │  │
│  │ date       │  │      ┌──────────────────┐
│  │ role       │  │      │  ScheduleEvent   │ (조회용)
│  │attendance  │  │      │  ┌────────────┐  │
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

## 9. 알림 트리거 포인트

```typescript
// src/constants/notificationTriggers.ts
export const NOTIFICATION_TRIGGERS = {
  // 공고 관련
  JOB_POSTING: {
    submitted: '구인자 → 관리자: 승인 요청',
    approved: '관리자 → 구인자: 승인 완료',
    rejected: '관리자 → 구인자: 승인 거절',
  },

  // 지원 관련
  APPLICATION: {
    created: '스태프 → 구인자: 새 지원',
    confirmed: '구인자 → 스태프: 지원 확정',
    rejected: '구인자 → 스태프: 지원 거절',
    cancelled: '스태프 → 구인자: 지원 취소',
    cancellation_requested: '스태프 → 구인자: 취소 요청',
    cancellation_approved: '구인자 → 스태프: 취소 승인',
  },

  // 출퇴근 관련
  ATTENDANCE: {
    reminder: '시스템 → 스태프: 근무 1시간 전 알림',
    checked_in: '스태프 → 구인자: 출근 완료 (실시간)',
    checked_out: '스태프 → 구인자: 퇴근 완료 (실시간)',
    no_show: '시스템 → 구인자: 노쇼 알림',
  },

  // 정산 관련
  SETTLEMENT: {
    calculated: '시스템 → 스태프: 급여 계산 완료',
    settled: '구인자 → 스태프: 정산 완료',
  },
};
```

---

## 10. Query Keys 및 캐싱 정책

```typescript
// src/lib/queryClient.ts
export const queryKeys = {
  // 기본
  user: { all: ['user'], current: ['user', 'current'], profile: (id: string) => ['user', id] },

  // 공고
  jobPostings: {
    all: ['jobPostings'],
    list: (filters?: JobFilters) => ['jobPostings', 'list', filters],
    detail: (id: string) => ['jobPostings', id],
    mine: (employerId: string) => ['jobPostings', 'mine', employerId],
  },

  // 지원
  applications: {
    all: ['applications'],
    mine: (userId: string) => ['applications', 'mine', userId],
    byJobPosting: (jobId: string) => ['applications', 'byJob', jobId],
    detail: (id: string) => ['applications', id],
  },

  // 스케줄
  schedules: {
    all: ['schedules'],
    mine: (userId: string) => ['schedules', 'mine', userId],
    byMonth: (userId: string, year: number, month: number) => ['schedules', userId, year, month],
    byDate: (userId: string, date: string) => ['schedules', userId, date],
  },

  // 정산
  settlement: {
    all: ['settlement'],
    byJobPosting: (jobId: string) => ['settlement', 'byJob', jobId],
    summary: (jobId: string) => ['settlement', 'summary', jobId],
  },
};

// 캐싱 정책
export const cachingPolicies = {
  realtime: 0,              // 항상 fresh (notifications)
  frequent: 2 * 60 * 1000,  // 2분 (jobPostings.list)
  standard: 5 * 60 * 1000,  // 5분 (기본)
  stable: 30 * 60 * 1000,   // 30분 (settings)
  offlineFirst: Infinity,   // 무제한 (mySchedule)
};
```

---

*마지막 업데이트: 2026-02-02*
