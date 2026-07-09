import React from 'react';
import { Badge, type BadgeSize } from '@/components/ui/Badge';
import type { JobPostingStatus } from '@/types';
import { getPostingStatusMeta } from './postingSurfaceModel';

interface PostingStatusBadgeProps {
  status: JobPostingStatus;
  size?: BadgeSize;
  className?: string;
}

export function PostingStatusBadge({ status, size = 'sm', className }: PostingStatusBadgeProps) {
  const meta = getPostingStatusMeta(status);

  return (
    <Badge variant={meta.variant} size={size} className={className}>
      {meta.label}
    </Badge>
  );
}
