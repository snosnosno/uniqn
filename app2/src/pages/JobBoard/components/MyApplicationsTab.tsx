import React from 'react';
import { useTranslation } from 'react-i18next';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { formatDate as formatDateUtil, convertToDateString, generateDateRange, formatDateRangeDisplay } from '../../../utils/jobPosting/dateUtils';
import { formatSalaryDisplay, getBenefitDisplayGroups } from '../../../utils/jobPosting/jobPostingHelpers';

interface FirebaseTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate?: () => Date;
}

type DateValue = string | Date | FirebaseTimestamp;

interface Application {
  id: string;
  postId: string;
  status: string;
  appliedAt: DateValue;
  confirmedAt?: DateValue;
  assignedTime?: string | DateValue;
  assignedRole?: string;
  assignedDate?: DateValue;
  // 다중 선택 지원 필드
  assignedTimes?: string[];
  assignedRoles?: string[];
  assignedDates?: DateValue[];
  // 사전질문 답변
  preQuestionAnswers?: Array<{
    question: string;
    answer: string;
    required: boolean;
  }>;
  jobPosting?: {
    id: string;
    title: string;
    location: string;
    district?: string;
    detailedAddress?: string;
    startDate?: DateValue;
    endDate?: DateValue;
    dateSpecificRequirements?: any[];
    salaryType?: string;
    salaryAmount?: number;
    benefits?: Record<string, unknown>;
    useRoleSalary?: boolean;
    roleSalaries?: Record<string, any>;
  } | null;
}

interface MyApplicationsTabProps {
  applications: Application[];
  loading: boolean;
  onRefresh: () => void;
  onCancel: (postId: string) => void;
  isProcessing: string | null;
  onTabChange: () => void;
  onViewDetail?: (jobPosting: any) => void;
}

/**
 * 내 지원 현황 탭 컴포넌트
 */
const MyApplicationsTab: React.FC<MyApplicationsTabProps> = ({
  applications,
  loading,
  onRefresh,
  onCancel,
  isProcessing,
  onTabChange,
  onViewDetail
}) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner size="lg" text="지원 현황을 불러오는 중..." />
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 text-lg mb-2">📋</div>
        <p className="text-gray-500 mb-4">아직 지원한 공고가 없습니다.</p>
        <button
          onClick={onTabChange}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          구인 공고 보러가기
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xl font-semibold">내 지원 현황 ({applications.length}건)</h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 text-sm"
        >
          {loading ? '새로고침 중...' : '🔄 새로고침'}
        </button>
      </div>
      
      {applications.map((application) => (
        <div key={application.id} className="bg-white rounded-lg shadow-md p-4 border">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {application.jobPosting?.title || '삭제된 공고'}
              </h3>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              application.status === 'confirmed' 
                ? 'bg-green-100 text-green-800' 
                : application.status === 'rejected'
                ? 'bg-red-100 text-red-800'
                : 'bg-blue-100 text-blue-800'
            }`}>
              {application.status === 'confirmed' ? '✅ 확정' : 
               application.status === 'rejected' ? '❌ 미선정' : '⏳ 대기중'}
            </div>
          </div>

          {application.jobPosting && (
            <div className="mb-3 text-sm text-gray-600">
              <p>📍 주소: {application.jobPosting.location}
                {application.jobPosting.district && ` ${application.jobPosting.district}`}
                {application.jobPosting.detailedAddress && ` - ${application.jobPosting.detailedAddress}`}
              </p>
            </div>
          )}

          <div>
            <h4 className="font-medium text-gray-900 mb-2">지원한 시간대</h4>
            
            {/* 다중 선택 지원 정보 표시 */}
            {application.assignedRoles && application.assignedTimes ? (
              <div className="space-y-2">
                {(() => {
                  // 날짜별로 그룹화
                  const groupedByDate: Record<string, Array<{time: string, role: string, index: number}>> = {};
                  
                  application.assignedTimes.forEach((time: string, index: number) => {
                    const dateValue = application.assignedDates?.[index];
                    const dateString = dateValue ? formatDateUtil(dateValue as DateValue) : '날짜 미정';
                    
                    if (!groupedByDate[dateString]) {
                      groupedByDate[dateString] = [];
                    }
                    
                    groupedByDate[dateString]!.push({
                      time: (() => {
                        if (!time) return '';
                        if (typeof time === 'string') return time;
                        if (typeof time === 'object' && 'seconds' in time) {
                          return formatDateUtil(time as FirebaseTimestamp);
                        }
                        return String(time);
                      })(),
                      role: application.assignedRoles?.[index] || '',
                      index
                    });
                  });
                  
                  // 날짜 정렬
                  const sortedDates = Object.keys(groupedByDate).sort();
                  
                  return sortedDates.map((date) => (
                    <div key={date} className="bg-gray-50 rounded-lg p-2">
                      <div className="text-blue-600 font-medium mb-1">
                        📅 {date}
                      </div>
                      <div className="space-y-1 ml-4">
                        {groupedByDate[date]?.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 text-gray-700">
                              <span>⏰ {item.time}</span>
                              {item.role && (
                                <span className="text-gray-600">
                                  - 👤 {String(t(`jobPostingAdmin.create.${item.role}`) || item.role)}
                                </span>
                              )}
                            </div>
                            {application.status === 'confirmed' && (
                              <span className="text-green-600 text-sm font-medium">확정됨</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            ) : (
              /* 단일 선택 지원 정보 표시 (하위 호환성) */
              <div className="p-2 bg-gray-50 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2">
                    {/* 날짜 - 모바일에서 첫 줄 */}
                    {application.assignedDate && (
                      <div className="text-blue-600 font-medium">
                        📅 {formatDateUtil(application.assignedDate)}
                      </div>
                    )}
                    {/* 시간과 역할 - 모바일에서 둘째 줄 */}
                    <div className="flex items-center space-x-2 text-gray-700">
                      <span>
                        ⏰ {(() => {
                          const time = application.assignedTime;
                          if (!time) return '';
                          if (typeof time === 'string') return time;
                          if (typeof time === 'object' && 'seconds' in time) {
                            return formatDateUtil(time as FirebaseTimestamp);
                          }
                          return String(time);
                        })()}
                      </span>
                      {application.assignedRole && (
                        <span className="text-gray-600">
                          - 👤 {String(t(`jobPostingAdmin.create.${application.assignedRole}`) || application.assignedRole)}
                        </span>
                      )}
                      {application.status === 'confirmed' && (
                        <span className="ml-2 text-green-600 text-sm font-medium sm:hidden">확정됨</span>
                      )}
                    </div>
                  </div>
                  {application.status === 'confirmed' && (
                    <span className="hidden sm:block text-green-600 text-sm font-medium">확정됨</span>
                  )}
                </div>
              </div>
            )}

            
            {application.jobPosting && (
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                {onViewDetail && application.jobPosting && (
                  <button
                    onClick={() => onViewDetail(application.jobPosting)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm flex-1 sm:flex-initial"
                    aria-label="공고 상세정보 보기"
                  >
                    자세히보기
                  </button>
                )}
                {application.status === 'applied' && (
                  <button
                    onClick={() => onCancel(application.postId)}
                    disabled={isProcessing === application.postId}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 text-sm flex-1 sm:flex-initial"
                  >
                    {isProcessing === application.postId ? '취소 중...' : '지원 취소'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MyApplicationsTab;