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

  /**
   * 디스패처 설정
   */
  setDispatcher(dispatch: React.Dispatch<UnifiedDataAction>): void {
    this.dispatcher = dispatch;
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

      const staffQuery = query(
        collection(db, 'staff'),
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

      const workLogsQuery = query(
        collection(db, 'workLogs'),
        orderBy('date', 'desc')
      );

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

      const attendanceQuery = query(
        collection(db, 'attendanceRecords'),
        orderBy('createdAt', 'desc')
      );

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

      const applicationsQuery = query(
        collection(db, 'applications'),
        orderBy('createdAt', 'desc')
      );

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
          logger.error('Applications 구독 오류', error, { component: 'unifiedDataService' });
          if (this.dispatcher) {
            this.dispatcher({ type: 'SET_ERROR', collection: 'applications', error: error.message });
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