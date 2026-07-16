import type { JobPostingFormData, JobPostingTemplate } from '@/types';
import { extractTemplateData, templateToDraft } from '@/types/jobTemplate';
import { INITIAL_JOB_POSTING_FORM_DATA } from '@/types/jobPostingForm';
import type { DateSpecificRequirement } from '@/types/jobPosting/dateRequirement';
import { shouldPreserveNonFixedDraftRoles } from '@/utils/job-posting/draftRoles';
// S4(레거시 은퇴): templateToFormData(폼 읽기 방향) 제거 후, 라이브 로드 렌즈는 templateToDraft + draftToValues.
import { draftToValues } from '@/utils/order-sheet/mappers';

function createDateRequirement(date: string): DateSpecificRequirement {
  return {
    date,
    timeSlots: [
      {
        id: `slot-${date}`,
        startTime: '18:00',
        roles: [
          {
            id: `dealer-${date}`,
            role: 'dealer',
            headcount: 2,
            salary: { type: 'hourly', amount: 13000 },
          },
          {
            id: `custom-${date}`,
            role: 'other',
            customRole: '조명',
            headcount: 1,
            salary: { type: 'daily', amount: 90000 },
          },
        ],
      },
    ],
  };
}

function createFormData(overrides: Partial<JobPostingFormData> = {}): JobPostingFormData {
  return {
    ...INITIAL_JOB_POSTING_FORM_DATA,
    postingType: 'regular',
    title: 'Template Draft',
    location: {
      name: 'Seoul Gangnam',
      address: 'Teheran-ro',
    },
    dateSpecificRequirements: [createDateRequirement('2026-03-28')],
    roles: [
      {
        name: '딜러',
        count: 2,
        salary: { type: 'hourly', amount: 13000 },
      },
      {
        name: '조명',
        count: 1,
        isCustom: true,
        salary: { type: 'daily', amount: 90000 },
      },
    ],
    useSameSalary: false,
    ...overrides,
  };
}

function createTemplate(formData: JobPostingFormData): JobPostingTemplate {
  return {
    id: 'template-1',
    userId: 'user-1',
    name: 'Dated Template',
    createdAt: '2026-04-18T00:00:00Z',
    updatedAt: '2026-04-18T00:00:00Z',
    usageCount: 0,
    templateData: extractTemplateData(formData),
  };
}

describe('draft role helpers', () => {
  // S4 이주: 구 templateToFormData(폼) 렌즈 → templateToDraft + draftToValues(라이브 로드) 렌즈.
  // 고정 계약(템플릿 로드 역할 보존)을 shouldPreserveNonFixedDraftRoles 불리언 대신 실제 노출 역할로 어서션(판별력 강화).
  it('preserves template-loaded non-fixed roles before dates are re-added', () => {
    const values = draftToValues(templateToDraft(createTemplate(createFormData())));

    expect(values.scheduleGroups?.[0]?.timeSlots[0]?.roles).toMatchObject([
      { role: 'dealer', count: 2 },
      { role: 'other', customRole: '조명', count: 1 },
    ]);
  });

  it('preserves standard-role templates even when counts and salary are default values', () => {
    const values = draftToValues(
      templateToDraft(
        createTemplate(
          createFormData({
            dateSpecificRequirements: [
              {
                date: '2026-04-02',
                timeSlots: [
                  {
                    id: 'slot-standard',
                    startTime: '15:00',
                    roles: [
                      { id: 'dealer-standard', role: 'dealer', headcount: 1 },
                      { id: 'floor-standard', role: 'floor', headcount: 1 },
                    ],
                  },
                ],
              },
            ],
            roles: [
              { name: '딜러', count: 1, isCustom: false },
              { name: '플로어', count: 1, isCustom: false },
            ],
          })
        )
      )
    );

    // 기본값(count 1·급여 없음) 표준 역할도 로드 시 시드 슬롯에 보존된다.
    expect(values.scheduleGroups?.[0]?.timeSlots[0]?.roles).toMatchObject([
      { role: 'dealer', count: 1 },
      { role: 'floor', count: 1 },
    ]);
  });

  // 빈 draft 미보존 — templateToFormData 를 쓰지 않는 순수 shouldPreserveNonFixedDraftRoles 단위 테스트라 이주 대상 아님(존치).
  it('does not preserve a blank non-fixed draft without template seed slots', () => {
    expect(
      shouldPreserveNonFixedDraftRoles({
        postingType: 'regular',
        dateSpecificRequirements: [],
        datedTemplateTimeSlots: [],
      })
    ).toBe(false);
  });

  it('seeds new dated slots from the loaded template time slots', () => {
    const values = draftToValues(templateToDraft(createTemplate(createFormData())));

    // 로드된 템플릿 시간대에서 시드 슬롯이 재생성된다(단일 슬롯·18:00·역할·급여 보존).
    expect(values.scheduleGroups?.[0]?.timeSlots).toHaveLength(1);
    expect(values.scheduleGroups?.[0]?.timeSlots[0]?.startTime).toBe('18:00');
    expect(values.scheduleGroups?.[0]?.timeSlots[0]?.roles).toMatchObject([
      { role: 'dealer', count: 2 },
      { role: 'other', customRole: '조명', count: 1 },
    ]);
    expect(values.roleSalaries).toMatchObject([
      { role: 'dealer', salary: { type: 'hourly', amount: 13000 } },
      { role: 'other', customRole: '조명', salary: { type: 'daily', amount: 90000 } },
    ]);
  });
});
