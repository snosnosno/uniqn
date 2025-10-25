import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { 
  ChartBarIcon, 
  UserGroupIcon, 
  CurrencyDollarIcon, 
  CalendarDaysIcon,
  BriefcaseIcon,
  TrophyIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowTrendingUpIcon
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import { DashboardCard } from '../../components/DashboardCard';
import { SimpleBarChart } from '../../components/charts/SimpleChart';
import { AnimatedNumber } from '../../components/charts/AnimatedNumber';
import { useCEODashboardOptimized } from '../../hooks/useCEODashboardOptimized';
import LoadingSpinner from '../../components/LoadingSpinner';
import { withPerformanceMonitoring, usePerformanceMeasure } from '../../utils/performanceMonitor';

const CEODashboard: React.FC = () => {
  const { t } = useTranslation();
  const { data, loading, error } = useCEODashboardOptimized();
  const [lastUpdated, setLastUpdated] = React.useState(new Date());
  const { startMeasure, endMeasure } = usePerformanceMeasure('CEO Dashboard 렌더링');

  // 30초마다 자동 업데이트
  React.useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(new Date());
    }, 30000); // 30초

    return () => clearInterval(interval);
  }, []);

  // 차트 데이터 메모이제이션
  const staffChartData = useMemo(() => {
    if (!data) return [];
    
    const staffData = [
      { label: '딜러', value: data.activeStaff * 0.6, color: 'bg-blue-500' },
      { label: '플로어', value: data.activeStaff * 0.25, color: 'bg-green-500' },
      { label: '매니저', value: data.activeStaff * 0.1, color: 'bg-purple-500' },
      { label: '기타', value: data.activeStaff * 0.05, color: 'bg-gray-500' }
    ].map(item => ({ ...item, value: Math.round(item.value) }));

    return staffData;
  }, [data]);

  // 컴포넌트 렌더링 시작
  React.useEffect(() => {
    startMeasure();
    return () => {
      endMeasure();
    };
  }, [startMeasure, endMeasure]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-600 bg-red-50 rounded-md">
        {t('common.error')}: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center">
        {t('dashboard.noData')}
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">{t('dashboard.ceo.title', 'CEO 대시보드')}</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">{t('dashboard.ceo.subtitle', '비즈니스 현황을 한눈에')}</p>
        </div>
        <div className="text-right">
          <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
            <ClockIcon className="h-4 w-4" />
            <span>{t('dashboard.ceo.lastUpdated', '마지막 업데이트')}: {lastUpdated.toLocaleTimeString()}</span>
          </div>
          <div className="mt-1 flex items-center space-x-1">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-600 dark:text-green-400">{t('dashboard.ceo.realtime', '실시간')}</span>
          </div>
        </div>
      </div>

      {/* 주요 지표 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <DashboardCard 
          title={t('dashboard.ceo.activeEvents', '진행중 토너먼트')}
          icon={<CalendarDaysIcon className="h-6 w-6 text-blue-500" />}
          className="border-l-4 border-blue-500"
        >
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-800">
                <AnimatedNumber value={data.activeEvents} />
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {t('dashboard.ceo.totalParticipants', '총 참가자')}: <AnimatedNumber value={data.totalParticipants} suffix="명" />
              </p>
            </div>
            {data.eventsTrend !== 0 && (
              <div className={`flex items-center ${data.eventsTrend > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {data.eventsTrend > 0 ? <ArrowUpIcon className="h-4 w-4" /> : <ArrowDownIcon className="h-4 w-4" />}
                <span className="text-sm font-medium">{Math.abs(data.eventsTrend)}%</span>
              </div>
            )}
          </div>
        </DashboardCard>

        <DashboardCard 
          title={t('dashboard.ceo.attendance', '오늘 출석률')}
          icon={<CheckCircleIcon className="h-6 w-6 text-green-500" />}
          className="border-l-4 border-green-500"
        >
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-800">
                <AnimatedNumber value={data.attendanceRate} suffix="%" />
              </p>
              <p className="text-sm text-gray-500 mt-1">
                <AnimatedNumber value={data.checkedInStaff} />/<AnimatedNumber value={data.scheduledStaff} />명 출근
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">{t('dashboard.ceo.absent', '결근')}: {data.absentStaff}명</p>
            </div>
          </div>
        </DashboardCard>

        <DashboardCard 
          title={t('dashboard.ceo.monthlyPayroll', '이번달 급여')}
          icon={<CurrencyDollarIcon className="h-6 w-6 text-yellow-500" />}
          className="border-l-4 border-yellow-500"
        >
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-800">
                <AnimatedNumber value={data.monthlyPayroll} prefix="₩" />
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {t('dashboard.ceo.paid', '지급완료')}: <AnimatedNumber value={data.paidAmount} prefix="₩" />
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">
                {t('dashboard.ceo.pending', '대기')}: <AnimatedNumber value={data.pendingAmount} prefix="₩" />
              </p>
            </div>
          </div>
        </DashboardCard>

        <DashboardCard 
          title={t('dashboard.ceo.staffCount', '전체 스태프')}
          icon={<UserGroupIcon className="h-6 w-6 text-purple-500" />}
          className="border-l-4 border-purple-500"
        >
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-800">{data.totalStaff}</p>
              <p className="text-sm text-gray-500 mt-1">
                {t('dashboard.ceo.activeStaff', '활성')}: {data.activeStaff}명
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-green-500">+{data.newStaffThisMonth} {t('dashboard.ceo.thisMonth', '이번달')}</p>
            </div>
          </div>
        </DashboardCard>
      </div>

      {/* 중간 섹션 - 채용 및 승인 대기 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <DashboardCard 
          title={t('dashboard.ceo.activeJobPostings', '활성 구인공고')}
          icon={<BriefcaseIcon className="h-6 w-6 text-indigo-500" />}
          className="lg:col-span-2"
        >
          <div className="space-y-3">
            {data.jobPostings.map((job) => (
              <div key={job.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="font-semibold text-gray-700 dark:text-gray-200">{job.title}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {job.startDate} ~ {job.endDate}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{job.applicants}명 지원</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('dashboard.ceo.positions', '모집')}: {job.positions}명
                  </p>
                </div>
              </div>
            ))}
            {data.jobPostings.length === 0 && (
              <p className="text-center text-gray-500 dark:text-gray-400">{t('dashboard.ceo.noActivePostings', '활성 공고 없음')}</p>
            )}
          </div>
        </DashboardCard>

        <DashboardCard 
          title={t('dashboard.ceo.pendingApprovals', '승인 대기')}
          icon={<ExclamationCircleIcon className="h-6 w-6 text-orange-500" />}
          className="border-l-4 border-orange-500"
        >
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('dashboard.ceo.newRegistrations', '신규 가입')}</span>
              <span className="text-2xl font-bold text-orange-600">{data.pendingRegistrations}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('dashboard.ceo.roleChanges', '권한 변경')}</span>
              <span className="text-2xl font-bold text-orange-600">{data.pendingRoleChanges}</span>
            </div>
            <div className="pt-2 border-t">
              <Link to="/app/admin/approval" className="text-blue-500 hover:underline text-sm">
                {t('dashboard.ceo.viewAll', '전체 보기')} →
              </Link>
            </div>
          </div>
        </DashboardCard>
      </div>

      {/* 하단 섹션 - 최우수 딜러 & 테이블 현황 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardCard 
          title={t('dashboard.ceo.topDealers', '최우수 딜러')}
          icon={<TrophyIcon className="h-6 w-6 text-yellow-500" />}
        >
          <div className="space-y-3">
            {data.topDealers.map((dealer, index) => (
              <div key={dealer.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                  <div>
                    <p className="font-semibold text-gray-700">{dealer.name}</p>
                    <p className="text-sm text-gray-500">{dealer.role}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-yellow-500">{dealer.rating.toFixed(1)}</span>
                  <StarIcon className="h-5 w-5 text-yellow-400" />
                  <span className="text-sm text-gray-500">({dealer.ratingCount})</span>
                </div>
              </div>
            ))}
          </div>
        </DashboardCard>

        <DashboardCard 
          title={t('dashboard.ceo.tableStatus', '테이블 운영 현황')}
          icon={<ChartBarIcon className="h-6 w-6 text-teal-500" />}
        >
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('dashboard.ceo.activeTables', '운영중 테이블')}</span>
              <span className="text-2xl font-bold text-teal-600">{data.activeTables}/{data.totalTables}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('dashboard.ceo.utilizationRate', '가동률')}</span>
              <span className="text-2xl font-bold text-teal-600">{data.tableUtilization}%</span>
            </div>
            <div className="pt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${data.tableUtilization}%` }}
                />
              </div>
            </div>
          </div>
        </DashboardCard>
      </div>

      {/* 차트 섹션 */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardCard 
          title={t('dashboard.ceo.staffDistribution', '스태프 역할 분포')}
          icon={<ChartBarIcon className="h-6 w-6 text-indigo-500" />}
        >
          <div className="h-64">
            <SimpleBarChart data={staffChartData} height={240} showValues={true} unit="명" />
          </div>
        </DashboardCard>

        <DashboardCard 
          title={t('dashboard.ceo.monthlyTrend', '월별 추이')}
          icon={<ArrowTrendingUpIcon className="h-6 w-6 text-emerald-500" />}
        >
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600">{t('dashboard.ceo.revenueGrowth', '수익 성장률')}</span>
              <div className="flex items-center text-green-500">
                <ArrowUpIcon className="h-4 w-4 mr-1" />
                <span className="font-bold">12.5%</span>
              </div>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600">{t('dashboard.ceo.participantGrowth', '참가자 증가율')}</span>
              <div className="flex items-center text-green-500">
                <ArrowUpIcon className="h-4 w-4 mr-1" />
                <span className="font-bold">8.3%</span>
              </div>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600">{t('dashboard.ceo.staffEfficiency', '스태프 효율성')}</span>
              <div className="flex items-center text-blue-500">
                <span className="font-bold">94.2%</span>
              </div>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600">{t('dashboard.ceo.customerSatisfaction', '고객 만족도')}</span>
              <div className="flex items-center text-yellow-500">
                <StarIcon className="h-4 w-4 mr-1" />
                <span className="font-bold">4.8/5.0</span>
              </div>
            </div>
          </div>
        </DashboardCard>
      </div>

      {/* 빠른 액션 */}
      <div className="mt-8 bg-white p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">{t('dashboard.ceo.quickActions', '빠른 실행')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link to="/app/admin/events" className="text-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
            <CalendarDaysIcon className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <span className="text-sm text-gray-700">{t('dashboard.ceo.manageEvents', '토너먼트 관리')}</span>
          </Link>
          <Link to="/app/admin/payroll" className="text-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
            <CurrencyDollarIcon className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <span className="text-sm text-gray-700">{t('dashboard.ceo.processPayroll', '급여 처리')}</span>
          </Link>
          <Link to="/app/admin/job-postings" className="text-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
            <BriefcaseIcon className="h-8 w-8 text-purple-600 mx-auto mb-2" />
            <span className="text-sm text-gray-700">{t('dashboard.ceo.manageJobs', '구인공고 관리')}</span>
          </Link>
          <Link to="/app/admin/users" className="text-center p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors">
            <UserGroupIcon className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
            <span className="text-sm text-gray-700">{t('dashboard.ceo.manageUsers', '사용자 관리')}</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default withPerformanceMonitoring(CEODashboard);