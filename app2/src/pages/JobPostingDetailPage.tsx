import { doc, getDoc } from 'firebase/firestore';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaChevronUp, FaChevronDown } from 'react-icons/fa';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';

import ApplicantListTab from '../components/tabs/ApplicantListTab';
import EventManagementTab from '../components/tabs/EventManagementTab';
import PayrollProcessingTab from '../components/tabs/PayrollProcessingTab';
import ShiftManagementTab from '../components/tabs/ShiftManagementTab';
import StaffManagementTab from '../components/tabs/StaffManagementTab';
import { JobPostingProvider } from '../contexts/JobPostingContext';
import { db } from '../firebase';
import { JobPosting, JobPostingUtils, DateSpecificRequirement } from '../types/jobPosting';


type TabType = 'applicants' | 'staff' | 'events' | 'shifts' | 'payroll';

interface TabConfig {
  id: TabType;
  label: string;
  component: React.FC<{ jobPosting?: JobPosting | null }>;
}

const tabs: TabConfig[] = [
  { id: 'applicants', label: '지원자 목록', component: ApplicantListTab },
  { id: 'staff', label: '스태프 관리', component: StaffManagementTab },
  { id: 'events', label: '이벤트 관리', component: EventManagementTab },
  { id: 'shifts', label: '시프트 관리', component: ShiftManagementTab },
  { id: 'payroll', label: '급여 처리', component: PayrollProcessingTab },
];

const JobPostingDetailPageContent: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [jobPosting, setJobPosting] = useState<JobPosting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInfoExpanded, setIsInfoExpanded] = useState(true);
  
  // Get active tab from URL or default to 'applicants'
  const activeTab = (searchParams.get('tab') as TabType) || 'applicants';
  
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
  const handleTabChange = useCallback((tabId: TabType) => {
    setSearchParams({ tab: tabId });
  }, [setSearchParams]);

  // Handle info toggle
  const handleToggleInfo = useCallback(() => {
    setIsInfoExpanded(prev => !prev);
  }, []);

  // Handle keyboard events for accessibility
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleToggleInfo();
    }
  }, [handleToggleInfo]);

  // Format date for display
  const formatDate = useCallback((dateInput: any) => {
    if (!dateInput) return '';
    
    try {
      let date: Date;
      
      if (dateInput && typeof dateInput === 'object' && 'seconds' in dateInput) {
        date = new Date(dateInput.seconds * 1000);
      } else if (dateInput instanceof Date) {
        date = dateInput;
      } else if (typeof dateInput === 'string') {
        date = new Date(dateInput);
      } else {
        return String(dateInput);
      }
      
      if (isNaN(date.getTime())) {
        return String(dateInput);
      }
      
      const year = date.getFullYear().toString().slice(-2);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const dayOfWeekIndex = date.getDay();
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      const dayOfWeek = dayNames[dayOfWeekIndex] || '?';
      
      return `${year}-${month}-${day}(${dayOfWeek})`;
    } catch (error) {
      console.error('Error formatting date:', error, dateInput);
      return String(dateInput);
    }
  }, []);

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
        console.error('Error fetching job posting:', error);
        setError('Failed to load job posting');
      } finally {
        setLoading(false);
      }
    };

    fetchJobPosting();
  }, [id]);

  // Get active tab component
  const ActiveTabComponent = useMemo(() => 
    tabs.find(tab => tab.id === activeTab)?.component || ApplicantListTab, 
    [activeTab]
  );

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-center items-center min-h-96">
          <div className="text-lg">로딩 중...</div>
        </div>
      </div>
    );
  }

  if (error || !jobPosting) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-800 mb-2">오류 발생</h2>
          <p className="text-red-600 mb-4">{error || '공고를 찾을 수 없습니다.'}</p>
          <button 
            onClick={() => navigate('/admin/job-postings')}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            공고 목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const formattedStartDate = formatDate(jobPosting.startDate);
  const formattedEndDate = formatDate(jobPosting.endDate);

  return (
    <div className="container mx-auto p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <button 
            onClick={() => navigate('/admin/job-postings')}
            className="flex items-center text-gray-600 hover:text-gray-800"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            공고 목록으로 돌아가기
          </button>
          <span className={`px-3 py-1 text-sm font-medium rounded-full ${
            jobPosting.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {jobPosting.status === 'open' ? '모집 중' : '모집 마감'}
          </span>
        </div>
        
        {/* Toggle Button */}
        <button
          onClick={handleToggleInfo}
          onKeyDown={handleKeyDown}
          disabled={loading}
          aria-expanded={isInfoExpanded}
          aria-controls="basic-info-section"
          aria-label={isInfoExpanded ? t('jobPosting.info.collapse') : t('jobPosting.info.expand')}
          className="inline-flex justify-center py-3 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed mb-4 transition-all duration-300 min-h-[44px] toggle-button"
          type="button"
        >
          {isInfoExpanded ? (
            <>
              <FaChevronUp className="w-4 h-4 mr-2" aria-hidden="true" />
              {t('jobPosting.info.collapse')}
            </>
          ) : (
            <>
              <FaChevronDown className="w-4 h-4 mr-2" aria-hidden="true" />
              {t('jobPosting.info.expand')}
            </>
          )}
        </button>
        
        {/* Basic Info Section */}
        {isInfoExpanded ? <div 
            id="basic-info-section"
            className="bg-white rounded-lg shadow-md p-6"
            role="region"
            aria-label={t('jobPosting.info.section')}
          >
            <h1 className="text-2xl font-bold mb-4">{jobPosting.title}</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">위치:</span>
                <span className="ml-2">{jobPosting.location}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">유형:</span>
                <span className="ml-2">{jobPosting.type === 'application' ? '지원형' : '고정형'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">기간:</span>
                <span className="ml-2">
                  {jobPosting.endDate && jobPosting.endDate !== jobPosting.startDate 
                    ? `${formattedStartDate} ~ ${formattedEndDate}` 
                    : formattedStartDate
                  }
                </span>
              </div>
            </div>
            
            {/* 시간대 및 역할 표시 - 일자별 다른 인원 요구사항 고려 */}
            {JobPostingUtils.hasDateSpecificRequirements(jobPosting) ? (
              /* 일자별 다른 인원 요구사항이 있는 경우 */
              <div className="mt-4">
                <span className="font-medium text-gray-700">시간대 및 역할 (일자별 다른 인원 요구사항):</span>
                <div className="mt-2 space-y-4">
                  {jobPosting.dateSpecificRequirements?.map((dateReq: DateSpecificRequirement, dateIndex: number) => (
                    <div key={dateIndex} className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <div className="text-sm font-medium text-blue-800 mb-3">
                        📅 {formatDate(dateReq.date)} 일정
                      </div>
                      <div className="space-y-2">
                        {dateReq.timeSlots.map((ts, tsIndex) => (
                          <div key={`${dateIndex}-${tsIndex}`} className="pl-4 border-l-2 border-blue-300 bg-white rounded-r p-2">
                            <p className="font-semibold text-gray-700">{ts.time}</p>
                            <div className="text-sm text-gray-600">
                              {ts.roles.map((role, roleIndex) => (
                                <span key={roleIndex} className="mr-4">
                                  {role.name}: {role.count}명
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : jobPosting.timeSlots && jobPosting.timeSlots.length > 0 ? (
              /* 기존 방식: 전체 기간 공통 timeSlots */
              <div className="mt-4">
                <span className="font-medium text-gray-700">시간대 및 역할:</span>
                <div className="mt-2 space-y-2">
                  {jobPosting.timeSlots.map((ts, index) => (
                    <div key={index} className="pl-4 border-l-2 border-gray-200">
                      <p className="font-semibold text-gray-700">{ts.time}</p>
                      <div className="text-sm text-gray-600">
                        {ts.roles.map((role, i) => (
                          <span key={i} className="mr-4">
                            {role.name}: {role.count}명
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            
            {jobPosting.description ? <div className="mt-4">
                <span className="font-medium text-gray-700">설명:</span>
                <p className="mt-1 text-gray-600">{jobPosting.description}</p>
              </div> : null}
          </div> : null}
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-md">
        <ActiveTabComponent jobPosting={jobPosting} />
      </div>
    </div>
  );
};

const JobPostingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-800 mb-2">오류 발생</h2>
          <p className="text-red-600 mb-4">공고 ID가 필요합니다.</p>
        </div>
      </div>
    );
  }

  return (
    <JobPostingProvider jobPostingId={id}>
      <JobPostingDetailPageContent />
    </JobPostingProvider>
  );
};

export default JobPostingDetailPage;