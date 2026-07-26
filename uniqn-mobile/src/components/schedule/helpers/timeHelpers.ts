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

export function formatDate(dateString: string): string {
  if (!dateString) return '-';

  const formatted = formatDateShortWithDay(dateString);
  return formatted === '-' ? dateString : formatted;
}
