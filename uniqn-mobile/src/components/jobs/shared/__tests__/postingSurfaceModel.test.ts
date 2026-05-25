import { buildPostingScheduleModel } from '@/components/jobs/shared/postingSurfaceModel';

describe('buildPostingScheduleModel fixed (통일 구조)', () => {
  it('scheduleDisplay.fixed.roles 에서 fixed 모델을 빌드한다', () => {
    const source = {
      workflow: { isFixed: true, usesGroupedDateRanges: false },
      scheduleDisplay: {
        variant: 'fixed' as const,
        dateRequirements: [],
        dateGroups: [],
        workDate: '',
        timeSlot: '19:00',
        fixed: {
          daysPerWeek: 5,
          startTime: '19:00',
          isStartTimeNegotiable: false,
          roles: [
            { role: 'dealer', count: 3, filled: 1 },
            { role: 'floor', count: 2, filled: 0 },
            { role: 'other', customRole: 'VIP 호스트', count: 1, filled: 0 },
          ],
        },
      },
    };

    const model = buildPostingScheduleModel(source);

    expect(model.variant).toBe('fixed');
    if (model.variant === 'fixed') {
      expect(model.fixed.daysLabel).toBe('주 5일');
      expect(model.fixed.timeLabel).toBe('19:00');
      expect(model.fixed.totalCount).toBe(6);
      expect(model.fixed.filledCount).toBe(1);
      expect(model.fixed.roles).toHaveLength(3);

      const dealerRole = model.fixed.roles[0];
      expect(dealerRole.label).toBe('딜러');
      expect(dealerRole.count).toBe(3);
      expect(dealerRole.filled).toBe(1);
      expect(dealerRole.isFilled).toBe(false);

      const floorRole = model.fixed.roles[1];
      expect(floorRole.label).toBe('플로어');
      expect(floorRole.count).toBe(2);
      expect(floorRole.filled).toBe(0);
      expect(floorRole.isFilled).toBe(false);

      // other 역할은 customRole 을 표시명으로 사용 (getRoleDisplayName)
      const customRole = model.fixed.roles[2];
      expect(customRole.label).toBe('VIP 호스트');
      expect(customRole.count).toBe(1);
      expect(customRole.filled).toBe(0);
    }
  });

  it('scheduleDisplay.fixed.roles 가 없으면 requiredRolesWithCount 로 폴백한다', () => {
    const source = {
      workflow: { isFixed: true, usesGroupedDateRanges: false },
      scheduleDisplay: {
        variant: 'fixed' as const,
        dateRequirements: [],
        dateGroups: [],
        workDate: '',
        timeSlot: '',
        fixed: {
          daysPerWeek: 3,
          startTime: '10:00',
          isStartTimeNegotiable: false,
          // roles 없음 — requiredRolesWithCount 폴백 경로
        },
      },
      requiredRolesWithCount: [{ role: 'serving', count: 4, filled: 2 }],
    };

    const model = buildPostingScheduleModel(source);

    expect(model.variant).toBe('fixed');
    if (model.variant === 'fixed') {
      expect(model.fixed.roles).toHaveLength(1);
      expect(model.fixed.roles[0].count).toBe(4);
      expect(model.fixed.roles[0].filled).toBe(2);
      expect(model.fixed.totalCount).toBe(4);
      // 폴백 경로에서도 filled 가 모델로 전달되는지 고정
      expect(model.fixed.filledCount).toBe(2);
    }
  });

  it('daysPerWeek 미정 시 daysLabel = 협의', () => {
    const source = {
      workflow: { isFixed: true, usesGroupedDateRanges: false },
      scheduleDisplay: {
        variant: 'fixed' as const,
        dateRequirements: [],
        dateGroups: [],
        workDate: '',
        timeSlot: '',
        fixed: {
          // daysPerWeek 없음
          startTime: '09:00',
          isStartTimeNegotiable: false,
          roles: [],
        },
      },
    };

    const model = buildPostingScheduleModel(source);

    expect(model.variant).toBe('fixed');
    if (model.variant === 'fixed') {
      expect(model.fixed.daysLabel).toBe('협의');
      expect(model.isPartial).toBe(true);
      // 빈 roles 경계: 합계는 0
      expect(model.fixed.roles).toHaveLength(0);
      expect(model.fixed.totalCount).toBe(0);
      expect(model.fixed.filledCount).toBe(0);
    }
  });

  it('isStartTimeNegotiable = true 시 timeLabel = 협의', () => {
    const source = {
      workflow: { isFixed: true, usesGroupedDateRanges: false },
      scheduleDisplay: {
        variant: 'fixed' as const,
        dateRequirements: [],
        dateGroups: [],
        workDate: '',
        timeSlot: '',
        fixed: {
          daysPerWeek: 4,
          startTime: '09:00',
          isStartTimeNegotiable: true,
          roles: [{ role: 'dealer', count: 2, filled: 2 }],
        },
      },
    };

    const model = buildPostingScheduleModel(source);

    expect(model.variant).toBe('fixed');
    if (model.variant === 'fixed') {
      expect(model.fixed.timeLabel).toBe('협의');
      expect(model.isPartial).toBe(true);
      // isFilled: count=2, filled=2 → true
      expect(model.fixed.roles[0].isFilled).toBe(true);
    }
  });
});
