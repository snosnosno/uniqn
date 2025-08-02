import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { JobFilters } from './hooks/useJobBoard';

interface JobFiltersProps {
  filters: JobFilters;
  onFilterChange: (filters: JobFilters) => void;
}

/**
 * 구인공고 필터 컴포넌트
 */
const JobFiltersComponent: React.FC<JobFiltersProps> = ({ filters, onFilterChange }) => {
  const { t } = useTranslation();
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const handleFilterChange = (filterType: keyof JobFilters, value: string) => {
    const newFilters = { ...filters, [filterType]: value };
    onFilterChange(newFilters);
  };

  const resetFilters = () => {
    onFilterChange({
      location: 'all',
      type: 'all',
      startDate: '',
      role: 'all',
      month: '',
      day: ''
    });
  };

  return (
    <div className="mb-6">

      {/* Filter Form */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* Location Filter */}
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                {t('jobBoard.filters.location')}
              </label>
              <select
                id="location"
                value={filters.location}
                onChange={(e) => handleFilterChange('location', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="all">{t('jobBoard.filters.allLocations')}</option>
                <option value="서울">{t('locations.seoul')}</option>
                <option value="경기">{t('locations.gyeonggi')}</option>
                <option value="부산">{t('locations.busan')}</option>
                <option value="제주">{t('locations.jeju')}</option>
                <option value="대구">{t('locations.daegu')}</option>
                <option value="인천">{t('locations.incheon')}</option>
                <option value="광주">{t('locations.gwangju')}</option>
                <option value="대전">{t('locations.daejeon')}</option>
                <option value="울산">{t('locations.ulsan')}</option>
                <option value="세종">{t('locations.sejong')}</option>
                <option value="강원">{t('locations.gangwon')}</option>
                <option value="충북">{t('locations.chungbuk')}</option>
                <option value="충남">{t('locations.chungnam')}</option>
                <option value="전북">{t('locations.jeonbuk')}</option>
                <option value="전남">{t('locations.jeonnam')}</option>
                <option value="경북">{t('locations.gyeongbuk')}</option>
                <option value="경남">{t('locations.gyeongnam')}</option>
              </select>
            </div>

            {/* Month Filter */}
            <div>
              <label htmlFor="month" className="block text-sm font-medium text-gray-700 mb-1">
                {t('jobBoard.filters.month')}
              </label>
              <select
                id="month"
                value={filters.month}
                onChange={(e) => handleFilterChange('month', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="">{t('jobBoard.filters.allMonths')}</option>
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
                    {i + 1}월
                  </option>
                ))}
              </select>
            </div>

            {/* Day Filter */}
            <div>
              <label htmlFor="day" className="block text-sm font-medium text-gray-700 mb-1">
                {t('jobBoard.filters.day')}
              </label>
              <select
                id="day"
                value={filters.day}
                onChange={(e) => handleFilterChange('day', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="">{t('jobBoard.filters.allDays')}</option>
                {[...Array(31)].map((_, i) => (
                  <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
                    {i + 1}일
                  </option>
                ))}
              </select>
            </div>

            {/* Role Filter */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                {t('jobBoard.filters.role')}
              </label>
              <select
                id="role"
                value={filters.role}
                onChange={(e) => handleFilterChange('role', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="all">{t('jobBoard.filters.allRoles')}</option>
                <option value="dealer">{t('roles.dealer')}</option>
                <option value="floor">{t('roles.floor')}</option>
                <option value="serving">{t('roles.serving')}</option>
                <option value="tournament_director">{t('roles.tournament_director')}</option>
                <option value="chip_master">{t('roles.chip_master')}</option>
                <option value="registration">{t('roles.registration')}</option>
                <option value="security">{t('roles.security')}</option>
                <option value="cashier">{t('roles.cashier')}</option>
              </select>
            </div>
          </div>

          {/* Reset Button */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={resetFilters}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {t('jobBoard.filters.reset')}
            </button>
          </div>
        </div>
      </div>
  );
};

export default JobFiltersComponent;