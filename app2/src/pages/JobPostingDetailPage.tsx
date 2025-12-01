import { doc, getDoc } from 'firebase/firestore';
import { logger } from '../utils/logger';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaChevronUp, FaChevronDown } from '../components/Icons/ReactIconsReplacement';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import JobPostingDetailContent from '../components/jobPosting/JobPostingDetailContent';
import { JobPostingProvider } from '../contexts/JobPostingContextAdapter';
import { db } from '../firebase';
import { usePermissions } from '../hooks/usePermissions';
import { useJobPostingAnnouncement } from '../hooks/useJobPostingAnnouncement';
import { JobPosting } from '../types/jobPosting';
import SendAnnouncementModal from '../components/jobPosting/modals/SendAnnouncementModal';

// 🚀 Week 4 지연 로딩: React.lazy()로 초기 번들 크기 50% 감소
const ApplicantListTab = React.lazy(() => import('../components/tabs/ApplicantListTab'));
const ShiftManagementTab = React.lazy(() => import('../components/tabs/ShiftManagementTab'));
const StaffManagementTab = React.lazy(() => import('../components/tabs/StaffManagementTab'));
const EnhancedPayrollTab = React.lazy(() => import('../components/tabs/EnhancedPayrollTab'));

type TabType = 'applicants' | 'staff' | 'shifts' | 'payroll';

interface TabConfig {
  id: TabType;
  label: string;
  component: React.FC<{ jobPosting?: JobPosting | null; eventId?: string }>;
  requiredPermission?: {
    resource: 'jobPostings' | 'staff' | 'schedules' | 'payroll';
    action: string;
  };
  allowedRoles?: string[];
}

const allTabs: TabConfig[] = [
  {
    id: 'applicants',
    label: '지원자',
    component: ApplicantListTab,
    requiredPermission: { resource: 'jobPostings', action: 'manageApplicants' },
  },
  {
    id: 'staff',
    label: '스태프',
    component: StaffManagementTab,
    requiredPermission: { resource: 'jobPostings', action: 'manageApplicants' },
  },
  {
    id: 'shifts',
    label: '시프트',
    component: ShiftManagementTab,
    allowedRoles: ['admin', 'manager', 'staff'], // ✅ Staff 추가 - 본인 공고에서 시프트 관리 가능
  },
  {
    id: 'payroll',
    label: '정산',
    component: EnhancedPayrollTab,
    allowedRoles: ['admin', 'manager', 'staff'],
  },
];

const JobPostingDetailPageContent: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { checkPermission, checkJobPostingPermission, permissions } = usePermissions();
  const { sendAnnouncement, isSending } = useJobPostingAnnouncement();

  const [jobPosting, setJobPosting] = useState<JobPosting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);

  // 권한에 따라 접근 가능한 탭 필터링
  const availableTabs = useMemo(() => {
    if (!permissions || !jobPosting) return [];

    return allTabs.filter((tab) => {
      // 역할 기반 권한 확인
      if (tab.allowedRoles && !tab.allowedRoles.includes(permissions.role)) {
        return false;
      }

      // 세분화된 권한 확인
      if (tab.requiredPermission) {
        // Manager와 Staff의 경우 자신이 작성한 공고인지 확인
        if (permissions.role === 'manager' || permissions.role === 'staff') {
          return checkJobPostingPermission(tab.requiredPermission.action, jobPosting.createdBy);
        }

        return checkPermission(tab.requiredPermission.resource, tab.requiredPermission.action);
      }

      return true;
    });
  }, [permissions, checkPermission, checkJobPostingPermission, jobPosting]);

  // Get active tab from URL or default to first available tab
  const activeTab = useMemo(() => {
    const tabFromUrl = searchParams.get('tab') as TabType;
    const isValidTab = availableTabs.some((tab) => tab.id === tabFromUrl);

    if (tabFromUrl && isValidTab) {
      return tabFromUrl;
    }

    const firstTab = availableTabs[0];
    return availableTabs.length > 0 && firstTab ? firstTab.id : 'applicants';
  }, [searchParams, availableTabs]);

  // Load toggle state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem(`jobPosting-${id}-infoExpanded`);
    if (savedState !== null) {
      setIsInfoExpanded(JSON.parse(savedState));
    }
  }, [id]);

  // Save toggle state to localStorage
  useEffect(() => {
    if (id) {
      localStorage.setItem(`jobPosting-${id}-infoExpanded`, JSON.stringify(isInfoExpanded));
    }
  }, [isInfoExpanded, id]);

  // Handle tab change with URL sync
  const handleTabChange = useCallback(
    (tabId: TabType) => {
      setSearchParams({ tab: tabId });
    },
    [setSearchParams]
  );

  // Handle info toggle
  const handleToggleInfo = useCallback(() => {
    setIsInfoExpanded((prev) => !prev);
  }, []);

  // Handle keyboard events for accessibility
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleToggleInfo();
      }
    },
    [handleToggleInfo]
  );

  // Fetch job posting data
  useEffect(() => {
    const fetchJobPosting = async () => {
      if (!id) {
        setError('Job posting ID is required');
        setLoading(false);
        return;
      }

      try {
        const docRef = doc(db, 'jobPostings', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as JobPosting;
          setJobPosting(data);
        } else {
          setError('Job posting not found');
        }
      } catch (error) {
        logger.error(
          'Error fetching job posting:',
          error instanceof Error ? error : new Error(String(error)),
          { component: 'JobPostingDetailPage' }
        );
        setError('Failed to load job posting');
      } finally {
        setLoading(false);
      }
    };

    fetchJobPosting();
  }, [id]);

  // Get active tab component
  const ActiveTabComponent = useMemo(
    () => availableTabs.find((tab) => tab.id === activeTab)?.component || ApplicantListTab,
    [activeTab, availableTabs]
  );

  // 공고 자체에 대한 접근 권한 확인
  const hasJobPostingAccess = useMemo(() => {
    if (!permissions || !jobPosting) return false;

    // Admin은 모든 공고에 접근 가능
    if (permissions.role === 'admin') {
      return true;
    }

    // Manager와 Staff는 자신이 작성한 공고만 접근 가능
    if (permissions.role === 'manager' || permissions.role === 'staff') {
      return checkJobPostingPermission('view', jobPosting.createdBy);
    }

    return false;
  }, [permissions, jobPosting, checkJobPostingPermission]);

  // 공고 접근 권한이 없는 경우 처리
  if (!loading && jobPosting && !hasJobPostingAccess) {
    return (
      <div className="w-full px-2 sm:px-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-800 dark:text-red-300 mb-2">접근 권한 없음</h2>
          <p className="text-red-600 dark:text-red-400 mb-4">
            이 공고에 접근할 권한이 없습니다. 본인이 작성한 공고만 관리할 수 있습니다.
          </p>
          <button
            onClick={() => navigate('/app/admin/job-postings')}
            className="px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded hover:bg-red-700 dark:hover:bg-red-600"
          >
            뒤로
          </button>
        </div>
      </div>
    );
  }

  // 탭 접근 권한이 없는 경우 처리
  if (!loading && hasJobPostingAccess && availableTabs.length === 0) {
    return (
      <div className="w-full px-2 sm:px-4">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-yellow-800 dark:text-yellow-300 mb-2">
            관리 기능 제한
          </h2>
          <p className="text-yellow-600 dark:text-yellow-400 mb-4">
            이 공고에 대한 관리 권한이 제한되어 있습니다.
          </p>
          <button
            onClick={() => navigate('/app/admin/job-postings')}
            className="px-4 py-2 bg-yellow-600 dark:bg-yellow-700 text-white rounded hover:bg-yellow-700 dark:hover:bg-yellow-600"
          >
            공고 목록으로 이동
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full px-2 sm:px-4">
        <div className="flex justify-center items-center min-h-96">
          <div className="text-lg text-gray-900 dark:text-gray-100">로딩 중...</div>
        </div>
      </div>
    );
  }

  if (error || !jobPosting) {
    return (
      <div className="w-full px-2 sm:px-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-800 dark:text-red-300 mb-2">오류 발생</h2>
          <p className="text-red-600 dark:text-red-400 mb-4">
            {error || '공고를 찾을 수 없습니다.'}
          </p>
          <button
            onClick={() => navigate('/app/admin/job-postings')}
            className="px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded hover:bg-red-700 dark:hover:bg-red-600"
          >
            뒤로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-2 sm:px-4">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/app/admin/job-postings')}
            className="flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 flex-shrink-0"
          >
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span className="text-sm sm:text-base">뒤로</span>
          </button>

          {/* 공고 제목 - 중앙에 배치 */}
          <div className="flex-1 text-center px-2 sm:px-4">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
              {jobPosting.title}
            </h1>
          </div>

          <div className="flex items-center space-x-1 sm:space-x-3 flex-shrink-0">
            <span
              className={`px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm font-medium rounded-full ${
                jobPosting.status === 'open'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
              }`}
            >
              {jobPosting.status === 'open' ? '모집 중' : '모집 마감'}
            </span>

            {/* 공지 전송 버튼 - 항상 표시 */}
            {(permissions?.role === 'admin' || permissions?.role === 'manager') && (
              <button
                onClick={() => setIsAnnouncementModalOpen(true)}
                className="inline-flex items-center justify-center py-1 px-2 sm:py-2 sm:px-3 border border-transparent shadow-sm text-xs sm:text-sm font-medium rounded-md text-white bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-600 focus:ring-offset-2 transition-all duration-300 min-h-[30px] sm:min-h-[40px]"
                type="button"
                title={t('jobPosting.announcement.button')}
              >
                <span className="mr-1">📢</span>
                <span className="hidden sm:inline">{t('jobPosting.announcement.button')}</span>
                <span className="sm:hidden">공지</span>
              </button>
            )}

            {/* Toggle Button - 오른쪽에 배치 */}
            <button
              onClick={handleToggleInfo}
              onKeyDown={handleKeyDown}
              disabled={loading}
              aria-expanded={isInfoExpanded}
              aria-controls="basic-info-section"
              aria-label={
                isInfoExpanded ? t('jobPosting.info.collapse') : t('jobPosting.info.expand')
              }
              className="inline-flex justify-center py-1 px-2 sm:py-2 sm:px-3 border border-transparent shadow-sm text-xs sm:text-sm font-medium rounded-md text-white bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 min-h-[30px] sm:min-h-[40px] toggle-button"
              type="button"
            >
              {isInfoExpanded ? (
                <>
                  <FaChevronUp className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" aria-hidden="true" />
                  <span className="hidden sm:inline">{t('jobPosting.info.collapse')}</span>
                  <span className="sm:hidden">닫기</span>
                </>
              ) : (
                <>
                  <FaChevronDown
                    className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2"
                    aria-hidden="true"
                  />
                  <span className="hidden sm:inline">{t('jobPosting.info.expand')}</span>
                  <span className="sm:hidden">열기</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Basic Info Section */}
        {isInfoExpanded && (
          <div
            id="basic-info-section"
            role="region"
            aria-label={t('jobPosting.info.section')}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6"
          >
            <JobPostingDetailContent jobPosting={jobPosting} />
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            {availableTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content with Suspense */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <React.Suspense
          fallback={
            <div className="flex items-center justify-center h-64">
              <div className="text-lg text-gray-500 dark:text-gray-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mr-3 inline-block"></div>
                탭 로딩 중...
              </div>
            </div>
          }
        >
          <ActiveTabComponent jobPosting={jobPosting} eventId={id || ''} />
        </React.Suspense>
      </div>

      {/* 공지 전송 모달 */}
      <SendAnnouncementModal
        isOpen={isAnnouncementModalOpen}
        onClose={() => setIsAnnouncementModalOpen(false)}
        jobPosting={jobPosting}
        confirmedStaff={jobPosting.confirmedStaff || []}
        onSend={async (eventId, title, message, targetStaffIds, jobPostingTitle) => {
          await sendAnnouncement(eventId, title, message, targetStaffIds, jobPostingTitle);
        }}
        isSending={isSending}
      />
    </div>
  );
};

const JobPostingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <div className="w-full px-2 sm:px-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-800 dark:text-red-300 mb-2">오류 발생</h2>
          <p className="text-red-600 dark:text-red-400 mb-4">공고 ID가 필요합니다.</p>
        </div>
      </div>
    );
  }

  return (
    <JobPostingProvider eventId={id}>
      <JobPostingDetailPageContent />
    </JobPostingProvider>
  );
};

export default JobPostingDetailPage;
