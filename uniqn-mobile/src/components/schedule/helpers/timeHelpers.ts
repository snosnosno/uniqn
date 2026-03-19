import { TimeNormalizer, type TimeInput } from '@/shared/time';
import { formatDateShortWithDay } from '@/utils/date';

export function formatTime(value: TimeInput): string {
  const date = TimeNormalizer.parseTime(value);
  if (!date) return '--:--';

  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatTimeRange(start: TimeInput, end: TimeInput): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

export function calculateDuration(start: TimeInput, end: TimeInput): string {
  const startDate = TimeNormalizer.parseTime(start);
  const endDate = TimeNormalizer.parseTime(end);

  if (!startDate || !endDate) return '-';

  let diffMs = endDate.getTime() - startDate.getTime();
  if (diffMs < 0) {
    diffMs += 24 * 60 * 60 * 1000;
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0 && minutes > 0) return `${hours}시간 ${minutes}분`;
  if (hours > 0) return `${hours}시간`;
  return `${minutes}분`;
}

export function formatDate(dateString: string): string {
  if (!dateString) return '-';

  const formatted = formatDateShortWithDay(dateString);
  return formatted === '-' ? dateString : formatted;
}
