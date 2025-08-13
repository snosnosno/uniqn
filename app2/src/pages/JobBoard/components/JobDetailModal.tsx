import React from 'react';
import Modal, { ModalFooter } from '../../../components/ui/Modal';
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={jobPosting.title}>
      <JobPostingDetailContent jobPosting={jobPosting} />
    </Modal>
  );
};

export default JobDetailModal;