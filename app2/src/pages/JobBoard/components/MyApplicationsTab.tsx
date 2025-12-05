import React from 'react';
import { useTranslation } from 'react-i18next';
import LoadingSpinner from '@/components/LoadingSpinner';
import { formatDate as formatDateUtil } from '@/utils/jobPosting/dateUtils';
import AssignmentDisplay from '@/components/common/AssignmentDisplay';
import type { Assignment, PreQuestionAnswer } from '@/types/application';
import type { Timestamp } from 'firebase/firestore';

/** MyApplicationsTab에서 사용하는 JobPosting 최소 필드 */
interface MyApplicationsJobPosting {
  location: string;
  district?: string;
  detailedAddress?: string;
  recruitmentType?: 'application' | 'fixed';
}

/** MyApplicationsTab에서 사용하는 Application 타입 */
interface MyApplicationsApplication {
  id: string;
  postId: string;
  status: string;
  appliedAt: Date | Timestamp | { seconds: number; nanoseconds?: number };
  confirmedAt?: Date | Timestamp;
  postTitle: string;
  assignments: Assignment[];
  preQuestionAnswers?: PreQuestionAnswer[];
  jobPosting?: MyApplicationsJobPosting | null;
}

interface FirebaseTimestamp {
  seconds: number;
  nanoseconds?: number;
  toDate?: () => Date;
}

type DateValue = string | Date | FirebaseTimestamp;

const formatDateOnly = (value: DateValue, fallback: string = ''): string => {
  return value ? formatDateUtil(value) : fallback;
};

// 상태 뱃지 컴포넌트
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const { t } = useTranslation();

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      case 'rejected':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      default:
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed':
        return t('application.status.confirmed', '✅ 확정');
      case 'rejected':
        return t('application.status.rejected', '❌ 미선정');
      default:
        return t('application.status.pending', '⏳ 대기중');
    }
  };

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusStyle(status)}`}>
      {getStatusText(status)}
    </span>
  );
};

// 지원 카드 컴포넌트
const ApplicationCard: React.FC<{
  application: MyApplicationsApplication;
  onViewDetail?: ((postId: string) => void) | undefined;
  onCancel: (postId: string) => void;
  isProcessing: string | null;
}> = ({ application, onViewDetail, onCancel, isProcessing }) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {application.postTitle || t('application.noTitle', '제목 없음')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('application.appliedDate', '지원일')}:{' '}
            {formatDateOnly(application.appliedAt, t('common.dateNotSet', '날짜 미정'))}
          </p>
        </div>
        <StatusBadge status={application.status} />
      </div>

      {application.jobPosting && (
        <div className="mb-3 text-sm text-gray-600 dark:text-gray-300">
          <p>
            📍 {t('application.address', '주소')}: {application.jobPosting.location}
            {application.jobPosting.district && ` ${application.jobPosting.district}`}
            {application.jobPosting.detailedAddress &&
              ` - ${application.jobPosting.detailedAddress}`}
          </p>
        </div>
      )}

      <div>
        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
          {t('application.appliedTimeSlots', '지원한 시간대')}
        </h4>

        {/* 🎯 개발 단계: 모든 데이터는 새 구조 (마이그레이션 불필요) */}
        {(() => {
          // 🎯 개발 단계: 마이그레이션 로직 제거
          const processedApplication = application;

          // assignments 배열 표시 (Single Source of Truth) - 공통 컴포넌트 사용
          if (processedApplication.assignments && processedApplication.assignments.length > 0) {
            return (
              <AssignmentDisplay
                assignments={processedApplication.assignments}
                status={processedApplication.status}
              />
            );
          } else {
            return (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
                <div className="text-gray-500 dark:text-gray-400 text-sm">
                  {t('application.noApplicationInfo', '지원 정보 없음')}
                </div>
              </div>
            );
          }
        })()}

        {application.jobPosting && (
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            {onViewDetail && application.jobPosting && (
              <button
                onClick={() => onViewDetail(application.postId)}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 text-sm flex-1 sm:flex-initial"
                aria-label={t('application.viewDetailAriaLabel', '공고 상세정보 보기')}
              >
                {t('application.viewDetail', '자세히보기')}
              </button>
            )}
            {application.status === 'applied' && (
              <button
                onClick={() => onCancel(application.postId)}
                disabled={isProcessing === application.postId}
                className="px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded hover:bg-red-700 dark:hover:bg-red-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-sm flex-1 sm:flex-initial"
                aria-label={t('application.cancelApplicationAriaLabel', '{{title}} 지원 취소', {
                  title: application.postTitle,
                })}
              >
                {isProcessing === application.postId
                  ? t('application.canceling', '취소 중...')
                  : t('application.cancelApplication', '지원 취소')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// 🔄 중복된 interface 제거 완료 - types/application.ts 타입 사용

interface MyApplicationsTabProps {
  applications: MyApplicationsApplication[];
  loading: boolean;
  onRefresh: () => void;
  onCancel: (postId: string) => void;
  isProcessing: string | null;
  onTabChange: () => void;
  onViewDetail?: (postId: string) => void;
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
  onViewDetail,
}) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner
          size="lg"
          text={t('application.loadingApplications', '지원 현황을 불러오는 중...')}
        />
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 dark:text-gray-400 text-lg mb-2">📋</div>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          {t('application.noApplicationsYet', '아직 지원한 공고가 없습니다.')}
        </p>
        <button
          onClick={onTabChange}
          className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600"
        >
          {t('application.goToJobPostings', '구인 공고 보러가기')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {t('application.myApplicationsTitle', '내 지원 현황')} ({applications.length}
          {t('common.count', '건')})
        </h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-sm"
        >
          {loading ? t('common.refreshing', '새로고침 중...') : t('common.refresh', '🔄 새로고침')}
        </button>
      </div>

      {applications.map((application) => (
        <ApplicationCard
          key={application.id}
          application={application}
          onViewDetail={onViewDetail}
          onCancel={onCancel}
          isProcessing={isProcessing}
        />
      ))}
    </div>
  );
};

export default MyApplicationsTab;
