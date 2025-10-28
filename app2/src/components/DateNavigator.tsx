/**
 * DateNavigator - 날짜 선택 및 빠른 이동 컴포넌트
 *
 * 테이블/참가자 관리 페이지에서 날짜별 토너먼트 필터링을 위한
 * 날짜 선택 UI 컴포넌트입니다.
 *
 * 기능:
 * - 이전/다음 날짜 이동 버튼
 * - 날짜 선택기 (input type="date")
 * - 빠른 이동 버튼 (오늘, 다음 토너먼트)
 * - 선택 가능한 날짜만 활성화
 *
 * @version 1.0
 * @since 2025-10-17
 */

import React from 'react';
import { useDateFilter } from '../contexts/DateFilterContext';
import { formatDateDisplay } from '../utils/dateUtils';

interface DateNavigatorProps {
  className?: string;
}

const DateNavigator: React.FC<DateNavigatorProps> = ({ className = '' }) => {
  const {
    selectedDate,
    setSelectedDate,
    goToNextDate,
    goToPreviousDate,
    goToToday,
    availableDates,
  } = useDateFilter();

  // 이전/다음 버튼 활성화 상태
  const currentIndex = availableDates.indexOf(selectedDate);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < availableDates.length - 1 && currentIndex !== -1;

  // 오늘 날짜
  const today = new Date().toISOString().split('T')[0] || '';
  const isToday = selectedDate === today;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {/* 이전 날짜 버튼 */}
      <button
        onClick={goToPreviousDate}
        disabled={!hasPrevious}
        className="btn btn-secondary btn-sm px-3"
        title="이전 날짜"
      >
        ←
      </button>

      {/* 날짜 선택기 */}
      <div className="relative flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 shadow-sm">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => {
            const newDate = e.target.value;
            if (availableDates.includes(newDate)) {
              setSelectedDate(newDate);
            }
          }}
          className="border-none outline-none bg-transparent text-sm font-medium text-gray-700 dark:text-gray-200 cursor-pointer"
          list="available-dates"
        />
        <datalist id="available-dates">
          {availableDates.map((date) => (
            <option key={date} value={date} />
          ))}
        </datalist>

        {/* 날짜 표시 (읽기 쉬운 형식) */}
        {selectedDate && (
          <span className="text-xs text-gray-500 dark:text-gray-400 hidden md:inline-block">
            ({formatDateDisplay(selectedDate)})
          </span>
        )}
      </div>

      {/* 다음 날짜 버튼 */}
      <button
        onClick={goToNextDate}
        disabled={!hasNext}
        className="btn btn-secondary btn-sm px-3"
        title="다음 날짜"
      >
        →
      </button>

      {/* 구분선 */}
      <div className="hidden md:block w-px h-6 bg-gray-300 dark:bg-gray-600"></div>

      {/* 빠른 이동 버튼 */}
      <button
        onClick={goToToday}
        disabled={isToday}
        className="btn btn-secondary btn-sm"
        title="오늘로 이동"
      >
        오늘로
      </button>

      {/* 날짜 없을 때 메시지 */}
      {availableDates.length === 0 && (
        <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
          ⚠️ 토너먼트를 먼저 생성해주세요
        </span>
      )}
    </div>
  );
};

export default DateNavigator;
