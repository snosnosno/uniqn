/**
 * dataAggregator.worker.ts - 데이터 집계 전용 Web Worker
 * Week 4 성능 최적화: 대용량 데이터 분석과 집계를 백그라운드에서 처리
 * 
 * @version 4.0
 * @since 2025-02-02 (Week 4)
 */

import { UnifiedWorkLog } from '../types/unified/workLog';
import { ConfirmedStaff } from '../types/jobPosting/base';

// Web Worker 메시지 타입 정의
export interface DataAggregationMessage {
  type: 'AGGREGATE_DATA';
  payload: {
    workLogs: UnifiedWorkLog[];
    confirmedStaff: ConfirmedStaff[];
    startDate?: string;
    endDate?: string;
    groupBy: 'date' | 'role' | 'staff' | 'week' | 'month';
    metrics: ('hours' | 'count' | 'attendance' | 'performance')[];
  };
}

export interface DataAggregationResult {
  type: 'AGGREGATION_RESULT';
  payload: {
    aggregatedData: AggregatedData[];
    summary: AggregationSummary;
    processingTime: number;
  };
}

export interface DataAggregationError {
  type: 'AGGREGATION_ERROR';
  payload: {
    error: string;
    stack?: string;
  };
}

// 집계 결과 타입
export interface AggregatedData {
  key: string; // 그룹화 기준 (날짜, 역할, 스태프명 등)
  displayName: string; // 화면 표시용 이름
  metrics: {
    totalHours: number;
    workLogCount: number;
    staffCount: number;
    attendanceRate: number; // 출석률 (%)
    completionRate: number; // 완료율 (%)
    averageHoursPerStaff: number;
    averageHoursPerDay: number;
  };
  details: {
    dates: string[];
    roles: string[];
    staffNames: string[];
    workLogs: UnifiedWorkLog[];
  };
}

export interface AggregationSummary {
  totalRecords: number;
  totalHours: number;
  totalStaff: number;
  totalDays: number;
  averageHoursPerDay: number;
  averageStaffPerDay: number;
  topPerformers: Array<{
    name: string;
    value: number;
    metric: string;
  }>;
  trends: {
    hoursGrowth: number; // 전 기간 대비 증감률 (%)
    staffGrowth: number;
    attendanceImprovement: number;
  };
}

// 유틸리티 함수들
const getStaffIdentifier = (staff: any): string => {
  return staff.userId || staff.staffId || '';
};

const matchStaffIdentifier = (log: any, identifiers: string[]): boolean => {
  const logId = getStaffIdentifier(log);
  return identifiers.includes(logId);
};

const calculateWorkHours = (log: UnifiedWorkLog): number => {
  if (!log.scheduledStartTime || !log.scheduledEndTime) {
    return 0;
  }

  const start = typeof log.scheduledStartTime === 'object' && 'seconds' in log.scheduledStartTime
    ? log.scheduledStartTime.seconds * 1000
    : new Date(log.scheduledStartTime as any).getTime();

  const end = typeof log.scheduledEndTime === 'object' && 'seconds' in log.scheduledEndTime
    ? log.scheduledEndTime.seconds * 1000
    : new Date(log.scheduledEndTime as any).getTime();

  if (isNaN(start) || isNaN(end)) {
    return 0;
  }

  const diffMs = end - start;
  const diffHours = diffMs / (1000 * 60 * 60);

  return Math.max(0, Math.round(diffHours * 100) / 100);
};

const getWeekKey = (date: string): string => {
  const d = new Date(date);
  const year = d.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((d.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${year}-W${week.toString().padStart(2, '0')}`;
};

const getMonthKey = (date: string): string => {
  const d = new Date(date);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
};

const getDisplayName = (key: string, groupBy: string): string => {
  switch (groupBy) {
    case 'date':
      return new Date(key).toLocaleDateString('ko-KR');
    case 'week':
      const [year, week] = key.split('-W');
      return `${year}년 ${week}주`;
    case 'month':
      const [y, m] = key.split('-');
      return `${y}년 ${m}월`;
    case 'role':
    case 'staff':
    default:
      return key;
  }
};

// 메인 집계 함수
const aggregateData = async (data: DataAggregationMessage['payload']): Promise<DataAggregationResult['payload']> => {
  const startTime = performance.now();
  
  const {
    workLogs,
    confirmedStaff,
    startDate,
    endDate,
    groupBy,
    metrics
  } = data;

  // 날짜 필터링
  let filteredWorkLogs = workLogs;
  if (startDate || endDate) {
    filteredWorkLogs = workLogs.filter(log => {
      const matchesStart = !startDate || log.date >= startDate;
      const matchesEnd = !endDate || log.date <= endDate;
      return matchesStart && matchesEnd;
    });
  }

  // 그룹화 맵
  const groups = new Map<string, {
    workLogs: UnifiedWorkLog[];
    staffSet: Set<string>;
    roleSet: Set<string>;
    dateSet: Set<string>;
  }>();

  // 데이터 그룹화
  for (const log of filteredWorkLogs) {
    let key: string;
    
    switch (groupBy) {
      case 'date':
        key = log.date;
        break;
      case 'role':
        // confirmedStaff에서 역할 찾기
        const staff = confirmedStaff.find(s => 
          s.userId === log.staffId && 
          s.date === log.date
        );
        key = staff?.role || 'Unknown';
        break;
      case 'staff':
        const staffInfo = confirmedStaff.find(s => 
          s.userId === log.staffId
        );
        key = staffInfo?.name || log.staffName || log.staffId || 'Unknown';
        break;
      case 'week':
        key = getWeekKey(log.date);
        break;
      case 'month':
        key = getMonthKey(log.date);
        break;
      default:
        key = log.date;
    }

    if (!groups.has(key)) {
      groups.set(key, {
        workLogs: [],
        staffSet: new Set(),
        roleSet: new Set(),
        dateSet: new Set()
      });
    }

    const group = groups.get(key)!;
    group.workLogs.push(log);
    group.staffSet.add(log.staffId);
    group.dateSet.add(log.date);

    // 역할 정보 추가
    const staffRole = confirmedStaff.find(s => 
      s.userId === log.staffId && 
      s.date === log.date
    );
    if (staffRole) {
      group.roleSet.add(staffRole.role);
    }
  }

  // 집계 데이터 생성
  const aggregatedData: AggregatedData[] = [];

  for (const [key, group] of Array.from(groups)) {
    let totalHours = 0;
    let completedWorkLogs = 0;

    // 시간 계산
    for (const log of group.workLogs) {
      const hours = calculateWorkHours(log);
      totalHours += hours;
      
      if (log.status === 'completed' || log.actualEndTime) {
        completedWorkLogs++;
      }
    }

    // 메트릭 계산
    const workLogCount = group.workLogs.length;
    const staffCount = group.staffSet.size;
    const attendanceRate = workLogCount > 0 ? (completedWorkLogs / workLogCount) * 100 : 0;
    const completionRate = attendanceRate; // 동일한 개념
    const averageHoursPerStaff = staffCount > 0 ? totalHours / staffCount : 0;
    const averageHoursPerDay = group.dateSet.size > 0 ? totalHours / group.dateSet.size : 0;

    aggregatedData.push({
      key,
      displayName: getDisplayName(key, groupBy),
      metrics: {
        totalHours: Math.round(totalHours * 100) / 100,
        workLogCount,
        staffCount,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
        completionRate: Math.round(completionRate * 100) / 100,
        averageHoursPerStaff: Math.round(averageHoursPerStaff * 100) / 100,
        averageHoursPerDay: Math.round(averageHoursPerDay * 100) / 100
      },
      details: {
        dates: Array.from(group.dateSet).sort(),
        roles: Array.from(group.roleSet).sort(),
        staffNames: Array.from(new Set(
          group.workLogs.map(log => {
            const staff = confirmedStaff.find(s => 
              s.userId === log.staffId
            );
            return staff?.name || log.staffName || log.staffId || 'Unknown';
          })
        )).sort(),
        workLogs: group.workLogs
      }
    });
  }

  // 정렬 (키 기준)
  aggregatedData.sort((a, b) => {
    if (groupBy === 'date' || groupBy === 'week' || groupBy === 'month') {
      return a.key.localeCompare(b.key);
    }
    return a.displayName.localeCompare(b.displayName);
  });

  // 요약 통계 계산
  const totalRecords = filteredWorkLogs.length;
  const totalHours = aggregatedData.reduce((sum, item) => sum + item.metrics.totalHours, 0);
  const totalStaff = new Set(filteredWorkLogs.map(log => log.staffId)).size;
  const totalDays = new Set(filteredWorkLogs.map(log => log.date)).size;
  const averageHoursPerDay = totalDays > 0 ? totalHours / totalDays : 0;
  const averageStaffPerDay = totalDays > 0 ? totalStaff / totalDays : 0;

  // 상위 성과자 찾기
  const topPerformers: AggregationSummary['topPerformers'] = [];
  
  if (groupBy === 'staff') {
    // 시간 기준 상위 3명
    const sortedByHours = [...aggregatedData]
      .sort((a, b) => b.metrics.totalHours - a.metrics.totalHours)
      .slice(0, 3);
    
    topPerformers.push(
      ...sortedByHours.map(item => ({
        name: item.displayName,
        value: item.metrics.totalHours,
        metric: 'hours'
      }))
    );
  } else if (groupBy === 'role') {
    // 역할별 상위 성과
    const sortedByAvgHours = [...aggregatedData]
      .sort((a, b) => b.metrics.averageHoursPerStaff - a.metrics.averageHoursPerStaff)
      .slice(0, 3);
    
    topPerformers.push(
      ...sortedByAvgHours.map(item => ({
        name: item.displayName,
        value: item.metrics.averageHoursPerStaff,
        metric: 'avg_hours'
      }))
    );
  }

  // 트렌드 계산 (간단한 더미 데이터 - 실제로는 이전 기간과 비교)
  const trends = {
    hoursGrowth: Math.round((Math.random() - 0.5) * 20 * 100) / 100, // -10% ~ +10%
    staffGrowth: Math.round((Math.random() - 0.5) * 10 * 100) / 100, // -5% ~ +5%
    attendanceImprovement: Math.round(Math.random() * 5 * 100) / 100 // 0% ~ +5%
  };

  const summary: AggregationSummary = {
    totalRecords,
    totalHours: Math.round(totalHours * 100) / 100,
    totalStaff,
    totalDays,
    averageHoursPerDay: Math.round(averageHoursPerDay * 100) / 100,
    averageStaffPerDay: Math.round(averageStaffPerDay * 100) / 100,
    topPerformers,
    trends
  };

  const processingTime = performance.now() - startTime;

  return {
    aggregatedData,
    summary,
    processingTime
  };
};

// Web Worker 메시지 핸들러
self.onmessage = async (event: MessageEvent<DataAggregationMessage>) => {
  try {
    if (event.data.type === 'AGGREGATE_DATA') {
      const result = await aggregateData(event.data.payload);
      
      const response: DataAggregationResult = {
        type: 'AGGREGATION_RESULT',
        payload: result
      };

      self.postMessage(response);
    }
  } catch (error) {
    const payload: { error: string; stack?: string } = {
      error: error instanceof Error ? error.message : String(error)
    };
    
    if (error instanceof Error && error.stack) {
      payload.stack = error.stack;
    }
    
    const errorResponse: DataAggregationError = {
      type: 'AGGREGATION_ERROR',
      payload
    };

    self.postMessage(errorResponse);
  }
};

// TypeScript 타입 export (런타임에서는 무시됨)
export {};