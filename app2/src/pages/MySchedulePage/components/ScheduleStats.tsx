import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  FaCalendarCheck,
  FaHourglassHalf,
  FaMoneyBillWave,
  FaClock,
} from '@/components/Icons/ReactIconsReplacement';
import { ScheduleStats as StatsType } from '@/types/schedule';

interface ScheduleStatsProps {
  stats: StatsType;
  isMobile?: boolean;
}

const ScheduleStats: React.FC<ScheduleStatsProps> = ({ stats, isMobile = false }) => {
  const { t } = useTranslation();

  const statItems = [
    {
      icon: <FaCalendarCheck className="w-5 h-5 text-blue-500 dark:text-blue-400" />,
      label: t('schedule.stats.completed', '완료 일정'),
      value: t('common.countItems', '{{count}}건', { count: stats.completedSchedules }),
      subValue: t('schedule.stats.totalItems', '전체 {{count}}건', { count: stats.totalSchedules }),
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
    },
    {
      icon: <FaHourglassHalf className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />,
      label: t('schedule.stats.upcoming', '예정 일정'),
      value: t('common.countItems', '{{count}}건', { count: stats.upcomingSchedules }),
      subValue: t('schedule.stats.confirmed', '확정된 일정'),
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      borderColor: 'border-yellow-200 dark:border-yellow-800',
    },
    {
      icon: <FaMoneyBillWave className="w-5 h-5 text-green-500 dark:text-green-400" />,
      label: t('schedule.stats.thisMonthEarnings', '이번달 수입'),
      value: `₩${stats.thisMonthEarnings.toLocaleString()}`,
      subValue: t('schedule.stats.totalEarnings', '총 ₩{{amount}}', {
        amount: stats.totalEarnings.toLocaleString(),
      }),
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800',
    },
    {
      icon: <FaClock className="w-5 h-5 text-purple-500 dark:text-purple-400" />,
      label: t('schedule.stats.totalHours', '총 근무시간'),
      value: t('common.hours', '{{count}}시간', { count: stats.hoursWorked }),
      subValue: t('schedule.stats.plannedHours', '예정 근무 시간'),
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      borderColor: 'border-purple-200 dark:border-purple-800',
    },
  ];

  if (isMobile) {
    // 모바일 레이아웃 - 2x2 그리드
    return (
      <div className="grid grid-cols-2 gap-3">
        {statItems.map((item) => (
          <div
            key={item.label}
            className={`${item.bgColor} border ${item.borderColor} rounded-lg p-3`}
          >
            <div className="flex items-center gap-2 mb-2">
              {item.icon}
              <span className="text-xs text-gray-600 dark:text-gray-300">{item.label}</span>
            </div>
            <p className="font-semibold text-gray-900 dark:text-gray-100">{item.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{item.subValue}</p>
          </div>
        ))}
      </div>
    );
  }

  // 데스크탑 레이아웃 - 가로 배치
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="grid grid-cols-4 gap-6">
        {statItems.map((item) => (
          <div key={item.label} className="text-center">
            <div
              className={`inline-flex items-center justify-center w-12 h-12 ${item.bgColor} rounded-full mb-3`}
            >
              {item.icon}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">{item.label}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{item.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.subValue}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScheduleStats;
