/**
 * UNIQN Mobile - InquiryStatusBadge 而댄룷?뚰듃
 *
 * @description 臾몄쓽 ?곹깭瑜??쒖떆?섎뒗 諛곗?
 * @version 1.0.0
 */

import React from 'react';
import { View, Text } from 'react-native';
import type { InquiryStatus } from '@/types';
import { INQUIRY_STATUS_CONFIG } from '@/types/inquiry';

export interface InquiryStatusBadgeProps {
  status: InquiryStatus;
  size?: 'sm' | 'md';
  className?: string;
}

const sizeStyles = {
  sm: {
    container: 'px-2 py-0.5',
    text: 'text-xs',
  },
  md: {
    container: 'px-3 py-1',
    text: 'text-sm',
  },
};

export function InquiryStatusBadge({
  status,
  size = 'md',
  className = '',
}: InquiryStatusBadgeProps) {
  const config = INQUIRY_STATUS_CONFIG[status];
  const sizeStyle = sizeStyles[size];

  return (
    <View
      className={`rounded-sm ${config.bgColor} ${sizeStyle.container} ${className}`}
      accessibilityLabel={`?곹깭: ${config.label}`}
    >
      <Text className={`font-medium ${config.color} ${sizeStyle.text}`}>{config.label}</Text>
    </View>
  );
}

export default InquiryStatusBadge;
