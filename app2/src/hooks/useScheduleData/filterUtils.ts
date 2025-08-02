import { ScheduleEvent, ScheduleFilters } from '../../types/schedule';

/**
 * 스케줄 이벤트를 필터링
 */
export const filterSchedules = (
  schedules: ScheduleEvent[], 
  filters: ScheduleFilters
): ScheduleEvent[] => {
  return schedules.filter(schedule => {
    // 날짜 범위 필터
    if (filters.dateRange) {
      if (filters.dateRange.start && schedule.date < filters.dateRange.start) {
        return false;
      }
      
      if (filters.dateRange.end && schedule.date > filters.dateRange.end) {
        return false;
      }
    }
    
    // 검색어 필터
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      const matchesSearch = 
        schedule.eventName.toLowerCase().includes(searchLower) ||
        (schedule.role && schedule.role.toLowerCase().includes(searchLower)) ||
        (schedule.location && schedule.location.toLowerCase().includes(searchLower)) ||
        (schedule.notes && schedule.notes.toLowerCase().includes(searchLower));
      
      if (!matchesSearch) {
        return false;
      }
    }
    
    return true;
  });
};

/**
 * 기본 필터 생성
 */
export const createDefaultFilters = (): ScheduleFilters => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  return {
    dateRange: {
      start: startOfMonth.toISOString().split('T')[0] || '',
      end: endOfMonth.toISOString().split('T')[0] || ''
    },
    searchTerm: ''
  };
};