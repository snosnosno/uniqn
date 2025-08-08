import React from 'react';
import { useTranslation } from 'react-i18next';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { formatDate as formatDateUtil } from '../../../utils/jobPosting/dateUtils';
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
    startDate: DateValue;
    endDate: DateValue;
    salaryType?: string;
    salaryAmount?: number;
    benefits?: Record<string, unknown>;
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
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
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
        <div key={application.id} className="bg-white rounded-lg shadow-md p-6 border">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {application.jobPosting?.title || '삭제된 공고'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                지원일: {formatDateUtil(application.appliedAt)}
              </p>
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
            <div className="mb-4 text-sm text-gray-600">
              <p>📍 {application.jobPosting.location}
                {application.jobPosting.district && ` ${application.jobPosting.district}`}
                {application.jobPosting.detailedAddress && ` - ${application.jobPosting.detailedAddress}`}
              </p>
              <p>📅 {formatDateUtil(application.jobPosting.startDate)} ~ {formatDateUtil(application.jobPosting.endDate)}</p>
              
              {/* 급여 정보 추가 */}
              {application.jobPosting.salaryType && application.jobPosting.salaryAmount && (
                <p>💰 {formatSalaryDisplay(application.jobPosting.salaryType, application.jobPosting.salaryAmount)}</p>
              )}
              
              {/* 복리후생 정보 추가 */}
              {application.jobPosting.benefits && Object.keys(application.jobPosting.benefits).length > 0 && (
                <div>
                  {getBenefitDisplayGroups(application.jobPosting.benefits).map((group, index) => (
                    <p key={index} className={index > 0 ? "ml-5" : ""}>
                      {index === 0 ? '🎁 ' : '   '}{group.join(', ')}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="border-t pt-4">
            <h4 className="font-medium text-gray-900 mb-3">지원한 시간대</h4>
            
            {/* 다중 선택 지원 정보 표시 */}
            {application.assignedRoles && application.assignedTimes ? (
              <div className="space-y-2">
                {application.assignedTimes.map((time: string, index: number) => (
                  <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      {application.assignedDates && application.assignedDates[index] && (
                        <span className="text-blue-600 font-medium">
                          📅 {formatDateUtil(application.assignedDates[index] as DateValue)} | 
                        </span>
                      )}
                      <span className="text-gray-700">
                        ⏰ {(() => {
                          if (!time) return '';
                          if (typeof time === 'string') return time;
                          if (typeof time === 'object' && 'seconds' in time) {
                            return formatDateUtil(time as FirebaseTimestamp);
                          }
                          return String(time);
                        })()}
                      </span>
                      {application.assignedRoles && application.assignedRoles[index] && (
                        <span className="ml-2 text-gray-600">
                          - 👤 {String(t(`jobPostingAdmin.create.${application.assignedRoles[index]}`) || application.assignedRoles[index])}
                        </span>
                      )}
                    </div>
                    {application.status === 'confirmed' && (
                      <span className="ml-2 text-green-600 text-sm font-medium">확정됨</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* 단일 선택 지원 정보 표시 (하위 호환성) */
              <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  {application.assignedDate && (
                    <span className="text-blue-600 font-medium">
                      📅 {formatDateUtil(application.assignedDate)} | 
                    </span>
                  )}
                  <span className="text-gray-700">
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
                    <span className="ml-2 text-gray-600">
                      - 👤 {String(t(`jobPostingAdmin.create.${application.assignedRole}`) || application.assignedRole)}
                    </span>
                  )}
                </div>
                {application.status === 'confirmed' && (
                  <span className="ml-2 text-green-600 text-sm font-medium">확정됨</span>
                )}
              </div>
            )}

            {/* 사전질문 답변 표시 */}
            {application.preQuestionAnswers && application.preQuestionAnswers.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h5 className="font-medium text-blue-800 mb-2">📝 사전질문 답변</h5>
                <div className="space-y-2">
                  {application.preQuestionAnswers.map((answer, index) => (
                    <div key={index} className="text-sm">
                      <p className="font-medium text-gray-700">
                        Q{index + 1}. {answer?.question || '질문 정보 없음'}
                        {answer?.required && <span className="text-red-500 ml-1">*</span>}
                      </p>
                      <p className="text-gray-600 ml-4 mt-1">
                        ▶ {answer?.answer && answer.answer !== 'undefined' && answer.answer !== undefined 
                            ? String(answer.answer) 
                            : <span className="text-gray-400">(답변 없음)</span>}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {application.status === 'confirmed' && application.confirmedAt && (
              <p className="text-sm text-green-600 mt-2">
                ✅ 확정일: {formatDateUtil(application.confirmedAt)}
              </p>
            )}
            
            {application.jobPosting && (
              <div className="mt-4 flex flex-col sm:flex-row gap-2">
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