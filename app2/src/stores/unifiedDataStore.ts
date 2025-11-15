/**
 * Zustand UnifiedDataStore
 *
 * UnifiedDataContext를 대체하는 전역 상태 관리 Store
 * - 5개 Firebase 컬렉션 관리 (staff, workLogs, applications, attendanceRecords, jobPostings)
 * - 실시간 구독 (onSnapshot)
 * - immer 미들웨어로 불변성 자동 처리
 * - devtools 미들웨어로 Redux DevTools 연동
 *
 * @version 1.0.0
 * @created 2025-11-15
 * @feature 001-zustand-migration
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';
import { enableMapSet } from 'immer';
import {
  collection,
  onSnapshot,
  query,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import type {
  Staff,
  WorkLog,
  AttendanceRecord,
  JobPosting,
} from '../types/unifiedData';
import type { Application } from '../types/application';

// Immer Map/Set 지원 활성화
enableMapSet();

/**
 * UnifiedDataStore State
 */
interface UnifiedDataState {
  // State
  staff: Map<string, Staff>;
  workLogs: Map<string, WorkLog>;
  applications: Map<string, Application>;
  attendanceRecords: Map<string, AttendanceRecord>;
  jobPostings: Map<string, JobPosting>;
  isLoading: boolean;
  error: string | null;
}

/**
 * UnifiedDataStore Selectors
 */
interface UnifiedDataSelectors {
  getStaffById: (id: string) => Staff | undefined;
  getWorkLogsByStaffId: (staffId: string) => WorkLog[];
  getWorkLogsByEventId: (eventId: string) => WorkLog[];
  getApplicationsByEventId: (eventId: string) => Application[];
  getApplicationsByApplicantId: (applicantId: string) => Application[];
  getAttendanceByStaffId: (staffId: string) => AttendanceRecord[];
  getAttendanceByEventId: (eventId: string) => AttendanceRecord[];
  getActiveJobPostings: () => JobPosting[];
  getScheduleEvents: () => any[]; // ScheduleEvent 타입 (호환성)
}

/**
 * UnifiedDataStore Actions
 */
interface UnifiedDataActions {
  // Firebase 구독 관리
  subscribeAll: (userId: string, role: string) => void;
  unsubscribeAll: () => void;

  // Staff CRUD
  setStaff: (staff: Map<string, Staff>) => void;
  updateStaff: (staff: Staff) => void;
  deleteStaff: (id: string) => void;

  // WorkLog CRUD
  setWorkLogs: (workLogs: Map<string, WorkLog>) => void;
  updateWorkLog: (workLog: WorkLog) => void;
  deleteWorkLog: (id: string) => void;

  // Application CRUD
  setApplications: (applications: Map<string, Application>) => void;
  updateApplication: (application: Application) => void;
  deleteApplication: (id: string) => void;

  // AttendanceRecord CRUD
  setAttendanceRecords: (records: Map<string, AttendanceRecord>) => void;
  updateAttendanceRecord: (record: AttendanceRecord) => void;
  deleteAttendanceRecord: (id: string) => void;

  // JobPosting CRUD
  setJobPostings: (jobPostings: Map<string, JobPosting>) => void;
  updateJobPosting: (posting: JobPosting) => void;
  deleteJobPosting: (id: string) => void;

  // 로딩/에러 상태 관리
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

/**
 * UnifiedDataStore 전체 타입
 */
type UnifiedDataStore = UnifiedDataState & UnifiedDataSelectors & UnifiedDataActions;

/**
 * Firebase 구독 Unsubscribe 함수 저장소
 * Store 외부에 저장하여 unsubscribeAll에서 정리
 */
let staffUnsubscribe: Unsubscribe | null = null;
let workLogsUnsubscribe: Unsubscribe | null = null;
let applicationsUnsubscribe: Unsubscribe | null = null;
let attendanceRecordsUnsubscribe: Unsubscribe | null = null;
let jobPostingsUnsubscribe: Unsubscribe | null = null;

/**
 * Zustand Store 생성
 *
 * Middleware 순서: devtools → immer
 * - devtools: Redux DevTools 연동 (개발 환경에서만 활성화)
 * - immer: 불변성 자동 처리 (draft 상태 수정 가능)
 */
export const useUnifiedDataStore = create<UnifiedDataStore>()(
  devtools(
    immer((set, get) => ({
      // ========== 초기 상태 ==========
      staff: new Map<string, Staff>(),
      workLogs: new Map<string, WorkLog>(),
      applications: new Map<string, Application>(),
      attendanceRecords: new Map<string, AttendanceRecord>(),
      jobPostings: new Map<string, JobPosting>(),
      isLoading: false,
      error: null,

      // ========== Selectors ==========

      /**
       * ID로 스태프 조회
       */
      getStaffById: (id: string): Staff | undefined => {
        return get().staff.get(id);
      },

      /**
       * staffId로 근무 기록 목록 조회
       */
      getWorkLogsByStaffId: (staffId: string): WorkLog[] => {
        const logs = Array.from(get().workLogs.values());
        return logs.filter(log => log.staffId === staffId);
      },

      /**
       * eventId로 근무 기록 목록 조회
       */
      getWorkLogsByEventId: (eventId: string): WorkLog[] => {
        const logs = Array.from(get().workLogs.values());
        return logs.filter(log => log.eventId === eventId || log.assignmentInfo?.postingId === eventId);
      },

      /**
       * eventId로 지원서 목록 조회
       */
      getApplicationsByEventId: (eventId: string): Application[] => {
        const apps = Array.from(get().applications.values());
        return apps.filter(app => app.eventId === eventId);
      },

      /**
       * applicantId로 지원서 목록 조회
       */
      getApplicationsByApplicantId: (applicantId: string): Application[] => {
        const apps = Array.from(get().applications.values());
        return apps.filter(app => app.applicantId === applicantId);
      },

      /**
       * staffId로 출석 기록 목록 조회
       */
      getAttendanceByStaffId: (staffId: string): AttendanceRecord[] => {
        const records = Array.from(get().attendanceRecords.values());
        return records.filter(record => record.staffId === staffId);
      },

      /**
       * eventId로 출석 기록 목록 조회
       */
      getAttendanceByEventId: (eventId: string): AttendanceRecord[] => {
        const records = Array.from(get().attendanceRecords.values());
        return records.filter(record => record.eventId === eventId);
      },

      /**
       * 활성화된 구인 공고 목록 조회
       */
      getActiveJobPostings: (): JobPosting[] => {
        const postings = Array.from(get().jobPostings.values());
        return postings.filter(posting => posting.status === 'open');
      },

      /**
       * 스케줄 이벤트 목록 조회 (호환성)
       * workLogs를 기반으로 ScheduleEvent 형태로 변환
       */
      getScheduleEvents: (): any[] => {
        const workLogs = Array.from(get().workLogs.values());
        const staff = get().staff;
        const jobPostings = get().jobPostings;

        return workLogs.map(log => {
          const staffData = staff.get(log.staffId);
          const eventId = log.eventId || log.assignmentInfo?.postingId || '';
          const posting = jobPostings.get(eventId);

          return {
            id: log.id,
            staffId: log.staffId,
            staffName: staffData?.name || log.staffInfo?.name || log.staffName,
            eventId: eventId,
            eventName: posting?.title || '',
            date: log.date,
            role: log.assignmentInfo?.role || log.role || '',
            assignedTime: log.assignmentInfo?.assignedTime || log.assignedTime || '',
            status: log.status || 'not_started',
            scheduledStartTime: log.scheduledStartTime,
            scheduledEndTime: log.scheduledEndTime,
            actualStartTime: log.actualStartTime,
            actualEndTime: log.actualEndTime,
            hoursWorked: log.hoursWorked,
            notes: log.notes,
          };
        });
      },

      // ========== Actions ==========

      /**
       * 모든 Firebase 컬렉션 구독 시작
       */
      subscribeAll: (userId: string, _role: string): void => {
        logger.info('[UnifiedDataStore] Firebase 구독 시작', { userId });
        set({ isLoading: true, error: null });

        try {
          // Staff 구독
          const staffQuery = query(collection(db, 'staff'));
          staffUnsubscribe = onSnapshot(
            staffQuery,
            (snapshot) => {
              const staffMap = new Map<string, Staff>();
              snapshot.docs.forEach(doc => {
                const data = doc.data() as Omit<Staff, 'id' | 'staffId'>;
                staffMap.set(doc.id, { ...data, id: doc.id, staffId: doc.id });
              });

              set((state) => {
                state.staff = staffMap;
                state.isLoading = false;
                state.error = null;
              });

              logger.info('[UnifiedDataStore] Staff 데이터 업데이트', {
                count: staffMap.size,
              });
            },
            (error) => {
              logger.error('[UnifiedDataStore] Staff 구독 에러', error);
              set({ error: error.message, isLoading: false });
            }
          );

          // WorkLogs 구독
          const workLogsQuery = query(collection(db, 'workLogs'));
          workLogsUnsubscribe = onSnapshot(
            workLogsQuery,
            (snapshot) => {
              const logsMap = new Map<string, WorkLog>();
              snapshot.docs.forEach(doc => {
                const data = doc.data() as Omit<WorkLog, 'id'>;
                logsMap.set(doc.id, { ...data, id: doc.id });
              });

              set((state) => {
                state.workLogs = logsMap;
              });

              logger.info('[UnifiedDataStore] WorkLogs 데이터 업데이트', {
                count: logsMap.size,
              });
            },
            (error) => {
              logger.error('[UnifiedDataStore] WorkLogs 구독 에러', error);
              set({ error: error.message });
            }
          );

          // Applications 구독
          const applicationsQuery = query(collection(db, 'applications'));
          applicationsUnsubscribe = onSnapshot(
            applicationsQuery,
            (snapshot) => {
              const appsMap = new Map<string, Application>();
              snapshot.docs.forEach(doc => {
                const data = doc.data() as Omit<Application, 'id'>;
                appsMap.set(doc.id, { ...data, id: doc.id });
              });

              set((state) => {
                state.applications = appsMap;
              });

              logger.info('[UnifiedDataStore] Applications 데이터 업데이트', {
                count: appsMap.size,
              });
            },
            (error) => {
              logger.error('[UnifiedDataStore] Applications 구독 에러', error);
              set({ error: error.message });
            }
          );

          // AttendanceRecords 구독
          const attendanceQuery = query(collection(db, 'attendanceRecords'));
          attendanceRecordsUnsubscribe = onSnapshot(
            attendanceQuery,
            (snapshot) => {
              const recordsMap = new Map<string, AttendanceRecord>();
              snapshot.docs.forEach(doc => {
                const data = doc.data() as Omit<AttendanceRecord, 'id'>;
                recordsMap.set(doc.id, { ...data, id: doc.id });
              });

              set((state) => {
                state.attendanceRecords = recordsMap;
              });

              logger.info('[UnifiedDataStore] AttendanceRecords 데이터 업데이트', {
                count: recordsMap.size,
              });
            },
            (error) => {
              logger.error('[UnifiedDataStore] AttendanceRecords 구독 에러', error);
              set({ error: error.message });
            }
          );

          // JobPostings 구독
          const jobPostingsQuery = query(collection(db, 'jobPostings'));
          jobPostingsUnsubscribe = onSnapshot(
            jobPostingsQuery,
            (snapshot) => {
              const postingsMap = new Map<string, JobPosting>();
              snapshot.docs.forEach(doc => {
                const data = doc.data() as Omit<JobPosting, 'id'>;
                postingsMap.set(doc.id, { ...data, id: doc.id });
              });

              set((state) => {
                state.jobPostings = postingsMap;
              });

              logger.info('[UnifiedDataStore] JobPostings 데이터 업데이트', {
                count: postingsMap.size,
              });
            },
            (error) => {
              logger.error('[UnifiedDataStore] JobPostings 구독 에러', error);
              set({ error: error.message });
            }
          );

        } catch (error) {
          logger.error('[UnifiedDataStore] 구독 초기화 에러', error instanceof Error ? error : new Error(String(error)));
          set({
            error: error instanceof Error ? error.message : String(error),
            isLoading: false,
          });
        }
      },

      /**
       * 모든 Firebase 구독 정리 (cleanup)
       */
      unsubscribeAll: (): void => {
        logger.info('[UnifiedDataStore] Firebase 구독 정리 시작');

        if (staffUnsubscribe) {
          staffUnsubscribe();
          staffUnsubscribe = null;
        }

        if (workLogsUnsubscribe) {
          workLogsUnsubscribe();
          workLogsUnsubscribe = null;
        }

        if (applicationsUnsubscribe) {
          applicationsUnsubscribe();
          applicationsUnsubscribe = null;
        }

        if (attendanceRecordsUnsubscribe) {
          attendanceRecordsUnsubscribe();
          attendanceRecordsUnsubscribe = null;
        }

        if (jobPostingsUnsubscribe) {
          jobPostingsUnsubscribe();
          jobPostingsUnsubscribe = null;
        }

        // Store 초기화
        set({
          staff: new Map(),
          workLogs: new Map(),
          applications: new Map(),
          attendanceRecords: new Map(),
          jobPostings: new Map(),
          isLoading: false,
          error: null,
        });

        logger.info('[UnifiedDataStore] Firebase 구독 정리 완료');
      },

      // ========== Staff CRUD ==========

      setStaff: (staff: Map<string, Staff>): void => {
        set({ staff });
      },

      updateStaff: (staff: Staff): void => {
        set((state) => {
          state.staff.set(staff.id, staff);
        });
      },

      deleteStaff: (id: string): void => {
        set((state) => {
          state.staff.delete(id);
        });
      },

      // ========== WorkLog CRUD ==========

      setWorkLogs: (workLogs: Map<string, WorkLog>): void => {
        set({ workLogs });
      },

      updateWorkLog: (workLog: WorkLog): void => {
        set((state) => {
          state.workLogs.set(workLog.id, workLog);
        });
      },

      deleteWorkLog: (id: string): void => {
        set((state) => {
          state.workLogs.delete(id);
        });
      },

      // ========== Application CRUD ==========

      setApplications: (applications: Map<string, Application>): void => {
        set({ applications });
      },

      updateApplication: (application: Application): void => {
        set((state) => {
          state.applications.set(application.id, application);
        });
      },

      deleteApplication: (id: string): void => {
        set((state) => {
          state.applications.delete(id);
        });
      },

      // ========== AttendanceRecord CRUD ==========

      setAttendanceRecords: (records: Map<string, AttendanceRecord>): void => {
        set({ attendanceRecords: records });
      },

      updateAttendanceRecord: (record: AttendanceRecord): void => {
        set((state) => {
          state.attendanceRecords.set(record.id, record);
        });
      },

      deleteAttendanceRecord: (id: string): void => {
        set((state) => {
          state.attendanceRecords.delete(id);
        });
      },

      // ========== JobPosting CRUD ==========

      setJobPostings: (jobPostings: Map<string, JobPosting>): void => {
        set({ jobPostings });
      },

      updateJobPosting: (posting: JobPosting): void => {
        set((state) => {
          state.jobPostings.set(posting.id, posting);
        });
      },

      deleteJobPosting: (id: string): void => {
        set((state) => {
          state.jobPostings.delete(id);
        });
      },

      // ========== 로딩/에러 상태 관리 ==========

      setLoading: (isLoading: boolean): void => {
        set({ isLoading });
      },

      setError: (error: string | null): void => {
        set({ error });
      },
    })),
    {
      name: 'UnifiedDataStore',
      enabled: process.env.NODE_ENV === 'development', // 개발 환경에서만 DevTools 활성화
    }
  )
);
