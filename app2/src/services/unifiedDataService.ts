/**
 * UnifiedDataService - Firebase 통합 데이터 서비스
 * 모든 Firebase 구독을 단일 서비스로 통합 관리
 * 
 * @version 1.0
 * @since 2025-02-01
 * @author T-HOLDEM Development Team
 */

import {
  collection,
  onSnapshot,
  query,
  orderBy,
  Unsubscribe,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
// where - 미래 필터링 기능용 (현재 미사용)
import { db } from '../firebase';
import { logger } from '../utils/logger';
import {
  // Staff, // 미래 사용용
  WorkLog,
  AttendanceRecord,
  JobPosting,
  Tournament,
  UnifiedDataAction,
  PerformanceMetrics,
} from '../types/unifiedData';
import {
  Application,
} from '../types/application';
// LegacyApplication - 레거시 지원용 타입 (현재 미사용)
// Application types imported from types/application

// 구독 관리 인터페이스
interface SubscriptionManager {
  staff?: Unsubscribe;
  workLogs?: Unsubscribe;
  attendanceRecords?: Unsubscribe;
  jobPostings?: Unsubscribe;
  applications?: Unsubscribe;
  tournaments?: Unsubscribe;
}

// 성능 메트릭 추적
class PerformanceTracker {
  private metrics: PerformanceMetrics = {
    subscriptionCount: 0,
    queryTimes: [],
    cacheHits: 0,
    cacheMisses: 0,
    errorCount: 0,
    lastOptimizationRun: 0,
  };

  startTimer(): () => number {
    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      this.metrics.queryTimes.push(duration);
      // 최근 100개 쿼리만 유지
      if (this.metrics.queryTimes.length > 100) {
        this.metrics.queryTimes.shift();
      }
      return duration;
    };
  }

  incrementSubscriptions(): void {
    this.metrics.subscriptionCount++;
  }

  decrementSubscriptions(): void {
    this.metrics.subscriptionCount = Math.max(0, this.metrics.subscriptionCount - 1);
  }

  incrementCacheHits(): void {
    this.metrics.cacheHits++;
  }

  incrementCacheMisses(): void {
    this.metrics.cacheMisses++;
  }

  incrementErrors(): void {
    this.metrics.errorCount++;
  }

  getMetrics(): PerformanceMetrics {
    return {
      ...this.metrics,
      lastOptimizationRun: Date.now(),
    };
  }

  getCacheHitRate(): number {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    return total > 0 ? (this.metrics.cacheHits / total) * 100 : 0;
  }

  getAverageQueryTime(): number {
    return this.metrics.queryTimes.length > 0
      ? this.metrics.queryTimes.reduce((sum, time) => sum + time, 0) / this.metrics.queryTimes.length
      : 0;
  }
}

// 데이터 변환 유틸리티 - TODO: 미래 데이터 변환 로직용 - 현재 미사용
/*
const transformStaffData = (doc: DocumentData): Staff => ({
  id: doc.id,
  staffId: doc.staffId || doc.id,
  name: doc.name || '',
  role: doc.role || '',
  phone: doc.phone,
  email: doc.email,
  // 지원자 확정 시 배정 정보 추가
  assignedRole: doc.assignedRole,
  assignedTime: doc.assignedTime,
  assignedDate: doc.assignedDate,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,

  // users 컬렉션 연결용
  userId: doc.userId || doc.id, // userId가 없으면 id 사용 (하위 호환성)

  // 원래 지원 정보
  postingId: doc.postingId,

  // 추가 개인정보 (persons에서 가져온 경우)
  gender: doc.gender,
  age: typeof doc.age === 'string' ? parseInt(doc.age, 10) : doc.age,
  experience: doc.experience,
  nationality: doc.nationality,
  region: doc.region,
  history: doc.history,
  notes: doc.notes,

  // 은행 정보
  bankName: doc.bankName,
  bankAccount: doc.bankAccount,
  residentId: doc.residentId,
});
*/

const transformWorkLogData = (doc: DocumentData): WorkLog => ({
  id: doc.id,
  staffId: doc.staffId,
  staffName: doc.staffName || '',
  eventId: doc.eventId || '',
  date: doc.date || '',
  
  // 🚀 새로 추가된 필드들
  staffInfo: doc.staffInfo || {
    userId: doc.userId || '',
    name: doc.staffName || '',
    email: '',
    phone: '',
    userRole: 'staff',
    jobRole: [],
    isActive: true,
    bankName: '',
    accountNumber: '',
    gender: '',
    age: undefined,
    experience: '',
    nationality: '',
    region: ''
  },
  
  assignmentInfo: doc.assignmentInfo || {
    role: doc.role || '',
    assignedRole: doc.assignedRole || doc.role || '',
    assignedTime: doc.assignedTime || '',
    assignedDate: doc.assignedDate || doc.date || '',
    postingId: doc.eventId || '',
    managerId: '',
    type: 'staff'
  },
  
  // 기존 필드들
  scheduledStartTime: doc.scheduledStartTime,
  scheduledEndTime: doc.scheduledEndTime,
  actualStartTime: doc.actualStartTime,
  actualEndTime: doc.actualEndTime,
  role: doc.role,
  assignedTime: doc.assignedTime,
  hoursWorked: doc.hoursWorked,
  overtimeHours: doc.overtimeHours,
  earlyLeaveHours: doc.earlyLeaveHours,
  notes: doc.notes,
  status: doc.status || 'not_started',
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
  createdBy: doc.createdBy
});

const transformAttendanceData = (doc: DocumentData): AttendanceRecord => ({
  id: doc.id,
  staffId: doc.staffId,
  workLogId: doc.workLogId,
  eventId: doc.eventId || '',
  status: doc.status || 'not_started',
  checkInTime: doc.checkInTime,
  checkOutTime: doc.checkOutTime,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const transformJobPostingData = (doc: DocumentData): JobPosting => ({
  id: doc.id,
  title: doc.title || '',
  location: doc.location || '',
  district: doc.district,
  detailedAddress: doc.detailedAddress,
  startDate: doc.startDate,
  endDate: doc.endDate,
  dateSpecificRequirements: doc.dateSpecificRequirements || [],
  timeSlots: doc.timeSlots || [],
  roles: doc.roles || [],
  requirements: doc.requirements,
  salary: doc.salary,
  status: doc.status || 'draft',
  createdBy: doc.createdBy || '',
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

/**
 * 🔄 Application 데이터 변환 (v2.0) - 자동 마이그레이션 지원
 */
const transformApplicationData = (doc: DocumentData): Application | null => {
  try {
    // 🎯 개발 단계: 모든 데이터는 새 구조로 저장됨 (마이그레이션 불필요)
    // 마이그레이션 로직 제거 - 실사용자 없음, 개발 단계

    // 🆕 새로운 구조 데이터 명시적 변환 (assignments 필드 보장)
    
    // Firebase 원시 데이터 처리
    
    // 🔧 핵심 수정: assignments와 postTitle 필드를 명시적으로 보존
    const application: Application = {
      ...doc, // 기본적으로 모든 Firebase 데이터를 포함
      id: doc.id,
      // 🎯 중요: Firebase에서 가져온 assignments를 명시적으로 보존
      assignments: doc.assignments || [],
      // postTitle 기본값 설정 (Firebase 데이터 우선, 없으면 기본값)
      postTitle: doc.postTitle || '제목 없음'
    } as Application;
    
    // Application 데이터 변환 완료

    return application;
    
  } catch (error) {
    logger.error('❌ Application 데이터 변환 오류:', error as Error, {
      component: 'unifiedDataService',
      data: { id: doc.id }
    });
    return null;
  }
};

const transformTournamentData = (doc: DocumentData): Tournament => ({
  id: doc.id,
  title: doc.title || '',
  date: doc.date || '',
  startTime: doc.startTime,
  endTime: doc.endTime,
  location: doc.location || '',
  detailedAddress: doc.detailedAddress,
  status: doc.status || 'upcoming',
  maxPlayers: doc.maxPlayers,
  currentPlayers: doc.currentPlayers,
  entryFee: doc.entryFee,
  prizePool: doc.prizePool,
  notes: doc.notes,
  createdBy: doc.createdBy || '',
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

// 통합 데이터 서비스 클래스
export class UnifiedDataService {
  private subscriptions: SubscriptionManager = {};
  private dispatcher: React.Dispatch<UnifiedDataAction> | null = null;
  private performanceTracker = new PerformanceTracker();
  private currentUserId: string | null = null;
  private currentEventId: string | null = null;
  private userRole: string | null = null;

  /**
   * 디스패처 설정
   */
  setDispatcher(dispatch: React.Dispatch<UnifiedDataAction>): void {
    this.dispatcher = dispatch;
  }

  /**
   * 현재 사용자 ID 설정 (선택적 데이터 필터링)
   */
  setCurrentUserId(userId: string | null): void {
    const wasChanged = this.currentUserId !== userId;
    this.currentUserId = userId;

    // 사용자가 변경되었다면 캐시 무효화 및 구독 재시작
    if (wasChanged && this.dispatcher) {
      this.invalidateAllCaches();
      this.restartUserSpecificSubscriptions();
    }
  }

  /**
   * 현재 이벤트 ID 설정 (공고별 데이터 필터링)
   */
  setCurrentEventId(eventId: string | null): void {
    const wasChanged = this.currentEventId !== eventId;
    this.currentEventId = eventId;

    // eventId가 변경되면 WorkLogs 구독을 재시작하여 필터링 적용
    if (wasChanged && this.dispatcher) {
      this.restartUserSpecificSubscriptions();
    }
  }

  /**
   * 사용자 role 설정 (관리자 권한 확인)
   */
  setUserRole(role: string | null): void {
    const wasChanged = this.userRole !== role;
    this.userRole = role;

    // Role이 변경되었다면 캐시 무효화 및 구독 재시작
    if (wasChanged && this.dispatcher) {
      this.invalidateAllCaches();
      this.restartUserSpecificSubscriptions();
    }
  }

  /**
   * 관리자 권한 확인
   */
  private isAdmin(): boolean {
    return this.userRole === 'admin' || this.userRole === 'manager';
  }

  /**
   * 모든 캐시 무효화
   */
  private invalidateAllCaches(): void {
    if (!this.dispatcher) return;

    // 모든 컬렉션의 캐시 무효화

    // 모든 컬렉션의 캐시 키 업데이트
    this.dispatcher({ type: 'INVALIDATE_CACHE', collection: 'applications' });
    this.dispatcher({ type: 'INVALIDATE_CACHE', collection: 'workLogs' });
    this.dispatcher({ type: 'INVALIDATE_CACHE', collection: 'attendanceRecords' });
    
    this.performanceTracker.incrementCacheMisses();
  }

  /**
   * 사용자별 구독 재시작
   */
  private async restartUserSpecificSubscriptions(): Promise<void> {
    try {
      // 사용자별 구독만 재시작 (staff, jobPostings, tournaments는 유지)
      if (this.subscriptions.applications) {
        this.subscriptions.applications();
        delete this.subscriptions.applications;
      }
      if (this.subscriptions.workLogs) {
        this.subscriptions.workLogs();
        delete this.subscriptions.workLogs;
      }
      if (this.subscriptions.attendanceRecords) {
        this.subscriptions.attendanceRecords();
        delete this.subscriptions.attendanceRecords;
      }

      // 새로운 구독 시작
      await Promise.all([
        this.subscribeToApplications(),
        this.subscribeToWorkLogs(),
        this.subscribeToAttendanceRecords(),
      ]);
    } catch (error) {
      logger.error('UnifiedDataService: 구독 재시작 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'unifiedDataService'
      });
    }
  }

  /**
   * 모든 Firebase 구독 시작
   */
  async startAllSubscriptions(): Promise<void> {
    if (!this.dispatcher) {
      throw new Error('Dispatcher not set. Call setDispatcher() first.');
    }

    // 모든 구독 시작

    try {
      // 병렬로 모든 구독 시작
      await Promise.all([
        this.subscribeToStaff(),
        this.subscribeToWorkLogs(),
        this.subscribeToAttendanceRecords(),
        this.subscribeToJobPostings(),
        this.subscribeToApplications(),
        this.subscribeToTournaments(),
      ]);

      // 모든 구독 완료
    } catch (error) {
      this.performanceTracker.incrementErrors();
      logger.error('UnifiedDataService: 구독 시작 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'unifiedDataService'
      });
      this.dispatcher({
        type: 'SET_ERROR',
        collection: 'global',
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      });
    }
  }

  /**
   * Staff 컬렉션 구독
   */
  private async subscribeToStaff(): Promise<void> {
    if (!this.dispatcher) return;

    const _endTimer = this.performanceTracker.startTimer(); // 성능 추적용
    
    try {
      this.dispatcher({ type: 'SET_LOADING', collection: 'staff', loading: true });

      // 🚫 persons 컬렉션 비활성화 - WorkLog의 staffInfo를 사용
      // WorkLog에서 고유한 스태프 정보를 추출하여 사용
      
      logger.info('Staff 구독 비활성화 (WorkLog 통합)', {
        component: 'unifiedDataService'
      });

      // 빈 배열로 설정하여 WorkLog 기반 데이터를 사용하도록 함
      if (this.dispatcher) {
        this.dispatcher({ type: 'SET_STAFF', data: [] });
        this.dispatcher({ type: 'SET_LOADING', collection: 'staff', loading: false });
        this.dispatcher({ type: 'SET_ERROR', collection: 'staff', error: null });
        this.dispatcher({ type: 'UPDATE_LAST_UPDATED', collection: 'staff' });
      }

      this.performanceTracker.incrementSubscriptions();
    } catch (error) {
      this.performanceTracker.incrementErrors();
      logger.error('Staff 구독 설정 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'unifiedDataService'
      });
      if (this.dispatcher) {
        this.dispatcher({ type: 'SET_ERROR', collection: 'staff', error: 'Staff 데이터 구독 실패' });
        this.dispatcher({ type: 'SET_LOADING', collection: 'staff', loading: false });
      }
    }
  }

  /**
   * WorkLogs 컬렉션 구독
   */
  private async subscribeToWorkLogs(): Promise<void> {
    if (!this.dispatcher) return;

    const _endTimer = this.performanceTracker.startTimer(); // 성능 추적용
    
    try {
      this.dispatcher({ type: 'SET_LOADING', collection: 'workLogs', loading: true });

      // 사용자별 필터링 쿼리 구성
      let workLogsQuery;
      if (this.currentUserId && !this.isAdmin()) {
        // 🔥 일반 사용자: staffId가 userId로 시작하는 모든 WorkLog 가져오기
        // assignment index 때문에 exact match가 안되므로 array-contains-any 또는 전체 조회 후 필터링
        // Firebase에서는 "starts with" 쿼리가 직접 지원되지 않으므로, 
        // 전체 데이터를 가져온 후 클라이언트에서 필터링
        workLogsQuery = query(
          collection(db, 'workLogs'),
          orderBy('date', 'desc')
        );
        logger.info('WorkLogs 사용자별 필터링 쿼리 (클라이언트 필터링)', { 
          component: 'unifiedDataService',
          data: { userId: this.currentUserId, note: 'staffId 시작 패턴 매칭을 위해 전체 조회 후 필터링' }
        });
      } else {
        // 전체 근무 기록 가져오기 (관리자용 또는 userId 없음)
        workLogsQuery = query(
          collection(db, 'workLogs'),
          orderBy('date', 'desc')
        );
        logger.info('WorkLogs 전체 데이터 쿼리', { 
          component: 'unifiedDataService',
          data: { isAdmin: this.isAdmin(), hasUserId: !!this.currentUserId }
        });
      }

      this.subscriptions.workLogs = onSnapshot(
        workLogsQuery,
        { includeMetadataChanges: true }, // 🔥 메타데이터 변경도 감지하여 실시간성 강화
        (snapshot: QuerySnapshot) => {
          const _queryTime = _endTimer(); // 성능 추적용
          
          // 🔥 변경된 문서만 효율적으로 처리
          const changes = snapshot.docChanges({ includeMetadataChanges: true });
          
          if (changes.length > 0) {
            logger.info('🔄 WorkLogs 실시간 변경 감지', {
              component: 'unifiedDataService',
              data: {
                totalChanges: changes.length,
                changeTypes: changes.map(change => ({
                  type: change.type,
                  docId: change.doc.id,
                  fromCache: change.doc.metadata.fromCache
                }))
              }
            });
          }

          // WorkLogs 데이터 업데이트 처리
          const workLogsData: WorkLog[] = [];
          let filteredCount = 0;
          let totalCount = 0;
          
          snapshot.forEach((doc) => {
            try {
              totalCount++;
              const rawData = { id: doc.id, ...doc.data() };
              const workLog = transformWorkLogData(rawData);
              
              // 🔥 클라이언트 측 필터링: staffId가 userId로 시작하는지 확인 + eventId 필터링
              if (this.currentUserId && !this.isAdmin()) {
                // 사용자별 필터링: staffId가 현재 userId로 시작하는지 확인
                const matchesUser = workLog.staffId && workLog.staffId.startsWith(this.currentUserId);
                // 공고별 필터링: currentEventId가 설정된 경우 해당 공고의 WorkLog만 포함
                const matchesEvent = !this.currentEventId || workLog.eventId === this.currentEventId;
                
                if (matchesUser && matchesEvent) {
                  workLogsData.push(workLog);
                  filteredCount++;
                }
                // 조건에 맞지 않는 WorkLog는 제외
              } else {
                // 관리자이거나 userId가 없으면 eventId 필터링만 적용
                const matchesEvent = !this.currentEventId || workLog.eventId === this.currentEventId;
                
                if (matchesEvent) {
                  workLogsData.push(workLog);
                  filteredCount++;
                }
              }
            } catch (error) {
              logger.warn('WorkLog 데이터 변환 오류', { component: 'unifiedDataService', data: { docId: doc.id, error } });
            }
          });

          // 🔍 필터링 결과 로깅
          if (this.currentUserId && !this.isAdmin()) {
            logger.info('🔍 WorkLog 클라이언트 필터링 결과', {
              component: 'unifiedDataService',
              data: {
                userId: this.currentUserId,
                eventId: this.currentEventId,
                totalWorkLogs: totalCount,
                filteredWorkLogs: filteredCount,
                workLogsMapSize: workLogsData.length,
                filteringMode: this.currentEventId ? 'user+event' : 'user-only',
                sampleWorkLogIds: workLogsData.slice(0, 3).map(wl => wl.id)
              }
            });
          } else if (this.currentEventId) {
            // 관리자 모드에서도 eventId 필터링이 적용된 경우 로깅
            logger.info('🔍 WorkLog eventId 필터링 결과 (관리자)', {
              component: 'unifiedDataService',
              data: {
                eventId: this.currentEventId,
                totalWorkLogs: totalCount,
                filteredWorkLogs: filteredCount,
                workLogsMapSize: workLogsData.length
              }
            });
          }

          if (this.dispatcher) {
            this.dispatcher({ type: 'SET_WORK_LOGS', data: workLogsData });
            this.dispatcher({ type: 'SET_LOADING', collection: 'workLogs', loading: false });
            this.dispatcher({ type: 'SET_ERROR', collection: 'workLogs', error: null });
            this.dispatcher({ type: 'UPDATE_LAST_UPDATED', collection: 'workLogs' });
          }
        },
        (error) => {
          this.performanceTracker.incrementErrors();
          logger.error('WorkLogs 구독 오류', error, { component: 'unifiedDataService' });
          if (this.dispatcher) {
            this.dispatcher({ type: 'SET_ERROR', collection: 'workLogs', error: error.message });
            this.dispatcher({ type: 'SET_LOADING', collection: 'workLogs', loading: false });
          }
        }
      );

      this.performanceTracker.incrementSubscriptions();
    } catch (error) {
      this.performanceTracker.incrementErrors();
      logger.error('WorkLogs 구독 설정 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'unifiedDataService'
      });
      if (this.dispatcher) {
        this.dispatcher({ type: 'SET_ERROR', collection: 'workLogs', error: 'WorkLogs 데이터 구독 실패' });
        this.dispatcher({ type: 'SET_LOADING', collection: 'workLogs', loading: false });
      }
    }
  }

  /**
   * AttendanceRecords 컬렉션 구독
   */
  private async subscribeToAttendanceRecords(): Promise<void> {
    if (!this.dispatcher) return;

    const _endTimer = this.performanceTracker.startTimer(); // 성능 추적용
    
    try {
      this.dispatcher({ type: 'SET_LOADING', collection: 'attendanceRecords', loading: true });

      // 사용자별 필터링 쿼리 구성
      let attendanceQuery;
      if (this.currentUserId && !this.isAdmin()) {
        // 🔥 일반 사용자: staffId가 userId로 시작하는 모든 AttendanceRecord 가져오기 (클라이언트 필터링)
        attendanceQuery = query(
          collection(db, 'attendanceRecords'),
          orderBy('createdAt', 'desc')
        );
        logger.info('AttendanceRecords 사용자별 필터링 쿼리 (클라이언트 필터링)', { 
          component: 'unifiedDataService',
          data: { userId: this.currentUserId, note: 'staffId 시작 패턴 매칭을 위해 전체 조회 후 필터링' }
        });
      } else {
        // 전체 출석 기록 가져오기 (관리자용 또는 userId 없음)
        attendanceQuery = query(
          collection(db, 'attendanceRecords'),
          orderBy('createdAt', 'desc')
        );
        logger.info('AttendanceRecords 전체 데이터 쿼리', { 
          component: 'unifiedDataService',
          data: { isAdmin: this.isAdmin(), hasUserId: !!this.currentUserId }
        });
      }

      this.subscriptions.attendanceRecords = onSnapshot(
        attendanceQuery,
        (snapshot: QuerySnapshot) => {
          const _queryTime = _endTimer(); // 성능 추적용
          // AttendanceRecords 데이터 업데이트 처리
          const attendanceData: AttendanceRecord[] = [];
          let filteredCount = 0;
          let totalCount = 0;
          
          snapshot.forEach((doc) => {
            try {
              totalCount++;
              const rawData = { id: doc.id, ...doc.data() };
              const attendanceRecord = transformAttendanceData(rawData);
              
              // 🔥 클라이언트 측 필터링: staffId가 userId로 시작하는지 확인
              if (this.currentUserId && !this.isAdmin()) {
                if (attendanceRecord.staffId && attendanceRecord.staffId.startsWith(this.currentUserId)) {
                  attendanceData.push(attendanceRecord);
                  filteredCount++;
                }
                // userId와 매칭되지 않는 AttendanceRecord는 제외
              } else {
                // 관리자이거나 userId가 없으면 모든 데이터 포함
                attendanceData.push(attendanceRecord);
                filteredCount++;
              }
            } catch (error) {
              logger.warn('AttendanceRecord 데이터 변환 오류', { component: 'unifiedDataService', data: { docId: doc.id, error } });
            }
          });

          // 🔍 필터링 결과 로깅 (WorkLog보다 간단하게)
          if (this.currentUserId && !this.isAdmin() && totalCount > 0) {
            logger.info('🔍 AttendanceRecords 클라이언트 필터링 결과', {
              component: 'unifiedDataService',
              data: {
                userId: this.currentUserId,
                totalRecords: totalCount,
                filteredRecords: filteredCount
              }
            });
          }

          if (this.dispatcher) {
            this.dispatcher({ type: 'SET_ATTENDANCE_RECORDS', data: attendanceData });
            this.dispatcher({ type: 'SET_LOADING', collection: 'attendanceRecords', loading: false });
            this.dispatcher({ type: 'SET_ERROR', collection: 'attendanceRecords', error: null });
            this.dispatcher({ type: 'UPDATE_LAST_UPDATED', collection: 'attendanceRecords' });
          }
        },
        (error) => {
          this.performanceTracker.incrementErrors();
          logger.error('AttendanceRecords 구독 오류', error, { component: 'unifiedDataService' });
          if (this.dispatcher) {
            this.dispatcher({ type: 'SET_ERROR', collection: 'attendanceRecords', error: error.message });
            this.dispatcher({ type: 'SET_LOADING', collection: 'attendanceRecords', loading: false });
          }
        }
      );

      this.performanceTracker.incrementSubscriptions();
    } catch (error) {
      this.performanceTracker.incrementErrors();
      logger.error('AttendanceRecords 구독 설정 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'unifiedDataService'
      });
      if (this.dispatcher) {
        this.dispatcher({ type: 'SET_ERROR', collection: 'attendanceRecords', error: 'AttendanceRecords 데이터 구독 실패' });
        this.dispatcher({ type: 'SET_LOADING', collection: 'attendanceRecords', loading: false });
      }
    }
  }

  /**
   * JobPostings 컬렉션 구독
   */
  private async subscribeToJobPostings(): Promise<void> {
    if (!this.dispatcher) return;

    const _endTimer = this.performanceTracker.startTimer(); // 성능 추적용
    
    try {
      this.dispatcher({ type: 'SET_LOADING', collection: 'jobPostings', loading: true });

      const jobPostingsQuery = query(
        collection(db, 'jobPostings'),
        orderBy('createdAt', 'desc')
      );

      this.subscriptions.jobPostings = onSnapshot(
        jobPostingsQuery,
        (snapshot: QuerySnapshot) => {
          const _queryTime = _endTimer(); // 성능 추적용
          // JobPostings 데이터 업데이트 처리

          const jobPostingsData: JobPosting[] = [];
          snapshot.forEach((doc) => {
            try {
              jobPostingsData.push(transformJobPostingData({ id: doc.id, ...doc.data() }));
            } catch (error) {
              logger.warn('JobPosting 데이터 변환 오류', { component: 'unifiedDataService', data: { docId: doc.id, error } });
            }
          });

          if (this.dispatcher) {
            this.dispatcher({ type: 'SET_JOB_POSTINGS', data: jobPostingsData });
            this.dispatcher({ type: 'SET_LOADING', collection: 'jobPostings', loading: false });
            this.dispatcher({ type: 'SET_ERROR', collection: 'jobPostings', error: null });
            this.dispatcher({ type: 'UPDATE_LAST_UPDATED', collection: 'jobPostings' });
          }
        },
        (error) => {
          this.performanceTracker.incrementErrors();
          logger.error('JobPostings 구독 오류', error, { component: 'unifiedDataService' });
          if (this.dispatcher) {
            this.dispatcher({ type: 'SET_ERROR', collection: 'jobPostings', error: error.message });
            this.dispatcher({ type: 'SET_LOADING', collection: 'jobPostings', loading: false });
          }
        }
      );

      this.performanceTracker.incrementSubscriptions();
    } catch (error) {
      this.performanceTracker.incrementErrors();
      logger.error('JobPostings 구독 설정 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'unifiedDataService'
      });
      if (this.dispatcher) {
        this.dispatcher({ type: 'SET_ERROR', collection: 'jobPostings', error: 'JobPostings 데이터 구독 실패' });
        this.dispatcher({ type: 'SET_LOADING', collection: 'jobPostings', loading: false });
      }
    }
  }

  /**
   * Applications 컬렉션 구독 (단순 쿼리 방식)
   */
  private async subscribeToApplications(): Promise<void> {
    if (!this.dispatcher) return;

    const _endTimer = this.performanceTracker.startTimer(); // 성능 추적용
    
    try {
      this.dispatcher({ type: 'SET_LOADING', collection: 'applications', loading: true });

      // 인덱스 문제를 피하기 위해 orderBy 제거하고 단순 쿼리로 테스트
      const applicationsQuery = query(
        collection(db, 'applications')
        // orderBy('createdAt', 'desc') // 임시로 비활성화
      );

      this.subscriptions.applications = onSnapshot(
        applicationsQuery,
        (snapshot: QuerySnapshot) => {
          const _queryTime = _endTimer(); // 성능 추적용
          
          // 더 자세한 디버깅 정보 추가
          // Applications 데이터 업데이트 처리

          const applicationsData: Application[] = [];
          const rawDocs: any[] = [];
          
          snapshot.forEach((doc) => {
            try {
              const rawData = { id: doc.id, ...doc.data() };
              rawDocs.push(rawData);
              
              // 🔄 변환 결과가 null이 아닌 경우만 추가 (마이그레이션 실패한 경우 제외)
              const transformedApplication = transformApplicationData(rawData);
              if (transformedApplication) {
                applicationsData.push(transformedApplication);
              }
            } catch (error) {
              logger.warn('Application 데이터 변환 오류', { 
                component: 'unifiedDataService', 
                data: { docId: doc.id, rawData: doc.data(), error } 
              });
            }
          });

          // Raw 데이터 로깅 추가
          if (rawDocs.length > 0) {
            logger.info('Applications 원시 데이터', {
              component: 'unifiedDataService',
              data: { 
                rawDocs: rawDocs.map(doc => ({
                  id: doc.id,
                  applicantId: doc.applicantId,
                  postId: doc.postId,
                  status: doc.status
                }))
              }
            });
          }

          if (this.dispatcher) {
            this.dispatcher({ type: 'SET_APPLICATIONS', data: applicationsData });
            this.dispatcher({ type: 'SET_LOADING', collection: 'applications', loading: false });
            this.dispatcher({ type: 'SET_ERROR', collection: 'applications', error: null });
            this.dispatcher({ type: 'UPDATE_LAST_UPDATED', collection: 'applications' });
          }
        },
        (error) => {
          this.handleApplicationsError(error);
        }
      );

      this.performanceTracker.incrementSubscriptions();
    } catch (error) {
      this.performanceTracker.incrementErrors();
      logger.error('Applications 구독 설정 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'unifiedDataService'
      });
      if (this.dispatcher) {
        this.dispatcher({ type: 'SET_ERROR', collection: 'applications', error: 'Applications 데이터 구독 실패' });
        this.dispatcher({ type: 'SET_LOADING', collection: 'applications', loading: false });
      }
    }
  }


  /**
   * Applications 에러 처리 헬퍼 메서드
   */
  private handleApplicationsError(error: any): void {
    this.performanceTracker.incrementErrors();
    
    // 권한 오류와 인덱스 오류 구분
    let errorMessage = error.message;
    if (error.code === 'permission-denied') {
      errorMessage = 'Applications 접근 권한이 없습니다. 로그인 상태를 확인하세요.';
    } else if (error.message?.includes('index')) {
      errorMessage = 'Firebase 인덱스 설정이 필요합니다. 관리자에게 문의하세요.';
    }
    
    logger.error('Applications 구독 오류', error, { 
      component: 'unifiedDataService',
      data: { 
        code: error.code,
        originalMessage: error.message,
        processedMessage: errorMessage
      }
    });
    
    if (this.dispatcher) {
      this.dispatcher({ type: 'SET_ERROR', collection: 'applications', error: errorMessage });
      this.dispatcher({ type: 'SET_LOADING', collection: 'applications', loading: false });
    }
  }

  /**
   * Tournaments 컬렉션 구독
   */
  private async subscribeToTournaments(): Promise<void> {
    if (!this.dispatcher) return;

    const _endTimer = this.performanceTracker.startTimer(); // 성능 추적용
    
    try {
      this.dispatcher({ type: 'SET_LOADING', collection: 'tournaments', loading: true });

      const tournamentsQuery = query(
        collection(db, 'tournaments'),
        orderBy('date', 'desc')
      );

      this.subscriptions.tournaments = onSnapshot(
        tournamentsQuery,
        (snapshot: QuerySnapshot) => {
          const _queryTime = _endTimer(); // 성능 추적용
          // Tournaments 데이터 업데이트 처리

          const tournamentsData: Tournament[] = [];
          snapshot.forEach((doc) => {
            try {
              tournamentsData.push(transformTournamentData({ id: doc.id, ...doc.data() }));
            } catch (error) {
              logger.warn('Tournament 데이터 변환 오류', { component: 'unifiedDataService', data: { docId: doc.id, error } });
            }
          });

          if (this.dispatcher) {
            this.dispatcher({ type: 'SET_TOURNAMENTS', data: tournamentsData });
            this.dispatcher({ type: 'SET_LOADING', collection: 'tournaments', loading: false });
            this.dispatcher({ type: 'SET_ERROR', collection: 'tournaments', error: null });
            this.dispatcher({ type: 'UPDATE_LAST_UPDATED', collection: 'tournaments' });
          }
        },
        (error) => {
          this.performanceTracker.incrementErrors();
          logger.error('Tournaments 구독 오류', error, { component: 'unifiedDataService' });
          if (this.dispatcher) {
            this.dispatcher({ type: 'SET_ERROR', collection: 'tournaments', error: error.message });
            this.dispatcher({ type: 'SET_LOADING', collection: 'tournaments', loading: false });
          }
        }
      );

      this.performanceTracker.incrementSubscriptions();
    } catch (error) {
      this.performanceTracker.incrementErrors();
      logger.error('Tournaments 구독 설정 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'unifiedDataService'
      });
      if (this.dispatcher) {
        this.dispatcher({ type: 'SET_ERROR', collection: 'tournaments', error: 'Tournaments 데이터 구독 실패' });
        this.dispatcher({ type: 'SET_LOADING', collection: 'tournaments', loading: false });
      }
    }
  }

  /**
   * 모든 구독 해제
   */
  stopAllSubscriptions(): void {
    // 모든 구독 해제 시작

    Object.entries(this.subscriptions).forEach(([key, unsubscribe]) => {
      if (unsubscribe) {
        try {
          unsubscribe();
          this.performanceTracker.decrementSubscriptions();
          // 구독 해제 완료
        } catch (error) {
          logger.warn(`${key} 구독 해제 중 오류`, { component: 'unifiedDataService', data: { error } });
        }
      }
    });

    this.subscriptions = {};
    // 모든 구독 해제 완료
  }

  /**
   * 성능 메트릭 조회
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return this.performanceTracker.getMetrics();
  }

  /**
   * 캐시 적중률 조회
   */
  getCacheHitRate(): number {
    return this.performanceTracker.getCacheHitRate();
  }

  /**
   * 평균 쿼리 시간 조회
   */
  getAverageQueryTime(): number {
    return this.performanceTracker.getAverageQueryTime();
  }
}

// 싱글톤 인스턴스
export const unifiedDataService = new UnifiedDataService();