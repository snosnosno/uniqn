import { StarIcon } from '@heroicons/react/24/solid';
import { logger } from '../../utils/logger';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';

import { DashboardCard } from '../../components/DashboardCard';
import { auth, db } from '../../firebase'; // Import auth and db

interface DashboardStats {
  ongoingEventsCount: number;
  totalDealersCount: number;
  todayCheckedInCount: number;
  todayTournamentsCount: number;
  activeJobPostingsCount: number;
  weeklyRevenue: number;
  topRatedDealers: {
    id: string;
    name: string;
    rating: number;
    ratingCount: number;
  }[];
}

const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError(null);

      try {
        const user = auth.currentUser;
        if (!user) {
          throw new Error("인증이 필요합니다. 로그인해주세요.");
        }

        // Firestore에서 직접 데이터 가져오기
        const now = Timestamp.now();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStart = Timestamp.fromDate(today);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const todayEnd = Timestamp.fromDate(tomorrow);
        
        let ongoingEventsCount = 0;
        let totalDealersCount = 0;
        let todayCheckedInCount = 0;
        let todayTournamentsCount = 0;
        let activeJobPostingsCount = 0;
        let dealersSnapshot: any = null;
        
        // 진행 중인 이벤트 수
        try {
          const ongoingEventsQuery = query(
            collection(db, 'events'),
            where('startDate', '<=', now),
            where('endDate', '>=', now)
          );
          const ongoingEventsSnapshot = await getDocs(ongoingEventsQuery);
          ongoingEventsCount = ongoingEventsSnapshot.size;
        } catch (err) {
          logger.warn('events 컬렉션 권한 오류', { component: 'DashboardPage', error: String(err) });
        }

        // 전체 딜러 수
        try {
          const dealersQuery = query(
            collection(db, 'staff'),
            where('role', '==', 'dealer'),
            where('isActive', '==', true)
          );
          dealersSnapshot = await getDocs(dealersQuery);
          totalDealersCount = dealersSnapshot.size;
        } catch (err) {
          logger.warn('staff 컬렉션 권한 오류', { component: 'DashboardPage', error: String(err) });
        }

        // 오늘 체크인한 딜러 수
        try {
          const todayAttendanceQuery = query(
            collection(db, 'attendanceRecords'),
            where('checkInTime', '>=', todayStart),
            where('checkInTime', '<', todayEnd)
          );
          const todayAttendanceSnapshot = await getDocs(todayAttendanceQuery);
          todayCheckedInCount = todayAttendanceSnapshot.size;
        } catch (err) {
          logger.warn('attendanceRecords 컬렉션 권한 오류', { component: 'DashboardPage', error: String(err) });
        }

        // 오늘 예정된 토너먼트 수
        try {
          const todayTournamentsQuery = query(
            collection(db, 'tournaments'),
            where('date', '>=', todayStart),
            where('date', '<', todayEnd)
          );
          const todayTournamentsSnapshot = await getDocs(todayTournamentsQuery);
          todayTournamentsCount = todayTournamentsSnapshot.size;
        } catch (err) {
          logger.warn('tournaments 컬렉션 권한 오류', { component: 'DashboardPage', error: String(err) });
        }

        // 활성 공고 수
        try {
          const activeJobsQuery = query(
            collection(db, 'jobPostings'),
            where('status', '==', 'active')
          );
          const activeJobsSnapshot = await getDocs(activeJobsQuery);
          activeJobPostingsCount = activeJobsSnapshot.size;
        } catch (err) {
          logger.warn('jobPostings 컬렉션 권한 오류', { component: 'DashboardPage', error: String(err) });
        }

        // top rated dealers 가져오기
        const dealersWithRatings = [];
        if (dealersSnapshot) {
          for (const doc of dealersSnapshot.docs) {
            const dealerData = doc.data();
            if (dealerData.rating && dealerData.ratingCount > 0) {
              dealersWithRatings.push({
                id: doc.id,
                name: dealerData.name,
                rating: dealerData.rating,
                ratingCount: dealerData.ratingCount
              });
            }
          }
        }
        
        // 평점 기준으로 정렬하고 상위 5명만
        const topRatedDealers = dealersWithRatings
          .sort((a, b) => b.rating - a.rating)
          .slice(0, 5);

        // 이번 주 수익 (예시 - 실제 구조에 맞게 수정 필요)
        const weekRevenue = 0;

        setStats({
          ongoingEventsCount,
          totalDealersCount,
          topRatedDealers,
          todayTournamentsCount,
          todayCheckedInCount,
          activeJobPostingsCount,
          weeklyRevenue: weekRevenue
        });

      } catch (err: any) {
        logger.error('대시보드 통계 조회 오류:', err instanceof Error ? err : new Error(String(err)), { component: 'DashboardPage' });
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return <div className="p-6 text-center font-semibold">{t('dashboard.loading')}</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-600 bg-red-50 rounded-md">{t('dashboard.errorPrefix')}: {error}</div>;
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">{t('dashboard.title')}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        <DashboardCard title={t('dashboard.ongoingEvents')}>
          <p className="text-5xl font-bold text-blue-600">{stats?.ongoingEventsCount ?? '0'}</p>
        </DashboardCard>

        <DashboardCard title={t('dashboard.totalDealers')}>
          <p className="text-5xl font-bold text-green-600">{stats?.totalDealersCount ?? '0'}</p>
        </DashboardCard>

        <DashboardCard title={t('dashboard.quickLinks')}>
            <div className="flex flex-col space-y-2">
                <a href="/admin/events" className="text-blue-500 hover:underline">{t('dashboard.manageEventsLink')}</a>
                <a href="/admin/payroll" className="text-blue-500 hover:underline">{t('dashboard.processPayrollLink')}</a>
            </div>
        </DashboardCard>
        
        <div className="md:col-span-2 lg:col-span-3">
            <DashboardCard title={t('dashboard.topRatedDealers')}>
                <ul className="space-y-3">
                {stats?.topRatedDealers && stats.topRatedDealers.length > 0 ? (
                    stats.topRatedDealers.map((dealer) => (
                    <li key={dealer.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="font-semibold text-gray-700">{dealer.name}</span>
                        <div className="flex items-center space-x-2">
                            <span className="font-bold text-yellow-500">{dealer.rating.toFixed(1)}</span>
                            <StarIcon className="h-5 w-5 text-yellow-400" />
                            <span className="text-sm text-gray-500">{t('dashboard.ratingsCount', { count: dealer.ratingCount })}</span>
                        </div>
                    </li>
                    ))
                ) : (
                    <p className="text-gray-500">{t('dashboard.noRatings')}</p>
                )}
                </ul>
          </DashboardCard>
        </div>

      </div>
    </div>
  );
};

export default DashboardPage;
