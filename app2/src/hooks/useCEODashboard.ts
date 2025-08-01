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
  TTL: 10000 // 10초 캐시
};

export const useCEODashboard = () => {
  const [data, setData] = useState<CEODashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubscribersRef = useRef<(() => void)[]>([]);
  const isLoadingRef = useRef(false);

  // 캐시된 데이터 반환
  const getCachedData = useCallback(() => {
    const now = Date.now();
    if (dashboardCache.data && (now - dashboardCache.timestamp) < dashboardCache.TTL) {
      logger.debug('캐시된 데이터 사용', { component: 'useCEODashboard' });
      return dashboardCache.data;
    }
    return null;
  }, []);

  // 캐시 업데이트
  const updateCache = useCallback((newData: CEODashboardData) => {
    dashboardCache.data = newData;
    dashboardCache.timestamp = Date.now();
  }, []);

  useEffect(() => {
    // 이미 로딩 중이면 중복 실행 방지
    if (isLoadingRef.current) {
      return;
    }

    // 캐시된 데이터가 있으면 먼저 표시
    const cached = getCachedData();
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    logger.info('CEO 대시보드 데이터 로드 시작', { component: 'useCEODashboard' });
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

        // 1. 진행중인 토너먼트 (events 컬렉션)
        const eventsQuery = query(
          collection(db, 'events'),
          where('status', '==', 'active')
        );
        
        const eventsUnsubscribe = onSnapshot(eventsQuery, (snapshot) => {
          dashboardData.activeEvents = snapshot.size;
          logger.debug('활성 이벤트 수', { component: 'useCEODashboard', value: dashboardData.activeEvents });
          const updatedData = { ...dashboardData };
          setData(updatedData);
          updateCache(updatedData);
        });
        unsubscribers.push(eventsUnsubscribe);

        // 2. 참가자 수 (participants 컬렉션)
        const participantsUnsubscribe = onSnapshot(
          collection(db, 'participants'),
          (snapshot) => {
            dashboardData.totalParticipants = snapshot.size;
            logger.debug('총 참가자 수', { component: 'useCEODashboard', value: dashboardData.totalParticipants });
            setData({ ...dashboardData });
          }
        );
        unsubscribers.push(participantsUnsubscribe);

        // 3. 오늘 출석 현황 (attendanceRecords + workLogs)
        const todayWorkLogsQuery = query(
          collection(db, 'workLogs'),
          where('date', '>=', Timestamp.fromDate(todayStart)),
          where('date', '<=', Timestamp.fromDate(todayEnd))
        );

        const workLogsUnsubscribe = onSnapshot(todayWorkLogsQuery, async (snapshot) => {
          const scheduledToday = snapshot.size;
          dashboardData.scheduledStaff = scheduledToday;

          // 출석 기록 확인
          const attendanceQuery = query(
            collection(db, 'attendanceRecords'),
            where('date', '>=', Timestamp.fromDate(todayStart)),
            where('date', '<=', Timestamp.fromDate(todayEnd))
          );

          const attendanceSnapshot = await getDocs(attendanceQuery);
          let checkedIn = 0;
          let absent = 0;

          attendanceSnapshot.forEach((doc) => {
            const status = doc.data().status;
            if (status === 'checked_in' || status === 'checked_out') {
              checkedIn++;
            } else if (status === 'absent') {
              absent++;
            }
          });

          dashboardData.checkedInStaff = checkedIn;
          dashboardData.absentStaff = absent;
          dashboardData.attendanceRate = scheduledToday > 0 
            ? Math.round((checkedIn / scheduledToday) * 100) 
            : 0;

          logger.debug('출석 현황', { component: 'useCEODashboard', data: { scheduledToday, checkedIn, absent } });
          setData({ ...dashboardData });
        });
        unsubscribers.push(workLogsUnsubscribe);

        // 4. 이번달 급여 (payrollCalculations)
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

          logger.debug('급여 현황', { component: 'useCEODashboard', data: { totalPayroll, paid, pending } });
          setData({ ...dashboardData });
        });
        unsubscribers.push(payrollUnsubscribe);

        // 5. 스태프 현황 (staff/users)
        const staffQuery = collection(db, 'staff');
        const staffUnsubscribe = onSnapshot(staffQuery, async (snapshot) => {
          const totalStaff = snapshot.size;
          let activeCount = 0;
          let newThisMonth = 0;

          snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.status === 'active' || !data.status) {
              activeCount++;
            }

            // 이번달 신규 가입자
            if (data.createdAt) {
              const createdDate = data.createdAt.toDate();
              if (createdDate >= monthStart && createdDate <= monthEnd) {
                newThisMonth++;
              }
            }
          });

          dashboardData.totalStaff = totalStaff;
          dashboardData.activeStaff = activeCount;
          dashboardData.newStaffThisMonth = newThisMonth;

          logger.debug('스태프 현황', { component: 'useCEODashboard', data: { totalStaff, activeCount, newThisMonth } });
          setData({ ...dashboardData });
        });
        unsubscribers.push(staffUnsubscribe);

        // 6. 활성 구인공고 (jobPostings)
        const activeJobsQuery = query(
          collection(db, 'jobPostings'),
          where('status', '==', 'active')
        );

        const jobsUnsubscribe = onSnapshot(activeJobsQuery, async (snapshot) => {
          const jobs: JobPosting[] = [];

          for (const doc of snapshot.docs) {
            const data = doc.data();
            
            // 지원자 수 계산
            const applicationsQuery = query(
              collection(db, 'applications'),
              where('jobPostingId', '==', doc.id)
            );
            const applicationsSnapshot = await getDocs(applicationsQuery);

            // 총 모집 인원 계산
            let totalPositions = 0;
            if (data.recruitmentDetails) {
              Object.values(data.recruitmentDetails as Record<string, RecruitmentDetail>).forEach((detail) => {
                if (detail.count) {
                  totalPositions += detail.count;
                }
              });
            }

            jobs.push({
              id: doc.id,
              title: data.title || '제목 없음',
              startDate: data.startDate ? format(data.startDate.toDate(), 'MM/dd') : '',
              endDate: data.endDate ? format(data.endDate.toDate(), 'MM/dd') : '',
              positions: totalPositions,
              applicants: applicationsSnapshot.size
            });
          }

          dashboardData.jobPostings = jobs.slice(0, 3); // 상위 3개만
          logger.debug('구인공고 현황', { component: 'useCEODashboard', data: dashboardData.jobPostings });
          setData({ ...dashboardData });
        });
        unsubscribers.push(jobsUnsubscribe);

        // 7. 승인 대기 (users 컬렉션)
        const pendingUsersQuery = query(
          collection(db, 'users'),
          where('status', '==', 'pending')
        );

        const pendingUsersUnsubscribe = onSnapshot(pendingUsersQuery, (snapshot) => {
          dashboardData.pendingRegistrations = snapshot.size;
          logger.debug('승인 대기 가입자', { component: 'useCEODashboard', value: dashboardData.pendingRegistrations });
          setData({ ...dashboardData });
        });
        unsubscribers.push(pendingUsersUnsubscribe);

        // 8. 최우수 딜러 (ratings + staff)
        const ratingsQuery = query(
          collection(db, 'ratings'),
          orderBy('rating', 'desc'),
          limit(5)
        );

        const ratingsUnsubscribe = onSnapshot(ratingsQuery, async (snapshot) => {
          const dealers: TopDealer[] = [];
          const dealerRatings = new Map<string, { totalRating: number; count: number }>();

          // 딜러별 평점 집계
          snapshot.forEach((doc) => {
            const data = doc.data();
            const dealerId = data.dealerId;
            
            if (!dealerRatings.has(dealerId)) {
              dealerRatings.set(dealerId, { totalRating: 0, count: 0 });
            }
            
            const current = dealerRatings.get(dealerId)!;
            current.totalRating += data.rating;
            current.count += 1;
          });

          // 평균 평점 계산 및 딜러 정보 가져오기
          const sortedDealers = Array.from(dealerRatings.entries())
            .map(([dealerId, ratings]) => ({
              id: dealerId,
              averageRating: ratings.totalRating / ratings.count,
              ratingCount: ratings.count
            }))
            .sort((a, b) => b.averageRating - a.averageRating)
            .slice(0, 5);

          // 딜러 정보 조회
          for (const dealer of sortedDealers) {
            const staffDoc = await getDocs(
              query(collection(db, 'staff'), where('dealerId', '==', dealer.id), limit(1))
            );

            if (!staffDoc.empty && staffDoc.docs[0]) {
              const staffData = staffDoc.docs[0].data();
              dealers.push({
                id: dealer.id,
                name: staffData.name || '이름 없음',
                role: staffData.role || '딜러',
                rating: dealer.averageRating,
                ratingCount: dealer.ratingCount
              });
            }
          }

          dashboardData.topDealers = dealers;
          logger.debug('최우수 딜러', { component: 'useCEODashboard', data: dashboardData.topDealers });
          setData({ ...dashboardData });
        });
        unsubscribers.push(ratingsUnsubscribe);

        // 9. 테이블 현황 (tables)
        const tablesUnsubscribe = onSnapshot(collection(db, 'tables'), (snapshot) => {
          const totalTables = snapshot.size;
          let activeTables = 0;

          snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.status === 'active' || data.currentPlayers > 0) {
              activeTables++;
            }
          });

          dashboardData.totalTables = totalTables;
          dashboardData.activeTables = activeTables;
          dashboardData.tableUtilization = totalTables > 0 
            ? Math.round((activeTables / totalTables) * 100) 
            : 0;

          logger.debug('테이블 현황', { component: 'useCEODashboard', data: { totalTables, activeTables } });
          setData({ ...dashboardData });
        });
        unsubscribers.push(tablesUnsubscribe);

        setLoading(false);
        isLoadingRef.current = false;
      } catch (err) {
        logger.error('CEO 대시보드 데이터 로드 오류', err instanceof Error ? err : new Error(String(err)), { component: 'useCEODashboard' });
        setError(err instanceof Error ? err.message : '데이터 로드 실패');
        setLoading(false);
        isLoadingRef.current = false;
      }
    };

    loadDashboardData();
    unsubscribersRef.current = unsubscribers;

    // Cleanup
    return () => {
      logger.debug('CEO 대시보드 구독 해제', { component: 'useCEODashboard' });
      unsubscribersRef.current.forEach(unsubscribe => unsubscribe());
      unsubscribersRef.current = [];
      isLoadingRef.current = false;
    };
  }, [getCachedData, updateCache]);

  return { data, loading, error };
};