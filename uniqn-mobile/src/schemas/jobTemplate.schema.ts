/**
 * 공고 프리셋(템플릿) 이름 스키마 — 저장·이름변경 양쪽이 소비하는 단일 진실원(SSOT).
 *
 * 저장 경로는 원래 무검증(빈 문자열만 걸렀다)이었고 이름변경은 존재하지도 않았다.
 * 한쪽에만 검증을 붙이면 "저장은 되는데 이름변경은 거부되는" 축 분기가 생긴다 —
 * 같은 판정이 여러 곳에 복제돼 서로 어긋났던 선례(정산 게이트 status 축)와 동형이다.
 * 그래서 스키마와 중복 판정·회피 이름 제안을 모두 여기 한 곳에 둔다.
 */
import { z } from 'zod';
import { xssValidation } from '@/utils/security';

/** 이름 길이 경계. TemplateModal TextInput 의 maxLength 와 같은 값이어야 한다. */
export const TEMPLATE_NAME_MIN_LENGTH = 2;
export const TEMPLATE_NAME_MAX_LENGTH = 50;

/** 프리셋 이름 — trim 후 2~50자 + XSS 차단. safeParse 결과 data 는 이미 trim 된 값이다. */
export const templateNameSchema = z
  .string()
  .trim()
  .min(TEMPLATE_NAME_MIN_LENGTH, `프리셋 이름은 ${TEMPLATE_NAME_MIN_LENGTH}자 이상 입력해주세요`)
  .max(TEMPLATE_NAME_MAX_LENGTH, `프리셋 이름은 ${TEMPLATE_NAME_MAX_LENGTH}자 이내로 입력해주세요`)
  .refine(xssValidation, { message: '이름에 사용할 수 없는 문자가 있습니다' });

/** 중복 판정에 필요한 최소 형상 — JobPostingTemplate 전체를 요구하지 않아 테스트가 가볍다. */
export interface TemplateNameCandidate {
  id: string;
  name: string;
}

/** 이름 비교 정규화 — 앞뒤 공백·대소문자 무시(사장이 보기에 같은 이름이면 같은 이름이다). */
function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * 같은 이름이 이미 있는지.
 * @param excludeId 이름변경 시 자기 자신(현재 이름 유지 = 중복 아님)
 */
export function isDuplicateTemplateName(
  name: string,
  templates: readonly TemplateNameCandidate[],
  excludeId?: string
): boolean {
  const target = normalizeName(name);
  return templates.some((t) => t.id !== excludeId && normalizeName(t.name) === target);
}

/** 이미 붙어 있는 " (N)" 꼬리 — 제안을 반복해도 "이름 (2) (2)" 가 되지 않게 벗겨낸다. */
const NUMBER_SUFFIX_PATTERN = /\s*\(\d+\)$/;
/** 회피 이름 탐색 상한. 여기까지 전부 막히면 원래 이름을 돌려주고 사용자가 직접 고친다. */
const SUGGEST_MAX_ATTEMPT = 99;

/**
 * 중복이면 "이름 (2)", "이름 (3)" … 으로 비어 있는 첫 이름을 제안한다.
 * 중복이 아니면 trim 한 원래 이름을 그대로 돌려준다.
 *
 * 삭제 UI 가 없던 동안 중복 차단은 곧 "매번 새 이름을 지어내라"였고 이름 공간이 단조 증가했다.
 * 막기만 하지 말고 다음 행동을 손에 쥐여 준다.
 */
export function suggestUniqueTemplateName(
  name: string,
  templates: readonly TemplateNameCandidate[],
  excludeId?: string
): string {
  const trimmed = name.trim();
  if (!isDuplicateTemplateName(trimmed, templates, excludeId)) {
    return trimmed;
  }

  const stripped = trimmed.replace(NUMBER_SUFFIX_PATTERN, '').trim();
  const base = stripped.length > 0 ? stripped : trimmed;

  for (let n = 2; n <= SUGGEST_MAX_ATTEMPT; n += 1) {
    const suffix = ` (${n})`;
    // 상한을 넘기면 저장 단계에서 다시 막힌다 — 꼬리 길이만큼 본문을 줄여 항상 통과시킨다.
    const head = base.slice(0, Math.max(1, TEMPLATE_NAME_MAX_LENGTH - suffix.length)).trim();
    const candidate = `${head}${suffix}`;
    if (!isDuplicateTemplateName(candidate, templates, excludeId)) {
      return candidate;
    }
  }

  return trimmed;
}
