import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { JobPosting } from '../types/jobPosting';
import ApplicantListTab from '../components/tabs/ApplicantListTab';
// Placeholder tab components (ApplicantsTab replaced with ApplicantListTab)


const StaffManagementTab: React.FC = () => (
  <div className="p-6">
    <h3 className="text-lg font-medium mb-4">스태프 관리</h3>
    <div className="bg-gray-50 p-4 rounded-lg">
      <p className="text-gray-600">스태프 관리 기능이 곧 추가될 예정입니다.</p>
    </div>
  </div>
);

const EventManagementTab: React.FC = () => (
  <div className="p-6">
    <h3 className="text-lg font-medium mb-4">이벤트 관리</h3>
    <div className="bg-gray-50 p-4 rounded-lg">
      <p className="text-gray-600">이벤트 관리 기능은 추후 개발 예정입니다.</p>
    </div>
  </div>
);

const ShiftManagementTab: React.FC<{ jobPosting?: JobPosting | null }> = ({ jobPosting }) => (
  <div className="p-6">
    <h3 className="text-lg font-medium mb-4">시프트 관리</h3>
    <div className="bg-gray-50 p-4 rounded-lg">
      <p className="text-gray-600">시프트 관리 기능이 곧 추가될 예정입니다.</p>
    </div>
  </div>
);

const PayrollTab: React.FC<{ jobPosting?: JobPosting | null }> = ({ jobPosting }) => (
  <div className="p-6">
    <h3 className="text-lg font-medium mb-4">급여 처리</h3>
    <div className="bg-gray-50 p-4 rounded-lg">
      <p className="text-gray-600">급여 처리 기능이 곧 추가될 예정입니다.</p>
    </div>
  </div>
);

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
  { id: 'payroll', label: '급여 처리', component: PayrollTab },
];

const JobPostingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [jobPosting, setJobPosting] = useState<JobPosting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get active tab from URL or default to 'applicants'
  const activeTab = (searchParams.get('tab') as TabType) || 'applicants';
  
  // Handle tab change with URL sync
  const handleTabChange = (tabId: TabType) => {
    setSearchParams({ tab: tabId });
  };

  // Format date for display
  const formatDate = (dateInput: any) => {
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
  };

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
  const ActiveTabComponent = tabs.find(tab => tab.id === activeTab)?.component || ApplicantListTab;

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
        
        <div className="bg-white rounded-lg shadow-md p-6">
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
          
          {jobPosting.timeSlots && jobPosting.timeSlots.length > 0 && (
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
          )}
          
          {jobPosting.description && (
            <div className="mt-4">
              <span className="font-medium text-gray-700">설명:</span>
              <p className="mt-1 text-gray-600">{jobPosting.description}</p>
            </div>
          )}
        </div>
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

export default JobPostingDetailPage;