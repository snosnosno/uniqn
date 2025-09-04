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
  where,
  orderBy,
  Unsubscribe,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import {
  Staff,
  WorkLog,
  AttendanceRecord,
  JobPosting,
  Application,
  Tournament,
  UnifiedDataAction,
  PerformanceMetrics,
} from '../types/unifiedData';

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

// 데이터 변환 유틸리티
const transformStaffData = (doc: DocumentData): Staff => ({
  id: doc.id,
  staffId: doc.staffId || doc.id,
  name: doc.name || '',
  role: doc.role || '',
  phone: doc.phone,
  email: doc.email,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const transformWorkLogData = (doc: DocumentData): WorkLog => ({
  id: doc.id,
  staffId: doc.staffId,
  staffName: doc.staffName || '',
  eventId: doc.eventId || '',
  date: doc.date || '',
  scheduledStartTime: doc.scheduledStartTime,
  scheduledEndTime: doc.scheduledEndTime,
  actualStartTime: doc.actualStartTime,
  actualEndTime: doc.actualEndTime,
  role: doc.role,
  hoursWorked: doc.hoursWorked,
  overtimeHours: doc.overtimeHours,
  earlyLeaveHours: doc.earlyLeaveHours,
  notes: doc.notes,
  status: doc.status || 'scheduled',
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const transformAttendanceData = (doc: DocumentData): AttendanceRecord => ({
  id: doc.id,
  staffId: doc.staffId,
  workLogId: doc.workLogId,
  eventId: doc.eventId || '',
  status: doc.status || 'not_started',
  checkInTime: doc.checkInTime,
  checkOutTime: doc.checkOutTime,
  location: doc.location,
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

const transformApplicationData = (doc: DocumentData): Application => ({
  id: doc.id,
  postId: doc.postId || '',
  postTitle: doc.postTitle || '',
  applicantId: doc.applicantId || '',
  applicantName: doc.applicantName || '',
  applicantPhone: doc.applicantPhone,
  applicantEmail: doc.applicantEmail,
  status: doc.status || 'pending',
  role: doc.role,
  assignedRole: doc.assignedRole,
  assignedRoles: doc.assignedRoles,
  confirmedRole: doc.confirmedRole,
  assignedDate: doc.assignedDate,
  assignedDates: doc.assignedDates,
  assignedTime: doc.assignedTime,
  assignedTimes: doc.assignedTimes,
  confirmedTime: doc.confirmedTime,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
  appliedAt: doc.appliedAt,
  confirmedAt: doc.confirmedAt,
});

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
    
    logger.info('UnifiedDataService: 사용자 ID 설정', { 
      component: 'unifiedDataService',
      data: { userId, hasUserId: !!userId, wasChanged }
    });

    // 사용자가 변경되었다면 캐시 무효화 및 구독 재시작
    if (wasChanged && this.dispatcher) {
      this.invalidateAllCaches();
      this.restartUserSpecificSubscriptions();
    }
  }

  /**
   * 모든 캐시 무효화
   */
  private invalidateAllCaches(): void {
    if (!this.dispatcher) return;

    logger.info('UnifiedDataService: 캐시 무효화 시작', { 
      component: 'unifiedDataService' 
    });

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

      logger.info('UnifiedDataService: 사용자별 구독 재시작 완료', { 
        component: 'unifiedDataService' 
      });
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

    logger.info('UnifiedDataService: 모든 구독 시작', { component: 'unifiedDataService' });

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

      logger.info('UnifiedDataService: 모든 구독 완료', { 
        component: 'unifiedDataService',
        data: { subscriptionCount: this.performanceTracker.getMetrics().subscriptionCount }
      });
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

    const endTimer = this.performanceTracker.startTimer();
    
    try {
      this.dispatcher({ type: 'SET_LOADING', collection: 'staff', loading: true });

      // persons 컬렉션에서 staff 타입의 데이터만 가져옴
      const staffQuery = query(
        collection(db, 'persons'),
        where('type', 'in', ['staff', 'both']),
        orderBy('name', 'asc')
      );

      this.subscriptions.staff = onSnapshot(
        staffQuery,
        (snapshot: QuerySnapshot) => {
          const queryTime = endTimer();
          logger.info('Staff 데이터 업데이트', { 
            component: 'unifiedDataService',
            data: { count: snapshot.size, queryTime: `${queryTime.toFixed(2)}ms` }
          });

          const staffData: Staff[] = [];
          snapshot.forEach((doc) => {
            try {
              staffData.push(transformStaffData({ id: doc.id, ...doc.data() }));
            } catch (error) {
              logger.warn('Staff 데이터 변환 오류', { component: 'unifiedDataService', data: { docId: doc.id, error } });
            }
          });

          if (this.dispatcher) {
            this.dispatcher({ type: 'SET_STAFF', data: staffData });
            this.dispatcher({ type: 'SET_LOADING', collection: 'staff', loading: false });
            this.dispatcher({ type: 'SET_ERROR', collection: 'staff', error: null });
            this.dispatcher({ type: 'UPDATE_LAST_UPDATED', collection: 'staff' });
          }
        },
        (error) => {
          this.performanceTracker.incrementErrors();
          logger.error('Staff 구독 오류', error, { component: 'unifiedDataService' });
          if (this.dispatcher) {
            this.dispatcher({ type: 'SET_ERROR', collection: 'staff', error: error.message });
            this.dispatcher({ type: 'SET_LOADING', collection: 'staff', loading: false });
          }
        }
      );

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

    const endTimer = this.performanceTracker.startTimer();
    
    try {
      this.dispatcher({ type: 'SET_LOADING', collection: 'workLogs', loading: true });

      // 사용자별 필터링 쿼리 구성
      let workLogsQuery;
      if (this.currentUserId) {
        // 현재 사용자의 근무 기록만 가져오기
        workLogsQuery = query(
          collection(db, 'workLogs'),
          where('staffId', '==', this.currentUserId),
          orderBy('date', 'desc')
        );
        logger.info('WorkLogs 사용자별 필터링 쿼리', { 
          component: 'unifiedDataService',
          data: { userId: this.currentUserId }
        });
      } else {
        // 전체 근무 기록 가져오기 (관리자용)
        workLogsQuery = query(
          collection(db, 'workLogs'),
          orderBy('date', 'desc')
        );
        logger.info('WorkLogs 전체 데이터 쿼리', { 
          component: 'unifiedDataService'
        });
      }

      this.subscriptions.workLogs = onSnapshot(
        workLogsQuery,
        (snapshot: QuerySnapshot) => {
          const queryTime = endTimer();
          logger.info('WorkLogs 데이터 업데이트', { 
            component: 'unifiedDataService',
            data: { count: snapshot.size, queryTime: `${queryTime.toFixed(2)}ms` }
          });

          const workLogsData: WorkLog[] = [];
          snapshot.forEach((doc) => {
            try {
              workLogsData.push(transformWorkLogData({ id: doc.id, ...doc.data() }));
            } catch (error) {
              logger.warn('WorkLog 데이터 변환 오류', { component: 'unifiedDataService', data: { docId: doc.id, error } });
            }
          });

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

    const endTimer = this.performanceTracker.startTimer();
    
    try {
      this.dispatcher({ type: 'SET_LOADING', collection: 'attendanceRecords', loading: true });

      // 사용자별 필터링 쿼리 구성
      let attendanceQuery;
      if (this.currentUserId) {
        // 현재 사용자의 출석 기록만 가져오기
        attendanceQuery = query(
          collection(db, 'attendanceRecords'),
          where('staffId', '==', this.currentUserId),
          orderBy('createdAt', 'desc')
        );
        logger.info('AttendanceRecords 사용자별 필터링 쿼리', { 
          component: 'unifiedDataService',
          data: { userId: this.currentUserId }
        });
      } else {
        // 전체 출석 기록 가져오기 (관리자용)
        attendanceQuery = query(
          collection(db, 'attendanceRecords'),
          orderBy('createdAt', 'desc')
        );
        logger.info('AttendanceRecords 전체 데이터 쿼리', { 
          component: 'unifiedDataService'
        });
      }

      this.subscriptions.attendanceRecords = onSnapshot(
        attendanceQuery,
        (snapshot: QuerySnapshot) => {
          const queryTime = endTimer();
          logger.info('AttendanceRecords 데이터 업데이트', { 
            component: 'unifiedDataService',
            data: { count: snapshot.size, queryTime: `${queryTime.toFixed(2)}ms` }
          });

          const attendanceData: AttendanceRecord[] = [];
          snapshot.forEach((doc) => {
            try {
              attendanceData.push(transformAttendanceData({ id: doc.id, ...doc.data() }));
            } catch (error) {
              logger.warn('AttendanceRecord 데이터 변환 오류', { component: 'unifiedDataService', data: { docId: doc.id, error } });
            }
          });

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

    const endTimer = this.performanceTracker.startTimer();
    
    try {
      this.dispatcher({ type: 'SET_LOADING', collection: 'jobPostings', loading: true });

      const jobPostingsQuery = query(
        collection(db, 'jobPostings'),
        orderBy('createdAt', 'desc')
      );

      this.subscriptions.jobPostings = onSnapshot(
        jobPostingsQuery,
        (snapshot: QuerySnapshot) => {
          const queryTime = endTimer();
          logger.info('JobPostings 데이터 업데이트', { 
            component: 'unifiedDataService',
            data: { count: snapshot.size, queryTime: `${queryTime.toFixed(2)}ms` }
          });

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
   * Applications 컬렉션 구독
   */
  private async subscribeToApplications(): Promise<void> {
    if (!this.dispatcher) return;

    const endTimer = this.performanceTracker.startTimer();
    
    try {
      this.dispatcher({ type: 'SET_LOADING', collection: 'applications', loading: true });

      // 사용자별 필터링 쿼리 구성
      let applicationsQuery;
      if (this.currentUserId) {
        // 현재 사용자의 지원서만 가져오기
        applicationsQuery = query(
          collection(db, 'applications'),
          where('applicantId', '==', this.currentUserId),
          orderBy('createdAt', 'desc')
        );
        logger.info('Applications 사용자별 필터링 쿼리', { 
          component: 'unifiedDataService',
          data: { userId: this.currentUserId }
        });
      } else {
        // 전체 지원서 가져오기 (관리자용)
        applicationsQuery = query(
          collection(db, 'applications'),
          orderBy('createdAt', 'desc')
        );
        logger.info('Applications 전체 데이터 쿼리', { 
          component: 'unifiedDataService'
        });
      }

      this.subscriptions.applications = onSnapshot(
        applicationsQuery,
        (snapshot: QuerySnapshot) => {
          const queryTime = endTimer();
          logger.info('Applications 데이터 업데이트', { 
            component: 'unifiedDataService',
            data: { count: snapshot.size, queryTime: `${queryTime.toFixed(2)}ms` }
          });

          const applicationsData: Application[] = [];
          snapshot.forEach((doc) => {
            try {
              applicationsData.push(transformApplicationData({ id: doc.id, ...doc.data() }));
            } catch (error) {
              logger.warn('Application 데이터 변환 오류', { component: 'unifiedDataService', data: { docId: doc.id, error } });
            }
          });

          if (this.dispatcher) {
            this.dispatcher({ type: 'SET_APPLICATIONS', data: applicationsData });
            this.dispatcher({ type: 'SET_LOADING', collection: 'applications', loading: false });
            this.dispatcher({ type: 'SET_ERROR', collection: 'applications', error: null });
            this.dispatcher({ type: 'UPDATE_LAST_UPDATED', collection: 'applications' });
          }
        },
        (error) => {
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
   * Tournaments 컬렉션 구독
   */
  private async subscribeToTournaments(): Promise<void> {
    if (!this.dispatcher) return;

    const endTimer = this.performanceTracker.startTimer();
    
    try {
      this.dispatcher({ type: 'SET_LOADING', collection: 'tournaments', loading: true });

      const tournamentsQuery = query(
        collection(db, 'tournaments'),
        orderBy('date', 'desc')
      );

      this.subscriptions.tournaments = onSnapshot(
        tournamentsQuery,
        (snapshot: QuerySnapshot) => {
          const queryTime = endTimer();
          logger.info('Tournaments 데이터 업데이트', { 
            component: 'unifiedDataService',
            data: { count: snapshot.size, queryTime: `${queryTime.toFixed(2)}ms` }
          });

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
    logger.info('UnifiedDataService: 모든 구독 해제 시작', { component: 'unifiedDataService' });

    Object.entries(this.subscriptions).forEach(([key, unsubscribe]) => {
      if (unsubscribe) {
        try {
          unsubscribe();
          this.performanceTracker.decrementSubscriptions();
          logger.info(`${key} 구독 해제 완료`, { component: 'unifiedDataService' });
        } catch (error) {
          logger.warn(`${key} 구독 해제 중 오류`, { component: 'unifiedDataService', data: { error } });
        }
      }
    });

    this.subscriptions = {};
    logger.info('UnifiedDataService: 모든 구독 해제 완료', { component: 'unifiedDataService' });
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