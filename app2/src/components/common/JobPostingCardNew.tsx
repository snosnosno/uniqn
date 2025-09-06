import React from 'react';
import { useTranslation } from 'react-i18next';
import { JobPosting, TimeSlot, RoleRequirement, DateSpecificRequirement, JobPostingUtils } from '../../types/jobPosting';
import { formatDate as formatDateUtil, formatDateRangeDisplay, generateDateRange, convertToDateString } from '../../utils/jobPosting/dateUtils';
import { formatSalaryDisplay, getBenefitDisplayNames, getStatusDisplayName } from '../../utils/jobPosting/jobPostingHelpers';
import { timestampToLocalDateString } from '../../utils/dateUtils';
import { useDateUtils } from '../../hooks/useDateUtils';
import BaseCard, { CardHeader, CardBody, CardFooter } from '../ui/BaseCard';
import Badge from './Badge';
import StatusDot from './StatusDot';

export interface JobPostingCardProps {
  post: JobPosting & { applicationCount?: number };
  variant: 'admin-list' | 'user-card' | 'detail-info';
  renderActions?: (post: JobPosting) => React.ReactNode;
  renderExtra?: (post: JobPosting) => React.ReactNode;
  showStatus?: boolean;
  showApplicationCount?: boolean;
  expandTimeSlots?: boolean;
  className?: string;
}

/**
 * 공통 구인공고 카드 컴포넌트 - BaseCard 기반 새 버전
 * 모든 페이지에서 일관된 공고 정보 표시를 위한 공통 컴포넌트
 */
const JobPostingCardNew: React.FC<JobPostingCardProps> = ({
  post,
  variant,
  renderActions,
  renderExtra,
  showStatus = true,
  showApplicationCount = false,
  expandTimeSlots = false,
  className = ''
}) => {
  const { t } = useTranslation();
  const { formatDateDisplay } = useDateUtils();

  // 날짜 변환 처리
  const formatDate = (date: string | Date | { toDate: () => Date } | { seconds: number } | null | undefined): string => {
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

  // 날짜 범위 표시 개선
  const getDateRangeDisplay = () => {
    const dates: string[] = [];
    
    // 모든 날짜 수집
    post.dateSpecificRequirements?.forEach(req => {
      dates.push(convertToDateString(req.date));
      
      // multi duration 처리
      req.timeSlots?.forEach(slot => {
        if (slot.duration?.type === 'multi' && slot.duration.endDate) {
          const rangeDates = generateDateRange(
            convertToDateString(req.date),
            slot.duration.endDate
          );
          // 시작일 제외하고 추가 (중복 방지)
          rangeDates.slice(1).forEach(d => dates.push(d));
        }
      });
    });
    
    // 중복 제거 및 정렬
    const uniqueDates = Array.from(new Set(dates)).sort();
    
    return formatDateRangeDisplay(uniqueDates);
  };
  
  const dateRangeDisplay = getDateRangeDisplay();

  // BaseCard variant 결정
  const cardVariant = variant === 'admin-list' ? 'bordered' : variant === 'user-card' ? 'elevated' : 'default';
  const cardPadding = variant === 'detail-info' ? 'lg' : 'md';

  // 시간대 정보 렌더링 (간소화된 버전)
  const renderTimeSlots = () => {
    const dateReqs = post.dateSpecificRequirements || [];
    if (dateReqs.length === 0) {
      return <div className="text-sm text-gray-500">시간대 정보가 없습니다.</div>;
    }

    const displayReqs = expandTimeSlots ? dateReqs : dateReqs.slice(0, 2);
    
    return (
      <div className="space-y-2">
        {displayReqs.map((req: DateSpecificRequirement, index: number) => {
          // 다중일 체크 - 첫 번째 timeSlot의 duration을 확인 (모든 timeSlot이 동일한 duration을 가짐)
          const firstTimeSlot = req.timeSlots?.[0];
          const hasMultiDuration = firstTimeSlot?.duration?.type === 'multi' && firstTimeSlot?.duration?.endDate;
          
          let dateDisplay = formatDate(req.date);
          if (hasMultiDuration && firstTimeSlot?.duration?.endDate) {
            dateDisplay = `${formatDate(req.date)} ~ ${formatDate(firstTimeSlot.duration.endDate)}`;
          }
          
          return (
            <div key={index} className="text-sm">
              <div className="font-medium text-gray-700 mb-1">
                📅 {dateDisplay}
              </div>
            <div className="ml-4 space-y-1">
              {(req.timeSlots || []).map((ts: TimeSlot, tsIndex: number) => (
                <div key={tsIndex} className="text-gray-600">
                  <span className="font-medium">
                    {ts.isTimeToBeAnnounced ? '미정' : ts.time}
                  </span>
                  {ts.tentativeDescription && (
                    <span className="ml-1 text-gray-500">({ts.tentativeDescription})</span>
                  )}
                  <div className="ml-4">
                    {(ts.roles || []).map((role: RoleRequirement, roleIndex: number) => {
                      const dateString = timestampToLocalDateString(req.date);
                      const confirmedCount = JobPostingUtils.getConfirmedStaffCount(
                        post,
                        dateString,
                        ts.time,
                        role.name
                      );
                      const isFull = confirmedCount >= role.count;
                      return (
                        <div key={roleIndex}>
                          {t(`roles.${role.name}`, role.name)}: {role.count}명
                          <span className={`ml-1 ${isFull ? 'text-red-600' : 'text-green-600'}`}>
                            ({confirmedCount}/{role.count})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          );
        })}
        {!expandTimeSlots && dateReqs.length > 2 && (
          <div className="text-center text-gray-400">
            <span className="bg-gray-100 px-2 py-1 rounded text-xs">
              ... 외 {dateReqs.length - 2}개 날짜
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <BaseCard
      variant={cardVariant}
      padding={cardPadding}
      hover={variant === 'user-card'}
      className={className}
      aria-label={`구인공고: ${post.title}`}
      aria-describedby={`posting-${post.id}-details`}
    >
      <CardHeader className="border-b-0 pb-2" id={`posting-${post.id}-header`}>
        {/* 제목과 상태 배지 */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {post.title}
              </h3>
              
              {/* 상태 배지 */}
              {showStatus && post.status && (
                <Badge 
                  variant={post.status === 'open' ? 'success' : post.status === 'closed' ? 'danger' : 'warning'}
                  size="sm"
                >
                  <StatusDot 
                    status={post.status === 'open' ? 'success' : post.status === 'closed' ? 'error' : 'warning'} 
                    className="mr-1" 
                  />
                  {getStatusDisplayName(post.status)}
                </Badge>
              )}
              
              {/* 모집타입 배지 */}
              {post.recruitmentType && (
                <Badge 
                  variant={post.recruitmentType === 'fixed' ? 'secondary' : 'primary'}
                  size="sm"
                >
                  {post.recruitmentType === 'fixed' ? '고정' : '지원'}
                </Badge>
              )}
            </div>
          </div>

          {/* 액션 버튼 (상단) */}
          {variant === 'admin-list' && renderActions && (
            <div className="ml-4">
              {renderActions(post)}
            </div>
          )}
        </div>
      </CardHeader>

      <CardBody id={`posting-${post.id}-details`}>
        {/* 기본 정보 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-sm">
          {/* 날짜 */}
          <div className="flex items-center text-gray-600">
            <span className="mr-2">📅</span>
            <span>{dateRangeDisplay}</span>
          </div>
          
          {/* 위치 */}
          <div className="flex items-center text-gray-600">
            <span className="mr-2">📍</span>
            <span>
              {post.location}
              {post.detailedAddress && (
                <span className="text-gray-400 ml-1">({post.detailedAddress})</span>
              )}
            </span>
          </div>
          
          {/* 급여 */}
          {post.salaryType && post.salaryAmount && (
            <div className="flex items-center text-gray-600">
              <span className="mr-2">💰</span>
              <span>{formatSalaryDisplay(post.salaryType, post.salaryAmount)}</span>
            </div>
          )}
          
          {/* 복리후생 */}
          {post.benefits && Object.keys(post.benefits || {}).length > 0 && (
            <div className="flex items-start text-gray-600 col-span-full">
              <span className="mr-2 mt-0.5">🎁</span>
              <span>{getBenefitDisplayNames(post.benefits || {}).join(', ')}</span>
            </div>
          )}
        </div>

        {/* 시간대 정보 */}
        <div className="mb-4">
          <div className="font-medium text-gray-700 mb-2">모집 일정</div>
          {renderTimeSlots()}
        </div>

        {/* 지원자 수 */}
        {showApplicationCount && post.applicants && (post.applicants || []).length > 0 && (
          <div className="text-sm text-blue-600">
            🙋‍♂️ {(post.applicants || []).length}명 지원
          </div>
        )}

        {/* 추가 콘텐츠 */}
        {renderExtra && renderExtra(post)}

        {/* 관리자용 - 생성/수정 정보 */}
        {variant === 'admin-list' && (
          <div className="mt-4 pt-3 border-t text-xs text-gray-400 flex justify-between">
            <span>생성: {formatDateDisplay(post.createdAt)}</span>
            {post.updatedAt && (
              <span>수정: {formatDateDisplay(post.updatedAt)}</span>
            )}
          </div>
        )}
      </CardBody>

      {/* 푸터 - 사용자 카드용 액션 */}
      {variant === 'user-card' && renderActions && (
        <CardFooter className="border-t pt-4">
          {renderActions(post)}
        </CardFooter>
      )}
    </BaseCard>
  );
};

export default React.memo(JobPostingCardNew);