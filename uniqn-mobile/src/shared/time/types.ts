import type { DateInput } from '@/utils/date/core';

export type TimeInput = DateInput;

export interface NormalizedWorkTime {
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  actualStart: Date | null;
  actualEnd: Date | null;
  isEstimate: boolean;
}

export interface TimeFieldsInput {
  checkInTime?: TimeInput;
  checkOutTime?: TimeInput;
  startTime?: TimeInput;
  endTime?: TimeInput;
  timeSlot?: string | null;
  date?: string | null;
}
