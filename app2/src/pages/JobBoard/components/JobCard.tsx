import React from 'react';
import { useTranslation } from 'react-i18next';
import { JobPosting, TimeSlot, RoleRequirement, DateSpecificRequirement, ConfirmedStaff, JobPostingUtils } from '../../../types/jobPosting';
import { formatDate as formatDateUtil } from '../../../utils/jobPosting/dateUtils';
import { formatSalaryDisplay, getBenefitDisplayGroups } from '../../../utils/jobPosting/jobPostingHelpers';
import { timestampToLocalDateString } from '../../../utils/dateUtils';

interface JobCardProps {
  post: JobPosting;
  appliedStatus: string | undefined;
  onApply: (post: JobPosting) => void;
  onViewDetail: (post: JobPosting) => void;
  isProcessing: boolean;
  canApply: boolean;
}

/**
 * 개별 구인공고 카드 컴포넌트
 */
const JobCard: React.FC<JobCardProps> = ({ 
  post, 
  appliedStatus, 
  onApply,
  onViewDetail,
  isProcessing,
  canApply 
}) => {
  const { t } = useTranslation();

  // 날짜 변환 처리
  const formatDate = (date: any): string => {
    if (!date) return '미정';
    
    // Firebase Timestamp
    if (date && typeof date === 'object' && 'toDate' in date) {
      return formatDateUtil(date.toDate());
    }
    
    // seconds 형식 (Firebase에서 가져온 데이터)
    if (date && typeof date === 'object' && 'seconds' in date) {
      return formatDateUtil(new Date(date.seconds * 1000));
    }
    
    // 일반 Date 객체나 문자열
    return formatDateUtil(date);
  };

  const formattedStartDate = formatDate(post.startDate);
  const formattedEndDate = formatDate(post.endDate);

  // 지원 상태에 따른 버튼 렌더링
  const renderActionButton = () => {
    if (!canApply) {
      return (
        <button
          disabled
          className="w-full bg-gray-300 text-gray-500 py-2 px-4 rounded cursor-not-allowed text-sm font-medium"
        >
          로그인 필요
        </button>
      );
    }

    if (appliedStatus === 'applied') {
      return (
        <button
          disabled
          className="w-full bg-gray-500 text-white py-2 px-4 rounded cursor-not-allowed text-sm font-medium"
        >
          지원완료
        </button>
      );
    }

    if (appliedStatus === 'confirmed') {
      return (
        <button
          disabled
          className="w-full bg-blue-600 text-white py-2 px-4 rounded cursor-not-allowed text-sm font-medium"
        >
          확정됨
        </button>
      );
    }

    return (
      <button
        onClick={() => onApply(post)}
        disabled={isProcessing}
        className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:bg-gray-400 text-sm font-medium"
      >
        {isProcessing 
          ? t('jobBoard.applying') 
          : post.preQuestions && post.preQuestions.length > 0 
            ? '지원하기(사전질문)'
            : t('jobBoard.apply')}
      </button>
    );
  };

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1 mb-4 lg:mb-0">
            <div className="flex items-center mb-2">
              <h3 className="text-base sm:text-lg font-semibold mr-2 break-words max-w-full">
                {post.title}
              </h3>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                post.recruitmentType === 'fixed' 
                  ? 'bg-purple-100 text-purple-800' 
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {post.recruitmentType === 'fixed' ? '고정' : '지원'}
              </span>
            </div>
            
            {/* 날짜를 대회명 바로 아래로 이동 */}
            <p className="text-sm text-gray-500 mb-1">
              📅 {formattedStartDate} ~ {formattedEndDate}
            </p>
            <p className="text-sm text-gray-500 mb-1">
              📍 {post.location}
              {post.district && ` ${post.district}`}
            </p>
            
            {post.salaryType && post.salaryAmount && (
              <p className="text-sm text-gray-500 mb-1">
                💰 {formatSalaryDisplay(post.salaryType, post.salaryAmount)}
              </p>
            )}
            
            {post.benefits && Object.keys(post.benefits).length > 0 && (() => {
              const groups = getBenefitDisplayGroups(post.benefits);
              return (
                <div className="text-sm text-gray-500 mb-1">
                  {groups[0] && (
                    <p>
                      <span className="inline-block w-7">🎁</span>
                      {groups[0].join(', ')}
                    </p>
                  )}
                  {groups[1] && (
                    <p>
                      <span className="inline-block w-7"></span>
                      {groups[1].join(', ')}
                    </p>
                  )}
                </div>
              );
            })()}
            
            {/* 시간대 및 역할 표시 - 일자별 다른 인원 요구사항 고려 */}
            {JobPostingUtils.hasDateSpecificRequirements(post) ? (
              /* 일자별 다른 인원 요구사항이 있는 경우 */
              post.dateSpecificRequirements?.map((dateReq: DateSpecificRequirement, dateIndex: number) => (
                <div key={dateIndex} className="mt-3">
                  <div className="text-sm font-medium text-blue-600 mb-2">
                    📅 {formatDateUtil(dateReq.date)} 일정
                  </div>
                  {dateReq.timeSlots.map((ts: TimeSlot, tsIndex: number) => (
                    <div key={`${dateIndex}-${tsIndex}`} className="mt-2 pl-6 flex">
                      <div className="font-semibold text-gray-700 text-sm min-w-[60px]">
                        {ts.isTimeToBeAnnounced ? (
                          <span className="text-orange-600">
                            미정
                            {ts.tentativeDescription && (
                              <span className="text-gray-600 font-normal ml-1">({ts.tentativeDescription})</span>
                            )}
                          </span>
                        ) : (
                          ts.time
                        )}
                      </div>
                      <div className="ml-4 space-y-1">
                        {ts.roles.map((r: RoleRequirement, roleIndex: number) => {
                          // Firebase Timestamp를 문자열로 변환
                          const dateString = timestampToLocalDateString(dateReq.date);
                          
                          const confirmedCount = JobPostingUtils.getConfirmedStaffCount(
                            post,
                            dateString,
                            ts.time,
                            r.name
                          );
                          const isFull = confirmedCount >= r.count;
                          return (
                            <div key={roleIndex} className={`text-sm ${isFull ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
                              {t(`jobPostingAdmin.create.${r.name}`, r.name)}: {r.count}명 
                              {isFull ? ' (마감)' : ` (${confirmedCount}/${r.count})`}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              /* 기존 방식: 전체 기간 공통 timeSlots */
              post.timeSlots?.map((ts: TimeSlot, index: number) => (
                <div key={index} className="mt-2 pl-4 flex">
                  <div className="font-semibold text-gray-700 text-sm min-w-[60px]">
                    {ts.isTimeToBeAnnounced ? (
                      <span className="text-orange-600">
                        미정
                        {ts.tentativeDescription && (
                          <span className="text-gray-600 font-normal ml-1">({ts.tentativeDescription})</span>
                        )}
                      </span>
                    ) : (
                      ts.time
                    )}
                  </div>
                  <div className="ml-4 space-y-1">
                    {ts.roles.map((r: RoleRequirement, i: number) => {
                      const confirmedCount = post.confirmedStaff?.filter((staff: ConfirmedStaff) => 
                        staff.timeSlot === ts.time && staff.role === r.name
                      ).length || 0;
                      const isFull = confirmedCount >= r.count;
                      return (
                        <div key={i} className={`text-sm ${isFull ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
                          {t(`jobPostingAdmin.create.${r.name}`, r.name)}: {r.count}명
                          {isFull ? ' (마감)' : ` (${confirmedCount}/${r.count})`}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
            
          </div>
          
          <div className="w-full lg:w-auto lg:ml-4">
            <div className="flex flex-col space-y-2">
              {/* 자세히보기 버튼 */}
              <button
                onClick={() => onViewDetail(post)}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 text-sm font-medium"
              >
                자세히보기
              </button>
              
              {/* 지원하기 버튼 */}
              {renderActionButton()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobCard;