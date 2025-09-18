import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { startOfMonth, endOfMonth, startOfDay, endOfDay, format } from 'date-fns';
import { logger } from '../utils/logger';
import { useUnifiedData } from './useUnifiedData';

interface TopDealer {
  id: string;
  name: string;
  role: string;
  rating: number;
  ratingCount: number;
}

interface RecruitmentDetail {
  count?: number;
}

interface JobPosting {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  positions: number;
  applicants: number;
}

interface CEODashboardData {
  // 토너먼트 관련
  activeEvents: number;
  totalParticipants: number;
  eventsTrend: number; // 전월 대비 %

  // 출석 관련
  attendanceRate: number;
  checkedInStaff: number;
  scheduledStaff: number;
  absentStaff: number;

  // 재무 관련
  monthlyPayroll: number;
  paidAmount: number;
  pendingAmount: number;

  // 스태프 관련
  totalStaff: number;
  activeStaff: number;
  newStaffThisMonth: number;

  // 채용 관련
  jobPostings: JobPosting[];
  pendingRegistrations: number;
  pendingRoleChanges: number;

  // 성과 관련
  topDealers: TopDealer[];
  activeTables: number;
  totalTables: number;
  tableUtilization: number;
}

// 캐시 저장소
const dashboardCache = {
  data: null as CEODashboardData | null,
  timestamp: 0,
  TTL: 30000 // 30초 캐시 (기존 10초에서 증가)
};

// 폴링 데이터 캐시
const pollingCache = {
  topDealers: null as TopDealer[] | null,
  tableData: null as { activeTables: number; totalTables: number; tableUtilization: number } | null,
  timestamp: 0,
  TTL: 30000 // 30초마다 업데이트
};

export const useCEODashboardOptimized = () => {
  const [data, setData] = useState<CEODashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubscribersRef = useRef<(() => void)[]>([]);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isLoadingRef = useRef(false);
  
  // 🚀 WorkLog 데이터 가져오기 (persons 컬렉션 통합)
  const { state } = useUnifiedData();
  const workLogs = Array.from(state.workLogs.values());

  // 캐시된 데이터 반환
  const getCachedData = useCallback(() => {
    const now = Date.now();
    if (dashboardCache.data && (now - dashboardCache.timestamp) < dashboardCache.TTL) {
      logger.debug('캐시된 대시보드 데이터 사용', { component: 'useCEODashboardOptimized' });
      return dashboardCache.data;
    }
    return null;
  }, []);

  // 캐시 업데이트
  const updateCache = useCallback((newData: CEODashboardData) => {
    dashboardCache.data = newData;
    dashboardCache.timestamp = Date.now();
  }, []);

  // 폴링 데이터 가져오기 (평점, 테이블)
  const fetchPollingData = useCallback(async () => {
    const now = Date.now();
    
    // 캐시가 유효하면 캐시된 데이터 사용
    if (pollingCache.timestamp && (now - pollingCache.timestamp) < pollingCache.TTL) {
      return {
        topDealers: pollingCache.topDealers || [],
        ...pollingCache.tableData || { activeTables: 0, totalTables: 0, tableUtilization: 0 }
      };
    }

    try {
      logger.debug('폴링 데이터 가져오기 시작', { component: 'useCEODashboardOptimized' });

      // 1. 최우수 딜러 (캐시된 데이터 사용)
      const dealers: TopDealer[] = [];
      const ratingsQuery = query(
        collection(db, 'ratings'),
        orderBy('rating', 'desc'),
        limit(50) // 더 많이 가져와서 집계
      );

      const ratingsSnapshot = await getDocs(ratingsQuery);
      const dealerRatings = new Map<string, { totalRating: number; count: number }>();

      ratingsSnapshot.forEach((doc) => {
        const data = doc.data();
        // staffId 사용
        const staffId = data.staffId;
        
        if (!dealerRatings.has(staffId)) {
          dealerRatings.set(staffId, { totalRating: 0, count: 0 });
        }
        
        const current = dealerRatings.get(staffId)!;
        current.totalRating += data.rating;
        current.count += 1;
      });

      // 평균 평점 계산
      const sortedDealers = Array.from(dealerRatings.entries())
        .map(([staffId, ratings]) => ({
          id: staffId,
          averageRating: ratings.totalRating / ratings.count,
          ratingCount: ratings.count
        }))
        .sort((a, b) => b.averageRating - a.averageRating)
        .slice(0, 5);

      // 🚀 딜러 정보 조회 - WorkLog에서 검색 (persons 컬렉션 통합)
      for (const dealer of sortedDealers) {
        // WorkLog에서 해당 딜러 정보 찾기
        if (workLogs) {
          const dealerWorkLog = workLogs.find((wl: any) => 
            (wl.staffInfo?.userId === dealer.id || wl.staffId === dealer.id) &&
            wl.staffInfo?.isActive !== false
          );
          
          if (dealerWorkLog) {
            dealers.push({
              id: dealer.id,
              name: dealerWorkLog.staffInfo?.name || dealerWorkLog.staffName || '이름 없음',
              role: dealerWorkLog.staffInfo?.jobRole?.[0] || dealerWorkLog.role || '딜러',
              rating: dealer.averageRating,
              ratingCount: dealer.ratingCount
            });
          }
        }
      }

      // 2. 테이블 현황
      const tablesSnapshot = await getDocs(collection(db, 'tables'));
      const totalTables = tablesSnapshot.size;
      let activeTables = 0;

      tablesSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === 'active' || data.currentPlayers > 0) {
          activeTables++;
        }
      });

      const tableUtilization = totalTables > 0 
        ? Math.round((activeTables / totalTables) * 100) 
        : 0;

      // 폴링 캐시 업데이트
      pollingCache.topDealers = dealers;
      pollingCache.tableData = { activeTables, totalTables, tableUtilization };
      pollingCache.timestamp = now;

      return {
        topDealers: dealers,
        activeTables,
        totalTables,
        tableUtilization
      };
    } catch (error) {
      logger.error('폴링 데이터 가져오기 오류', error instanceof Error ? error : new Error(String(error)), { component: 'useCEODashboardOptimized' });
      return {
        topDealers: pollingCache.topDealers || [],
        ...pollingCache.tableData || { activeTables: 0, totalTables: 0, tableUtilization: 0 }
      };
    }
  }, []);

  // 메인 데이터 로드
  useEffect(() => {
    if (isLoadingRef.current) {
      return;
    }

    // 캐시된 데이터가 있으면 먼저 표시
    const cached = getCachedData();
    if (cached) {
      setData(cached);
      setLoading(false);
    }

    logger.info('CEO 대시보드 최적화 버전 데이터 로드 시작', { component: 'useCEODashboardOptimized' });
    isLoadingRef.current = true;
    setLoading(true);
    setError(null);

    const unsubscribers: (() => void)[] = [];

    const loadDashboardData = async () => {
      try {
        const now = new Date();
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);
        const todayStart = startOfDay(now);
        const todayEnd = endOfDay(now);

        const dashboardData: CEODashboardData = {
          activeEvents: 0,
          totalParticipants: 0,
          eventsTrend: 0,
          attendanceRate: 0,
          checkedInStaff: 0,
          scheduledStaff: 0,
          absentStaff: 0,
          monthlyPayroll: 0,
          paidAmount: 0,
          pendingAmount: 0,
          totalStaff: 0,
          activeStaff: 0,
          newStaffThisMonth: 0,
          jobPostings: [],
          pendingRegistrations: 0,
          pendingRoleChanges: 0,
          topDealers: [],
          activeTables: 0,
          totalTables: 0,
          tableUtilization: 0
        };

        // 초기 폴링 데이터 로드
        const pollingData = await fetchPollingData();
        dashboardData.topDealers = pollingData.topDealers;
        dashboardData.activeTables = pollingData.activeTables;
        dashboardData.totalTables = pollingData.totalTables;
        dashboardData.tableUtilization = pollingData.tableUtilization;

        // 구독 1: 이벤트 + 참가자 통합 쿼리
        const eventsQuery = query(
          collection(db, 'events'),
          where('status', '==', 'active')
        );
        
        const eventsUnsubscribe = onSnapshot(eventsQuery, async (snapshot) => {
          dashboardData.activeEvents = snapshot.size;
          
          // 참가자 수는 이벤트 문서 내의 participantCount 필드를 사용
          let totalParticipants = 0;
          snapshot.forEach((doc) => {
            const data = doc.data();
            totalParticipants += data.participantCount || 0;
          });
          dashboardData.totalParticipants = totalParticipants;

          logger.debug('이벤트 및 참가자 현황', { 
            component: 'useCEODashboardOptimized', 
            data: { activeEvents: dashboardData.activeEvents, totalParticipants }
          });
          
          const updatedData = { ...dashboardData };
          setData(updatedData);
          updateCache(updatedData);
        });
        unsubscribers.push(eventsUnsubscribe);

        // 구독 2: 출석 통합 쿼리 (workLogs + attendanceRecords를 하나로)
        const todayAttendanceQuery = query(
          collection(db, 'attendanceRecords'),
          where('date', '>=', Timestamp.fromDate(todayStart)),
          where('date', '<=', Timestamp.fromDate(todayEnd))
        );

        const attendanceUnsubscribe = onSnapshot(todayAttendanceQuery, async (snapshot) => {
          let checkedIn = 0;
          let absent = 0;
          const staffIds = new Set<string>();

          snapshot.forEach((doc) => {
            const data = doc.data();
            staffIds.add(data.staffId);
            
            if (data.status === 'checked_in' || data.status === 'checked_out') {
              checkedIn++;
            } else if (data.status === 'absent') {
              absent++;
            }
          });

          dashboardData.scheduledStaff = staffIds.size;
          dashboardData.checkedInStaff = checkedIn;
          dashboardData.absentStaff = absent;
          dashboardData.attendanceRate = staffIds.size > 0 
            ? Math.round((checkedIn / staffIds.size) * 100) 
            : 0;

          logger.debug('출석 현황 통합', { 
            component: 'useCEODashboardOptimized', 
            data: { scheduled: staffIds.size, checkedIn, absent }
          });
          
          setData({ ...dashboardData });
        });
        unsubscribers.push(attendanceUnsubscribe);

        // 구독 3: 급여 현황
        const payrollQuery = query(
          collection(db, 'payrollCalculations'),
          where('month', '>=', Timestamp.fromDate(monthStart)),
          where('month', '<=', Timestamp.fromDate(monthEnd))
        );

        const payrollUnsubscribe = onSnapshot(payrollQuery, (snapshot) => {
          let totalPayroll = 0;
          let paid = 0;
          let pending = 0;

          snapshot.forEach((doc) => {
            const data = doc.data();
            const amount = data.totalAmount || 0;
            totalPayroll += amount;
            
            if (data.status === 'paid') {
              paid += amount;
            } else {
              pending += amount;
            }
          });

          dashboardData.monthlyPayroll = totalPayroll;
          dashboardData.paidAmount = paid;
          dashboardData.pendingAmount = pending;

          logger.debug('급여 현황', { 
            component: 'useCEODashboardOptimized', 
            data: { totalPayroll, paid, pending }
          });
          
          setData({ ...dashboardData });
        });
        unsubscribers.push(payrollUnsubscribe);

        // 🚀 구독 4: 스태프 통계 - WorkLog 기반 계산 (persons 컬렉션 통합)
        // WorkLog 변경 시마다 스태프 통계 재계산
        const calculateStaffStats = () => {
          if (!workLogs) return { totalStaff: 0, activeCount: 0, newThisMonth: 0 };
          
          const staffMap = new Map<string, any>();
          
          // WorkLog에서 고유한 스태프 추출
          workLogs.forEach((workLog: any) => {
            const staffId = workLog.staffInfo?.userId || workLog.staffId;
            if (staffId && !staffMap.has(staffId)) {
              staffMap.set(staffId, {
                isActive: workLog.staffInfo?.isActive !== false,
                createdAt: workLog.createdAt,
                staffInfo: workLog.staffInfo
              });
            }
          });
          
          const totalStaff = staffMap.size;
          let activeCount = 0;
          let newThisMonth = 0;
          
          staffMap.forEach((staff) => {
            if (staff.isActive) {
              activeCount++;
            }
            
            if (staff.createdAt && staff.createdAt.toDate) {
              const createdDate = staff.createdAt.toDate();
              if (createdDate >= monthStart && createdDate <= monthEnd) {
                newThisMonth++;
              }
            }
          });
          
          return { totalStaff, activeCount, newThisMonth };
        };

        // 🚀 WorkLog 기반 스태프 통계 계산 및 업데이트
        const updateStaffStats = async () => {
          const { totalStaff, activeCount, newThisMonth } = calculateStaffStats();
          
          // 승인 대기 사용자 수도 함께 조회
          const pendingUsersSnapshot = await getDocs(
            query(collection(db, 'users'), where('status', '==', 'pending'))
          );
          dashboardData.pendingRegistrations = pendingUsersSnapshot.size;

          dashboardData.totalStaff = totalStaff;
          dashboardData.activeStaff = activeCount;
          dashboardData.newStaffThisMonth = newThisMonth;

          logger.debug('스태프 및 사용자 현황 (WorkLog 기반)', { 
            component: 'useCEODashboardOptimized', 
            data: { totalStaff, activeCount, newThisMonth, pendingRegistrations: dashboardData.pendingRegistrations }
          });
          
          setData({ ...dashboardData });
        };
        
        // 초기 로드 및 workLogs 변경 시 업데이트
        updateStaffStats();

        // 구독 5: 구인공고 (지원자 수는 캐시 활용)
        const activeJobsQuery = query(
          collection(db, 'jobPostings'),
          where('status', '==', 'active'),
          limit(3) // 상위 3개만
        );

        const jobsUnsubscribe = onSnapshot(activeJobsQuery, async (snapshot) => {
          const jobs: JobPosting[] = [];

          snapshot.forEach((doc) => {
            const data = doc.data();
            
            // 총 모집 인원 계산
            let totalPositions = 0;
            if (data.recruitmentDetails) {
              Object.values(data.recruitmentDetails as Record<string, RecruitmentDetail>).forEach((detail) => {
                if (detail.count) {
                  totalPositions += detail.count;
                }
              });
            }

            // 지원자 수는 문서 내의 applicantCount 필드 사용 (실시간 업데이트됨)
            jobs.push({
              id: doc.id,
              title: data.title || '제목 없음',
              startDate: data.startDate ? format(data.startDate.toDate(), 'MM/dd') : '',
              endDate: data.endDate ? format(data.endDate.toDate(), 'MM/dd') : '',
              positions: totalPositions,
              applicants: data.applicantCount || 0
            });
          });

          dashboardData.jobPostings = jobs;
          
          logger.debug('구인공고 현황', { 
            component: 'useCEODashboardOptimized', 
            data: dashboardData.jobPostings 
          });
          
          setData({ ...dashboardData });
        });
        unsubscribers.push(jobsUnsubscribe);

        // 30초마다 폴링 데이터 업데이트 (평점, 테이블)
        pollingIntervalRef.current = setInterval(async () => {
          const updatedPollingData = await fetchPollingData();
          setData(prevData => {
            if (!prevData) return prevData;
            
            const newData = {
              ...prevData,
              topDealers: updatedPollingData.topDealers,
              activeTables: updatedPollingData.activeTables,
              totalTables: updatedPollingData.totalTables,
              tableUtilization: updatedPollingData.tableUtilization
            };
            
            updateCache(newData);
            return newData;
          });
        }, 30000);

        setLoading(false);
        isLoadingRef.current = false;
      } catch (err) {
        logger.error('CEO 대시보드 최적화 버전 데이터 로드 오류', err instanceof Error ? err : new Error(String(err)), { component: 'useCEODashboardOptimized' });
        setError(err instanceof Error ? err.message : '데이터 로드 실패');
        setLoading(false);
        isLoadingRef.current = false;
      }
    };

    loadDashboardData();
    unsubscribersRef.current = unsubscribers;

    // Cleanup
    return () => {
      logger.debug('CEO 대시보드 최적화 버전 구독 해제', { component: 'useCEODashboardOptimized' });
      unsubscribersRef.current.forEach(unsubscribe => unsubscribe());
      unsubscribersRef.current = [];
      
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      isLoadingRef.current = false;
    };
  }, [getCachedData, updateCache, fetchPollingData]);

  return { data, loading, error };
};