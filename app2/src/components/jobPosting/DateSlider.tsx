import { useMemo, useRef, useEffect } from 'react';
import { subDays } from 'date-fns';
import { generateDateRange, isToday, isYesterday } from '../../utils/jobPosting/dateFilter';

interface DateSliderProps {
  selectedDate: Date | null;
  onDateSelect: (date: Date | null) => void;
}

export const DateSlider: React.FC<DateSliderProps> = ({ selectedDate, onDateSelect }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLButtonElement>(null);

  // 날짜 범위 생성 (어제~+14일 = 16일)
  const dates = useMemo(() => {
    const yesterday = subDays(new Date(), 1);
    return generateDateRange(yesterday, 16);
  }, []);

  // 오늘 날짜 자동 스크롤 (컴포넌트 마운트 시)
  useEffect(() => {
    if (todayRef.current && containerRef.current) {
      // IntersectionObserver로 오늘 날짜가 보이지 않으면 스크롤
      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry && !entry.isIntersecting) {
            todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
        },
        { root: containerRef.current, threshold: 1.0 }
      );

      observer.observe(todayRef.current);
      return () => observer.disconnect();
    }
    return undefined;
  }, []);

  // 날짜 포맷 함수
  const formatDate = (date: Date): string => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
  };

  // 날짜 라벨 (오늘/어제)
  const getDateLabel = (date: Date): string => {
    if (isToday(date)) return '오늘';
    if (isYesterday(date)) return '어제';
    return formatDate(date);
  };

  // 선택된 날짜 확인
  const isSelected = (date: Date): boolean => {
    if (!selectedDate) return false;
    return (
      date.getFullYear() === selectedDate.getFullYear() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getDate() === selectedDate.getDate()
    );
  };

  return (
    <div className="mb-4">
      <div
        ref={containerRef}
        className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600"
        style={{ scrollbarWidth: 'thin' }}
      >
        {/* 전체 버튼 */}
        <button
          onClick={() => onDateSelect(null)}
          className={`
            flex-shrink-0 px-4 py-2 rounded-lg font-medium transition-colors
            ${
              selectedDate === null
                ? 'bg-blue-600 dark:bg-blue-700 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }
          `}
        >
          전체
        </button>

        {/* 날짜 버튼들 */}
        {dates.map((date, index) => {
          const today = isToday(date);
          const selected = isSelected(date);

          return (
            <button
              key={index}
              ref={today ? todayRef : null}
              onClick={() => onDateSelect(date)}
              className={`
                flex-shrink-0 px-4 py-2 rounded-lg font-medium transition-colors
                ${
                  selected
                    ? 'bg-blue-600 dark:bg-blue-700 text-white'
                    : today
                    ? 'bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }
              `}
              aria-label={getDateLabel(date)}
            >
              {getDateLabel(date)}
            </button>
          );
        })}
      </div>
    </div>
  );
};
