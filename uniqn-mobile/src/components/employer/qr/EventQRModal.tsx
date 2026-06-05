/**
 * UNIQN Mobile - Event QR modal (employer)
 */

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { QRPanel } from './QRPanel';
import { useEventQRController } from './useEventQRController';

export interface EventQRModalProps {
  visible: boolean;
  onClose: () => void;
  jobPostingId: string;
  jobTitle?: string;
  eventDate?: string;
  assignmentGroupId?: string | null;
  timeSlot?: string | null;
}

export function EventQRModal({
  visible,
  onClose,
  jobPostingId,
  jobTitle,
  eventDate,
  assignmentGroupId,
  timeSlot,
}: EventQRModalProps) {
  const controller = useEventQRController({
    visible,
    jobPostingId,
    eventDate,
    assignmentGroupId,
    timeSlot,
  });

  return (
    <Modal visible={visible} onClose={onClose} position="center" size="lg" showCloseButton={false}>
      <QRPanel {...controller} jobTitle={jobTitle} onClose={onClose} />
    </Modal>
  );
}

export default EventQRModal;
