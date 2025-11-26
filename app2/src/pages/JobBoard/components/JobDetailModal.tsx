import React from 'react';
import Modal from '@/components/ui/Modal';
import JobPostingDetailContent from '@/components/jobPosting/JobPostingDetailContent';
import { JobPosting } from '@/types/jobPosting';

interface JobDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobPosting: JobPosting | null;
}

/**
 * 구인공고 상세 정보 모달 컴포넌트
 */
const JobDetailModal: React.FC<JobDetailModalProps> = ({ isOpen, onClose, jobPosting }) => {
  if (!jobPosting) return null;

  // 고정공고인지 확인 (postingType 필드 사용)
  const isFixedPosting = jobPosting.postingType === 'fixed';

  // 커스텀 타이틀 (제목 + 모집유형 뱃지)
  const customTitle = (
    <div className="flex items-center justify-between w-full">
      <span className="text-gray-900 dark:text-gray-100">{jobPosting.title}</span>
      <span
        className={`ml-3 px-3 py-1 text-sm font-medium rounded-full ${
          isFixedPosting
            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
        }`}
      >
        {isFixedPosting ? '고정' : '지원'}
      </span>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={customTitle}>
      <JobPostingDetailContent
        jobPosting={jobPosting}
        hideTitle={true}
        hideScheduleInfo={isFixedPosting}
      />
    </Modal>
  );
};

export default JobDetailModal;
