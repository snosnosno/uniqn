import React from 'react';
import { FaFilter, FaSearch, FaTimes } from '@/components/Icons/ReactIconsReplacement';
import { ScheduleFilters as FiltersType } from '@/types/schedule';

interface ScheduleFiltersProps {
  filters: FiltersType;
  onFiltersChange: (filters: FiltersType) => void;
  isMobile?: boolean;
}

const ScheduleFilters: React.FC<ScheduleFiltersProps> = ({
  filters,
  onFiltersChange,
  isMobile = false,
}) => {
  // 검색어 변경
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      searchTerm: e.target.value,
    });
  };

  // 상태 필터 핸들러 제거됨

  // 날짜 범위 변경
  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    onFiltersChange({
      ...filters,
      dateRange: {
        ...filters.dateRange,
        [field]: value,
      },
    });
  };

  // 필터 초기화
  const handleReset = () => {
    // 기본 날짜 범위: 지난 1개월부터 앞으로 3개월까지
    const today = new Date();
    const startDate = new Date(today);
    startDate.setMonth(today.getMonth() - 1);
    const endDate = new Date(today);
    endDate.setMonth(today.getMonth() + 3);

    onFiltersChange({
      dateRange: {
        start: startDate.toISOString().substring(0, 10),
        end: endDate.toISOString().substring(0, 10),
      },
      searchTerm: '',
    });
  };

  // 활성 필터 개수 (검색어만 체크)
  const activeFilterCount = [!!filters.searchTerm].filter(Boolean).length;

  if (isMobile) {
    // 모바일 레이아웃
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 space-y-4">
        {/* 검색 */}
        <div className="relative">
          <FaSearch className="w-4 h-4 absolute left-3 top-3 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={filters.searchTerm || ''}
            onChange={handleSearchChange}
            placeholder="이벤트명, 장소, 역할 검색"
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
          />
        </div>

        {/* 필터 제거됨 - 날짜 범위만 유지 */}

        {/* 날짜 범위 */}
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={filters.dateRange.start}
            onChange={(e) => handleDateRangeChange('start', e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-sm"
          />
          <input
            type="date"
            value={filters.dateRange.end}
            onChange={(e) => handleDateRangeChange('end', e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-sm"
          />
        </div>

        {/* 초기화 버튼 */}
        {activeFilterCount > 0 && (
          <button
            onClick={handleReset}
            className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium flex items-center justify-center gap-2"
          >
            <FaTimes className="w-4 h-4" />
            필터 초기화 ({activeFilterCount})
          </button>
        )}
      </div>
    );
  }

  // 데스크탑 레이아웃
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
          <FaFilter className="w-4 h-4" />
          <span className="font-medium">필터</span>
        </div>

        {/* 검색 */}
        <div className="relative flex-1 min-w-[200px]">
          <FaSearch className="w-4 h-4 absolute left-3 top-3 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={filters.searchTerm || ''}
            onChange={handleSearchChange}
            placeholder="이벤트명, 장소, 역할 검색"
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
          />
        </div>

        {/* 상태 필터 제거됨 - 검색과 날짜 범위만 유지 */}

        {/* 날짜 범위 */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filters.dateRange.start}
            onChange={(e) => handleDateRangeChange('start', e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
          />
          <span className="text-gray-500 dark:text-gray-400">~</span>
          <input
            type="date"
            value={filters.dateRange.end}
            onChange={(e) => handleDateRangeChange('end', e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
          />
        </div>

        {/* 초기화 버튼 */}
        {activeFilterCount > 0 && (
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium flex items-center gap-2"
          >
            <FaTimes className="w-4 h-4" />
            초기화
          </button>
        )}
      </div>
    </div>
  );
};

export default ScheduleFilters;
