import {
  collection,
  query,
  where,
  doc,
  updateDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
  addDoc,
  getDocs,
} from 'firebase/firestore';
import { logger } from '../utils/logger';
import { useState, useCallback, useMemo, useEffect } from 'react';

import { db } from '../firebase';
import { useFirestoreDocument } from './firestore';
import {
  validateSchedule,
  ValidationResult,
  ValidationSettings,
  DEFAULT_VALIDATION_SETTINGS,
  DealerSchedule,
} from '../utils/shiftValidation';
import {
  generateTimeSlots as utilGenerateTimeSlots,
  convertAssignmentData,
} from '../utils/timeUtils';

// ShiftSchedule 데이터 구조 정의
export interface ShiftSchedule {
  id: string;
  eventId: string;
  date: string; // YYYY-MM-DD 형식
  timeInterval: number; // 분 단위 (10, 20, 30, 60)
  startTime: string; // HH:MM 형식
  endTime: string; // HH:MM 형식
  scheduleData: {
    [staffId: string]: {
      // staffId를 표준으로 사용
      staffName: string;
      startTime: string; // 개인별 출근시간
      assignments: { [timeSlot: string]: string }; // "Table1" | "Table2" | "휴식" | "대기"
    };
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 딜러 정보 (기존 Staff와 호환)
export interface ShiftDealer {
  id: string;
  name: string;
  jobRole?: string[]; // 직무 배열 (예: ['Dealer', 'Floor'])
  status?: 'on_table' | 'available' | 'on_break';
  assignedTableId?: string;
  photoURL?: string;
}

// 근무기록 데이터 구조 (기존 QR 출퇴근과 구분)
export interface WorkLog {
  id?: string;
  eventId: string;
  date: string; // YYYY-MM-DD
  staffId: string;
  staffName: string;
  type: 'schedule' | 'qr'; // 스케줄 기반 vs QR 실제 기록
  scheduledStartTime: string; // 스케줄상 출근시간
  scheduledEndTime: string; // 스케줄상 퇴근시간
  actualStartTime?: string; // QR 실제 출근시간 (옵션)
  actualEndTime?: string; // QR 실제 퇴근시간 (옵션)
  totalWorkMinutes: number; // 총 근무시간 (분)
  totalBreakMinutes: number; // 총 휴식시간 (분)
  tableAssignments: string[]; // 배정된 테이블 목록
  status: 'scheduled' | 'in_progress' | 'completed'; // 상태
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 시간 슬롯 생성 유틸리티 (개선된 버전 사용)
export const generateTimeSlots = utilGenerateTimeSlots;

export const useShiftSchedule = (eventId?: string, date?: string) => {
  const [error, setError] = useState<Error | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validationSettings, setValidationSettings] = useState<ValidationSettings>(
    DEFAULT_VALIDATION_SETTINGS
  );

  // 스케줄 문서 ID 생성
  const scheduleId = eventId && date ? `${eventId}_${date}` : null;
  const documentPath = scheduleId ? `shiftSchedules/${scheduleId}` : '';

  // useFirestoreDocument로 구독
  const {
    data: schedule,
    loading,
    error: hookError,
  } = useFirestoreDocument<Omit<ShiftSchedule, 'id'>>(documentPath, {
    enabled: scheduleId !== null,
    errorOnNotFound: false,
    onSuccess: () => {
      logger.info('스케줄 로드 완료', {
        component: 'useShiftSchedule',
        data: { scheduleId },
      });
    },
    onError: (err) => {
      logger.error('스케줄 구독 실패:', err, {
        component: 'useShiftSchedule',
      });
      setError(err);
    },
  });

  // 새로운 스케줄 생성
  const createSchedule = useCallback(
    async (
      eventId: string,
      date: string,
      timeInterval: number = 30,
      startTime: string = '09:00',
      endTime: string = '18:00'
    ) => {
      try {
        const newScheduleId = `${eventId}_${date}`;
        const newSchedule: Omit<ShiftSchedule, 'id'> = {
          eventId,
          date,
          timeInterval,
          startTime,
          endTime,
          scheduleData: {},
          createdAt: serverTimestamp() as Timestamp,
          updatedAt: serverTimestamp() as Timestamp,
        };

        const scheduleRef = doc(db, 'shiftSchedules', newScheduleId);
        await setDoc(scheduleRef, newSchedule);

        return newScheduleId;
      } catch (err) {
        logger.error(
          'Error creating schedule:',
          err instanceof Error ? err : new Error(String(err)),
          { component: 'useShiftSchedule' }
        );
        setError(err as Error);
        throw err;
      }
    },
    []
  );

  // 딜러 할당 업데이트
  const updateDealerAssignment = useCallback(
    async (
      staffId: string, // 스태프 ID
      timeSlot: string,
      assignment: string
    ) => {
      if (!scheduleId || !schedule?.scheduleData) return;

      try {
        const scheduleRef = doc(db, 'shiftSchedules', scheduleId);
        const updatePath = `scheduleData.${staffId}.assignments.${timeSlot}`;

        await updateDoc(scheduleRef, {
          [updatePath]: assignment,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        logger.error(
          'Error updating dealer assignment:',
          err instanceof Error ? err : new Error(String(err)),
          { component: 'useShiftSchedule' }
        );
        setError(err as Error);
        throw err;
      }
    },
    [scheduleId, schedule?.scheduleData]
  );

  // 딜러 추가
  const addDealer = useCallback(
    async (staffId: string, staffName: string, startTime: string = '09:00') => {
      if (!scheduleId) return;

      try {
        const scheduleRef = doc(db, 'shiftSchedules', scheduleId);
        const dealerData = {
          staffName,
          startTime,
          assignments: {},
        };

        await updateDoc(scheduleRef, {
          [`scheduleData.${staffId}`]: dealerData,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        logger.error('Error adding dealer:', err instanceof Error ? err : new Error(String(err)), {
          component: 'useShiftSchedule',
        });
        setError(err as Error);
        throw err;
      }
    },
    [scheduleId]
  );

  // 시간 간격 및 시간 범위 업데이트
  const updateScheduleSettings = useCallback(
    async (newInterval?: number, newStartTime?: string, newEndTime?: string) => {
      if (
        !scheduleId ||
        !schedule?.scheduleData ||
        !schedule.timeInterval ||
        !schedule.startTime ||
        !schedule.endTime
      )
        return;

      try {
        const scheduleRef = doc(db, 'shiftSchedules', scheduleId);
        const updates: any = {
          updatedAt: serverTimestamp(),
        };

        // 시간 간격 변경 시 기존 데이터 변환
        if (newInterval && newInterval !== schedule.timeInterval) {
          updates.timeInterval = newInterval;

          // 기존 할당 데이터 변환
          const convertedScheduleData: any = {};
          Object.entries(schedule.scheduleData).forEach(([staffId, dealerData]) => {
            convertedScheduleData[staffId] = {
              ...dealerData,
              assignments: convertAssignmentData(
                dealerData.assignments,
                schedule.timeInterval,
                newInterval,
                newStartTime || schedule.startTime,
                newEndTime || schedule.endTime
              ),
            };
          });
          updates.scheduleData = convertedScheduleData;
        }

        if (newStartTime) updates.startTime = newStartTime;
        if (newEndTime) updates.endTime = newEndTime;

        await updateDoc(scheduleRef, updates);
      } catch (err) {
        logger.error(
          'Error updating schedule settings:',
          err instanceof Error ? err : new Error(String(err)),
          { component: 'useShiftSchedule' }
        );
        setError(err as Error);
        throw err;
      }
    },
    [
      scheduleId,
      schedule?.scheduleData,
      schedule?.timeInterval,
      schedule?.startTime,
      schedule?.endTime,
    ]
  );

  // 시간 슬롯 생성 (메모이제이션)
  const timeSlots = useMemo(() => {
    if (!schedule) return [];
    return generateTimeSlots(schedule.startTime, schedule.endTime, schedule.timeInterval);
  }, [schedule?.startTime, schedule?.endTime, schedule?.timeInterval]);

  // 딜러 목록 (메모이제이션)
  const dealers = useMemo(() => {
    if (!schedule) return [];
    return Object.entries(schedule.scheduleData).map(([id, data]) => ({
      id,
      ...data,
    }));
  }, [schedule?.scheduleData]);

  // 스케줄 검증 함수
  const validateCurrentSchedule = useCallback(() => {
    if (!schedule || !timeSlots.length || !dealers.length) {
      setValidationResult(null);
      return null;
    }

    const dealerSchedules: DealerSchedule[] = dealers.map((dealer) => ({
      id: dealer.id,
      staffName: dealer.staffName,
      startTime: dealer.startTime,
      assignments: dealer.assignments,
    }));

    const result = validateSchedule(dealerSchedules, timeSlots, validationSettings);
    setValidationResult(result);
    return result;
  }, [schedule, timeSlots, dealers, validationSettings]);

  // 검증 설정 업데이트
  const updateValidationSettings = useCallback((newSettings: Partial<ValidationSettings>) => {
    setValidationSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  // 스케줄 변경 시 자동 검증 (메모이제이션)
  const autoValidationResult = useMemo(() => {
    if (!schedule || !timeSlots.length || !dealers.length) return null;

    const dealerSchedules: DealerSchedule[] = dealers.map((dealer) => ({
      id: dealer.id,
      staffName: dealer.staffName,
      startTime: dealer.startTime,
      assignments: dealer.assignments,
    }));

    return validateSchedule(dealerSchedules, timeSlots, validationSettings);
  }, [schedule?.scheduleData, timeSlots, validationSettings]);

  // 자동 검증 결과를 상태에 반영
  useEffect(() => {
    setValidationResult(autoValidationResult);
  }, [autoValidationResult]);

  // 근무기록 자동 생성 함수
  const generateWorkLogs = useCallback(async () => {
    if (!schedule || !eventId || !date) {
      throw new Error('스케줄, 이벤트 ID, 날짜 정보가 필요합니다.');
    }

    try {
      const workLogsCollection = collection(db, 'workLogs');
      const generatedLogs: Omit<WorkLog, 'id'>[] = [];

      // 각 딜러별로 근무기록 생성
      for (const dealer of dealers) {
        const { id: staffId, staffName, startTime: dealerStartTime, assignments } = dealer;

        // 시간 슬롯별 할당 데이터 분석
        let totalWorkMinutes = 0;
        let totalBreakMinutes = 0;
        const tableAssignments: string[] = [];
        let actualStartTime: string | null = null;
        let actualEndTime: string | null = null;

        // 할당된 시간 슬롯들 순회
        timeSlots.forEach((timeSlot) => {
          const assignment = assignments[timeSlot];
          if (assignment && assignment !== '대기') {
            if (!actualStartTime) actualStartTime = timeSlot;
            actualEndTime = timeSlot;

            if (assignment === '휴식') {
              totalBreakMinutes += schedule.timeInterval;
            } else if (assignment.startsWith('T') || assignment.startsWith('Table')) {
              totalWorkMinutes += schedule.timeInterval;
              if (!tableAssignments.includes(assignment)) {
                tableAssignments.push(assignment);
              }
            }
          }
        });

        // 스케줄상 시작/종료 시간 계산
        const scheduledStartTime = dealerStartTime;
        const scheduledEndTime = actualEndTime || schedule.endTime;

        const workLog: Omit<WorkLog, 'id'> = {
          eventId,
          date,
          staffId,
          staffName,
          type: 'schedule',
          scheduledStartTime,
          scheduledEndTime,
          totalWorkMinutes,
          totalBreakMinutes,
          tableAssignments,
          status: 'scheduled',
          createdAt: serverTimestamp() as Timestamp,
          updatedAt: serverTimestamp() as Timestamp,
        };

        generatedLogs.push(workLog);
      }

      // Firestore에 일괄 저장
      for (const log of generatedLogs) {
        await addDoc(workLogsCollection, log);
      }

      return generatedLogs;
    } catch (error) {
      logger.error(
        '근무기록 생성 중 오류:',
        error instanceof Error ? error : new Error(String(error)),
        { component: 'useShiftSchedule' }
      );
      throw error;
    }
  }, [schedule, eventId, date, dealers, timeSlots]);

  // 근무기록 존재 여부 확인 함수
  const checkWorkLogsExist = useCallback(async () => {
    if (!eventId || !date) return false;

    try {
      const workLogsQuery = query(
        collection(db, 'workLogs'),
        where('eventId', '==', eventId),
        where('date', '==', date),
        where('type', '==', 'schedule')
      );

      const snapshot = await getDocs(workLogsQuery);
      return !snapshot.empty;
    } catch (error) {
      logger.error(
        '근무기록 확인 중 오류:',
        error instanceof Error ? error : new Error(String(error)),
        { component: 'useShiftSchedule' }
      );
      return false;
    }
  }, [eventId, date]);

  return {
    schedule: schedule ? ({ ...schedule, id: scheduleId || '' } as ShiftSchedule) : null,
    loading,
    error: error || hookError,
    timeSlots,
    dealers,
    validationResult,
    validationSettings,
    createSchedule,
    updateDealerAssignment,
    addDealer,
    updateScheduleSettings,
    validateCurrentSchedule,
    updateValidationSettings,
    generateWorkLogs,
    checkWorkLogsExist,
  };
};

export default useShiftSchedule;
