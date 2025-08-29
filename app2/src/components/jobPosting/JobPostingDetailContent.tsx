import React from 'react';
import { useTranslation } from 'react-i18next';
import { JobPosting, TimeSlot, RoleRequirement, DateSpecificRequirement, JobPostingUtils } from '../../types/jobPosting';
import { formatDate as formatDateUtil, formatDateRangeDisplay, generateDateRange, convertToDateString } from '../../utils/jobPosting/dateUtils';
import { calculateDateRange } from '../../utils/jobPosting/migration';
import { formatSalaryDisplay, getRoleDisplayName, getSalaryTypeDisplayName } from '../../utils/jobPosting/jobPostingHelpers';
import { timestampToLocalDateString } from '../../utils/dateUtils';

interface JobPostingDetailContentProps {
  jobPosting: JobPosting;
  hideTitle?: boolean; // 제목과 뱃지를 숨길지 여부
}

/**
 * 구인공고 상세 정보 컨텐츠 컴포넌트
 * JobDetailModal과 JobPostingDetailPage에서 공통으로 사용
 */
const JobPostingDetailContent: React.FC<JobPostingDetailContentProps> = ({ jobPosting, hideTitle = false }) => {
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

  // 날짜 범위 표시 개선
  const getDateRangeDisplay = () => {
    const dates: string[] = [];
    
    // 모든 날짜 수집
    jobPosting.dateSpecificRequirements?.forEach(req => {
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

  return (
    <div className="space-y-6">
      {/* 기본 정보 */}
      <div className="border-b pb-4">
        {/* 제목과 뱃지 - hideTitle이 false일 때만 표시 */}
        {!hideTitle && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{jobPosting.title}</h3>
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${
              jobPosting.recruitmentType === 'fixed' 
                ? 'bg-purple-100 text-purple-800' 
                : 'bg-blue-100 text-blue-800'
            }`}>
              {jobPosting.recruitmentType === 'fixed' ? '고정' : '지원'}
            </span>
          </div>
        )}
        
        {/* 상세 설명 - 제목 바로 아래로 이동 */}
        {jobPosting.description && (
          <div className={hideTitle ? "pb-4 border-b" : "mb-4 pb-4 border-b"}>
            <h4 className="font-semibold mb-2">📝 상세 설명</h4>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{jobPosting.description}</p>
          </div>
        )}
        
        <div className="space-y-2 text-sm">
          <p className="flex items-center">
            <span className="font-medium w-20">기간:</span>
            <span>📅 {dateRangeDisplay}</span>
          </p>
          <p className="flex items-center">
            <span className="font-medium w-20">지역:</span>
            <span>📍 {jobPosting.location}</span>
            {jobPosting.district && <span className="ml-1">({jobPosting.district})</span>}
          </p>
          {jobPosting.detailedAddress && (
            <p className="flex items-center">
              <span className="font-medium w-20">상세주소:</span>
              <span>{jobPosting.detailedAddress}</span>
            </p>
          )}
          {/* 급여 정보 */}
          {jobPosting.useRoleSalary && jobPosting.roleSalaries ? (
            <div className="mt-2">
              <span className="font-medium">급여:</span>
              <span className="ml-2 text-xs text-gray-600">(역할별 급여)</span>
            </div>
          ) : (
            jobPosting.salaryType && jobPosting.salaryAmount && (
              <p className="flex items-center">
                <span className="font-medium w-20">급여:</span>
                <span>💰 {formatSalaryDisplay(jobPosting.salaryType, jobPosting.salaryAmount)}</span>
              </p>
            )
          )}
        </div>
      </div>

      {/* 역할별 급여 */}
      {jobPosting.useRoleSalary && jobPosting.roleSalaries && Object.keys(jobPosting.roleSalaries).length > 0 && (
        <div className="border-b pb-4">
          <h4 className="font-semibold mb-3">💰 역할별 급여</h4>
          <div className="space-y-2 text-sm">
            {Object.entries(jobPosting.roleSalaries).map(([role, salary]) => (
              <div key={role} className="flex items-center">
                <span className="font-medium min-w-[80px]">
                  {role === 'other' && salary.customRoleName 
                    ? salary.customRoleName 
                    : getRoleDisplayName(role)}:
                </span>
                <span className="ml-2">
                  {salary.salaryType === 'negotiable' 
                    ? '협의' 
                    : formatSalaryDisplay(salary.salaryType, salary.salaryAmount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 복리후생 */}
      {jobPosting.benefits && Object.keys(jobPosting.benefits).length > 0 && (
        <div className="border-b pb-4">
          <h4 className="font-semibold mb-3">🎁 복리후생</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(jobPosting.benefits).map(([key, value]) => (
              <div key={key} className="flex">
                <span className="font-medium min-w-[80px]">
                  {key === 'guaranteedHours' && '보장시간'}
                  {key === 'mealAllowance' && '식비'}
                  {key === 'transportation' && '교통비'}
                  {key === 'clothing' && '복장'}
                  {key === 'meal' && '식사'}
                  {key === 'accommodation' && '숙소'}:
                </span>
                <span className="ml-2">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 시간대 및 역할 정보 */}
      <div className="border-b pb-4">
        <h4 className="font-semibold mb-3">⏰ 모집 시간대 및 역할</h4>
        
        {/* 일자별 인원 요구사항 표시 */}
        {jobPosting.dateSpecificRequirements && jobPosting.dateSpecificRequirements.length > 0 ? (
          <div className="space-y-4">
            {jobPosting.dateSpecificRequirements?.map((dateReq: DateSpecificRequirement, dateIndex: number) => {
              // 다중일 체크 - 첫 번째 timeSlot의 duration을 확인 (모든 timeSlot이 동일한 duration을 가짐)
              const firstTimeSlot = dateReq.timeSlots?.[0];
              const hasMultiDuration = firstTimeSlot?.duration?.type === 'multi' && firstTimeSlot?.duration?.endDate;
              
              let dateDisplay = formatDateUtil(dateReq.date);
              if (hasMultiDuration && firstTimeSlot?.duration?.endDate) {
                dateDisplay = `${formatDateUtil(dateReq.date)} ~ ${formatDateUtil(firstTimeSlot.duration.endDate)}`;
              }
              
              return (
                <div key={dateIndex} className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm font-medium text-blue-600 mb-2">
                    📅 {dateDisplay} 일정
                  </div>
                {dateReq.timeSlots.map((ts: TimeSlot, tsIndex: number) => (
                  <div key={`${dateIndex}-${tsIndex}`} className="mt-2 pl-4">
                    <div className="flex items-start">
                      <div className="font-semibold text-gray-700 text-sm min-w-[80px]">
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
                          const dateString = timestampToLocalDateString(dateReq.date);
                          const confirmedCount = JobPostingUtils.getConfirmedStaffCount(
                            jobPosting,
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
                  </div>
                ))}
                </div>
              );
            })}
          </div>
        ) : (
          /* 날짜별 요구사항이 없는 경우 */
          <div className="text-sm text-gray-600">
            모집 시간대 정보가 없습니다.
          </div>
        )}
      </div>


      {/* 사전질문 */}
      {jobPosting.preQuestions && jobPosting.preQuestions.length > 0 && (
        <div>
          <h4 className="font-semibold mb-3">📋 사전질문</h4>
          <div className="space-y-3">
            {jobPosting.preQuestions.map((question: any, index: number) => (
              <div key={index} className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm font-medium">
                  {index + 1}. {typeof question === 'object' ? question.question : question}
                  {typeof question === 'object' && question.required && <span className="text-red-500 ml-1">*</span>}
                </p>
                {typeof question === 'object' && question.type === 'select' && question.options && (
                  <ul className="mt-2 ml-4 text-sm text-gray-600">
                    {question.options.map((option: string, optIndex: number) => (
                      <li key={optIndex}>• {option}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default JobPostingDetailContent;