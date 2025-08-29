import React from 'react';
import Modal from '../../../components/ui/Modal';
import JobPostingDetailContent from '../../../components/jobPosting/JobPostingDetailContent';
import { JobPosting } from '../../../types/jobPosting';

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

  // 커스텀 타이틀 (제목 + 모집유형 뱃지)
  const customTitle = (
    <div className="flex items-center justify-between w-full">
      <span>{jobPosting.title}</span>
      <span className={`ml-3 px-3 py-1 text-sm font-medium rounded-full ${
        jobPosting.recruitmentType === 'fixed' 
          ? 'bg-purple-100 text-purple-800' 
          : 'bg-blue-100 text-blue-800'
      }`}>
        {jobPosting.recruitmentType === 'fixed' ? '고정' : '지원'}
      </span>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={customTitle}>
      <JobPostingDetailContent jobPosting={jobPosting} hideTitle={true} />
    </Modal>
  );
};

export default JobDetailModal;