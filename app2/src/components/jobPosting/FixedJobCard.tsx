import React from 'react';
import { FixedJobPosting } from '../../types/jobPosting/jobPosting';
import { incrementViewCount } from '../../services/fixedJobPosting';
import { formatWorkTimeDisplay } from '../../utils/jobPosting/jobPostingHelpers';

export interface FixedJobCardProps {
  posting: FixedJobPosting;
  onApply: (posting: FixedJobPosting) => void;
  onViewDetail: (postingId: string) => void;
}

/**
 * 고정공고 카드 컴포넌트
 *
 * 다크모드 완전 지원, React.memo로 메모이제이션
 *
 * @param posting - 고정공고 데이터
 * @param onApply - 지원하기 버튼 클릭 핸들러
 * @param onViewDetail - 상세보기 핸들러
 */
export const FixedJobCard = React.memo<FixedJobCardProps>(
  ({ posting, onApply, onViewDetail }) => {
    // fixedData 방어 코드
    if (!posting.fixedData) {
      console.error('FixedJobCard: fixedData가 없는 공고', posting.id);
      return null;
    }

    const { fixedData } = posting;
    const { workSchedule, requiredRolesWithCount = [], viewCount = 0 } = fixedData;

    // workSchedule 방어 코드
    if (!workSchedule) {
      console.error('FixedJobCard: workSchedule이 없는 공고', posting.id);
      return null;
    }

    // 근무 일정 텍스트 (익일 자동 표시)
    const scheduleText = `주 ${workSchedule.daysPerWeek}일 근무 · ${formatWorkTimeDisplay(workSchedule.startTime, workSchedule.endTime)}`;

    // 조회수 텍스트
    const viewCountText = `조회 ${viewCount.toLocaleString()}`;

    // 카드 클릭 핸들러 (상세보기)
    const handleCardClick = (e: React.MouseEvent) => {
      // 버튼 클릭 시에는 카드 클릭 이벤트 무시
      if ((e.target as HTMLElement).tagName === 'BUTTON') {
        return;
      }

      // Phase 4: 조회수 증가 (fire-and-forget, 모달 렌더링 전)
      incrementViewCount(posting.id);

      // 상세보기 모달 열기 (조회수 증가 실패와 무관하게 진행)
      onViewDetail(posting.id);
    };

    // 지원하기 버튼 클릭 핸들러
    const handleApplyClick = (e: React.MouseEvent) => {
      e.stopPropagation(); // 카드 클릭 이벤트 전파 방지
      onApply(posting);
    };

    return (
      <div
        onClick={handleCardClick}
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm hover:shadow-md dark:hover:shadow-gray-900/50 transition-shadow cursor-pointer"
        role="article"
        aria-label={`고정공고: ${posting.title}`}
      >
        {/* 제목 */}
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          {posting.title}
        </h3>

        {/* 근무 일정 */}
        <div className="flex items-center gap-2 mb-4">
          <svg
            className="w-5 h-5 text-gray-500 dark:text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="text-sm text-gray-600 dark:text-gray-300">{scheduleText}</span>
        </div>

        {/* 모집 역할 목록 */}
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">모집 역할</p>
          <div className="flex flex-wrap gap-2">
            {requiredRolesWithCount.length > 0 ? (
              requiredRolesWithCount.map((role, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100"
                >
                  {role.name} {role.count}명
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                모집 역할 정보 없음
              </span>
            )}
          </div>
        </div>

        {/* 하단: 조회수 & 지원하기 버튼 */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          {/* 조회수 */}
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-gray-500 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            <span className="text-sm text-gray-500 dark:text-gray-400">{viewCountText}</span>
          </div>

          {/* 지원하기 버튼 */}
          <button
            onClick={handleApplyClick}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white font-medium rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
            aria-label={`${posting.title} 공고에 지원하기`}
          >
            지원하기
          </button>
        </div>
      </div>
    );
  }
);

FixedJobCard.displayName = 'FixedJobCard';
