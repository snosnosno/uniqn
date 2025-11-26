import React, { useState } from 'react';
import { FaClock, FaInfo, FaChevronDown, FaChevronUp } from '../Icons/ReactIconsReplacement';

import { TIME_INTERVALS, TimeInterval } from '../../utils/timeUtils';

interface TimeIntervalSelectorProps {
  // 현재 선택된 시간 간격 (분 단위)
  selectedInterval: number;

  // 시간 간격 변경 콜백
  onIntervalChange: (interval: number) => void;

  // 컴포넌트 크기
  size?: 'sm' | 'md' | 'lg';

  // 비활성화 상태
  disabled?: boolean;

  // 추가 CSS 클래스
  className?: string;
}

const TimeIntervalSelector: React.FC<TimeIntervalSelectorProps> = ({
  selectedInterval,
  onIntervalChange,
  size = 'md',
  disabled = false,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // 현재 선택된 간격 정보
  const selectedIntervalInfo =
    TIME_INTERVALS.find((interval) => interval.value === selectedInterval) || TIME_INTERVALS[2];

  // 크기별 스타일
  const sizeClasses = {
    sm: 'text-sm py-2 px-3',
    md: 'text-base py-3 px-4',
    lg: 'text-lg py-4 px-5',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const handleIntervalSelect = (interval: TimeInterval) => {
    onIntervalChange(interval.value);
    setIsExpanded(false);
  };

  const toggleExpanded = () => {
    if (!disabled) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* 선택기 버튼 */}
      <button
        type="button"
        onClick={toggleExpanded}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between
          border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800
          hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-sm
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          transition-all duration-200
          ${sizeClasses[size]}
          ${disabled ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed' : 'cursor-pointer'}
          ${isExpanded ? 'border-blue-500 dark:border-blue-400 shadow-sm' : ''}
        `}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FaClock className={`text-blue-600 dark:text-blue-400 ${iconSizes[size]}`} />
            <span className="font-medium text-gray-700 dark:text-gray-200">
              {selectedIntervalInfo?.icon} {selectedIntervalInfo?.label}
            </span>
          </div>
        </div>
        <div className="flex items-center">
          {isExpanded ? (
            <FaChevronUp className={`text-gray-400 dark:text-gray-500 ${iconSizes[size]}`} />
          ) : (
            <FaChevronDown className={`text-gray-400 dark:text-gray-500 ${iconSizes[size]}`} />
          )}
        </div>
      </button>

      {/* 드롭다운 옵션들 */}
      {isExpanded ? (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="py-1">
            {TIME_INTERVALS.map((interval) => {
              const isSelected = interval.value === selectedInterval;
              // const stats = startTime && endTime ? getTimeStatistics(startTime, endTime, interval.value) : null;

              return (
                <button
                  key={interval.value}
                  type="button"
                  onClick={() => handleIntervalSelect(interval)}
                  className={`
                    w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors
                    ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{interval.icon}</span>
                      <span className="font-medium">{interval.label}</span>
                      {isSelected ? (
                        <span className="text-xs bg-blue-200 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 px-2 py-1 rounded-full">
                          선택됨
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 정보 섹션 */}
          <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3 bg-gray-50 dark:bg-gray-700">
            <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
              <FaInfo className="w-3 h-3 mt-0.5 text-blue-500 dark:text-blue-400" />
              <div>
                <p className="font-medium mb-1">시간 간격 안내</p>
                <ul className="space-y-1">
                  <li>• 10분: 정밀한 스케줄 관리 (많은 시간 슬롯)</li>
                  <li>• 30분: 일반적인 교대 관리 (권장)</li>
                  <li>• 60분: 간단한 시간대별 관리</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* 외부 클릭으로 닫기 */}
      {isExpanded ? (
        <div className="fixed inset-0 z-40" onClick={() => setIsExpanded(false)} />
      ) : null}
    </div>
  );
};

export default TimeIntervalSelector;
