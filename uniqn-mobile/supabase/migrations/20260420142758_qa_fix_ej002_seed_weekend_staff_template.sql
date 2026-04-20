-- Phase 3 EJ-002: HANDOFF 시나리오 4 "주말 스태프 모집 템플릿" seed
-- employer b2222222 (심사용 구인자) 소유 템플릿
INSERT INTO public.job_posting_templates (user_id, name, description, template_data, usage_count)
VALUES (
  'b2222222-2222-4222-b222-222222222222',
  '주말 스태프 모집 템플릿',
  '주말 포커룸 딜러/플로어 모집에 사용하는 기본 템플릿입니다. 날짜만 추가해 바로 게시하세요.',
  jsonb_build_object(
    'postingType', 'regular',
    'title', '주말 포커룸 스태프',
    'description', '주말 스태프 구합니다. 딜러 1명, 플로어 1명. 18:00~23:00 근무.',
    'contactPhone', '010-5550-0002',
    'tags', '[]'::jsonb,
    'roleCatalog', jsonb_build_array(
      jsonb_build_object('role','dealer','salary', jsonb_build_object('type','daily','amount',180000)),
      jsonb_build_object('role','floor','salary', jsonb_build_object('type','daily','amount',180000))
    ),
    'compensation', jsonb_build_object(
      'mode','by_role',
      'allowances', '{}'::jsonb,
      'defaultSalary', jsonb_build_object('type','daily','amount',0)
    ),
    'questions', '[]'::jsonb,
    'schedule', jsonb_build_object(
      'kind','dated',
      'primaryDate','',
      'allDates', '[]'::jsonb,
      'requirements', '[]'::jsonb,
      'templateTimeSlots', '[]'::jsonb
    )
  ),
  0
);
