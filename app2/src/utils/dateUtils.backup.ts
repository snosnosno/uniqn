// BACKUP of original dateUtils.ts - 432 lines
// This file is kept for reference during migration
// Use dateUtils.ts for the simplified version

import { Timestamp } from 'firebase/firestore';

import { logger } from '../utils/logger';

// Firebase Timestamp 또는 변환 가능한 날짜 타입 정의
type TimestampInput = 
  | Timestamp 
  | Date 
  | string 
  | number
  | { toDate?: () => Date; seconds?: number; _seconds?: number; nanoseconds?: number; assignedDate?: TimestampInput }
  | null 
  | undefined;

// ... original 432 lines of code ...
// See the original file for full content