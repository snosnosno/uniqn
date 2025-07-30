import React from 'react';
import { FaFilter, FaSearch, FaTimes } from 'react-icons/fa';
import { ScheduleFilters as FiltersType } from '../../../types/schedule';
import { subDays, addDays, format } from 'date-fns';

interface ScheduleFiltersProps {
  filters: FiltersType;
  onFiltersChange: (filters: FiltersType) => void;
  isMobile?: boolean;
}

const ScheduleFilters: React.FC<ScheduleFiltersProps> = ({
  filters,
  onFiltersChange,
  isMobile = false
}) => {
  // 검색어 변경
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      searchTerm: e.target.value
    });
  };

  // 타입 필터 변경
  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({
      ...filters,
      type: e.target.value as any
    });
  };

  // 상태 필터 변경
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({
      ...filters,
      status: e.target.value as any
    });
  };

  // 날짜 범위 변경
  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    onFiltersChange({
      ...filters,
      dateRange: {
        ...filters.dateRange,
        [field]: value
      }
    });
  };


  // 필터 초기화
  const handleReset = () => {
    onFiltersChange({
      type: 'all',
      status: 'all',
      dateRange: {
        start: '2025-01-01',
        end: '2025-12-31'
      },
      searchTerm: ''
    });
  };

  // 활성 필터 개수
  const activeFilterCount = [
    filters.type !== 'all',
    filters.status !== 'all',
    !!filters.searchTerm
  ].filter(Boolean).length;

  if (isMobile) {
    // 모바일 레이아웃
    return (
      <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
        {/* 검색 */}
        <div className="relative">
          <FaSearch className="absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            value={filters.searchTerm || ''}
            onChange={handleSearchChange}
            placeholder="이벤트명, 장소, 역할 검색"
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 필터 버튼 그룹 */}
        <div className="grid grid-cols-2 gap-2">
          <select
            value={filters.type}
            onChange={handleTypeChange}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="all">모든 상태</option>
            <option value="applied">지원중</option>
            <option value="confirmed">확정</option>
            <option value="completed">완료</option>
            <option value="cancelled">취소</option>
          </select>

          <select
            value={filters.status}
            onChange={handleStatusChange}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="all">출석 상태</option>
            <option value="not_started">예정</option>
            <option value="checked_in">출근</option>
            <option value="checked_out">퇴근</option>
          </select>
        </div>

        {/* 날짜 범위 */}
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={filters.dateRange.start}
            onChange={(e) => handleDateRangeChange('start', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          <input
            type="date"
            value={filters.dateRange.end}
            onChange={(e) => handleDateRangeChange('end', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>

        {/* 초기화 버튼 */}
        {activeFilterCount > 0 && (
          <button
            onClick={handleReset}
            className="w-full px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium flex items-center justify-center gap-2"
          >
            <FaTimes />
            필터 초기화 ({activeFilterCount})
          </button>
        )}
      </div>
    );
  }

  // 데스크탑 레이아웃
  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-gray-700">
          <FaFilter />
          <span className="font-medium">필터</span>
        </div>

        {/* 검색 */}
        <div className="relative flex-1 min-w-[200px]">
          <FaSearch className="absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            value={filters.searchTerm || ''}
            onChange={handleSearchChange}
            placeholder="이벤트명, 장소, 역할 검색"
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 타입 필터 */}
        <select
          value={filters.type}
          onChange={handleTypeChange}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">모든 상태</option>
          <option value="applied">지원중</option>
          <option value="confirmed">확정</option>
          <option value="completed">완료</option>
          <option value="cancelled">취소</option>
        </select>

        {/* 출석 상태 필터 */}
        <select
          value={filters.status}
          onChange={handleStatusChange}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">모든 출석 상태</option>
          <option value="not_started">예정</option>
          <option value="checked_in">출근</option>
          <option value="checked_out">퇴근</option>
        </select>

        {/* 날짜 범위 */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filters.dateRange.start}
            onChange={(e) => handleDateRangeChange('start', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <span className="text-gray-500">~</span>
          <input
            type="date"
            value={filters.dateRange.end}
            onChange={(e) => handleDateRangeChange('end', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 초기화 버튼 */}
        {activeFilterCount > 0 && (
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center gap-2"
          >
            <FaTimes />
            초기화
          </button>
        )}
      </div>
    </div>
  );
};

export default ScheduleFilters;