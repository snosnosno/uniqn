import React from 'react';
import { useTranslation } from 'react-i18next';
import { JobPosting, TimeSlot, RoleRequirement, DateSpecificRequirement, ConfirmedStaff, JobPostingUtils } from '../../types/jobPosting';
import { formatDate as formatDateUtil } from '../../utils/jobPosting/dateUtils';
import { formatSalaryDisplay } from '../../utils/jobPosting/jobPostingHelpers';
import { timestampToLocalDateString } from '../../utils/dateUtils';

interface JobPostingDetailContentProps {
  jobPosting: JobPosting;
}

/**
 * 구인공고 상세 정보 컨텐츠 컴포넌트
 * JobDetailModal과 JobPostingDetailPage에서 공통으로 사용
 */
const JobPostingDetailContent: React.FC<JobPostingDetailContentProps> = ({ jobPosting }) => {
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

  const formattedStartDate = formatDate(jobPosting.startDate);
  const formattedEndDate = formatDate(jobPosting.endDate);

  return (
    <div className="space-y-6">
      {/* 기본 정보 */}
      <div className="border-b pb-4">
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
        
        <div className="space-y-2 text-sm">
          <p className="flex items-center">
            <span className="font-medium w-20">기간:</span>
            <span>📅 {formattedStartDate} ~ {formattedEndDate}</span>
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
          {jobPosting.salaryType && jobPosting.salaryAmount && (
            <p className="flex items-center">
              <span className="font-medium w-20">급여:</span>
              <span>💰 {formatSalaryDisplay(jobPosting.salaryType, jobPosting.salaryAmount)}</span>
            </p>
          )}
        </div>
      </div>

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
        
        {JobPostingUtils.hasDateSpecificRequirements(jobPosting) ? (
          /* 일자별 다른 인원 요구사항이 있는 경우 */
          <div className="space-y-4">
            {jobPosting.dateSpecificRequirements?.map((dateReq: DateSpecificRequirement, dateIndex: number) => (
              <div key={dateIndex} className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm font-medium text-blue-600 mb-2">
                  📅 {formatDateUtil(dateReq.date)} 일정
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
            ))}
          </div>
        ) : (
          /* 기존 방식: 전체 기간 공통 timeSlots */
          <div className="space-y-3">
            {jobPosting.timeSlots?.map((ts: TimeSlot, index: number) => (
              <div key={index} className="flex items-start bg-gray-50 p-3 rounded-lg">
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
                  {ts.roles.map((r: RoleRequirement, i: number) => {
                    const confirmedCount = jobPosting.confirmedStaff?.filter((staff: ConfirmedStaff) => 
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
            ))}
          </div>
        )}
      </div>

      {/* 설명 */}
      {jobPosting.description && (
        <div className="border-b pb-4">
          <h4 className="font-semibold mb-3">📝 상세 설명</h4>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{jobPosting.description}</p>
        </div>
      )}

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