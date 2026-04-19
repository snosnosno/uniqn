/**
 * UNIQN Mobile - Legal Document Types
 *
 * @description 약관/정책 문서의 구조화 타입. 회원가입 모달과 설정 화면이
 *              동일한 데이터를 다른 형태로 렌더링하기 위한 단일 소스.
 */

export interface LegalSection {
  /** 조항 제목 (예: "제1조 (목적)") */
  title: string;
  /** 조항 본문. 줄바꿈은 `\n`으로 표기. */
  body: string;
}

export interface LegalDocument {
  /** 문서명 (화면 상단 타이틀) */
  title: string;
  /** 버전 (예: "1.1") */
  version: string;
  /** ISO 형식 공고일 (예: "2026-04-10") */
  publishDate: string;
  /** ISO 형식 시행일 (예: "2026-04-10") */
  effectiveDate: string;
  /** 본문 시작 전 안내 문단 (선택) */
  prologue?: string;
  /** 조항 목록 */
  sections: LegalSection[];
  /** 본문 끝 강조 문단 (선택) */
  epilogue?: string;
}

const KOREAN_DATE_FORMAT = (iso: string): string => {
  const [year, month, day] = iso.split('-');
  return `${year}년 ${parseInt(month, 10)}월 ${parseInt(day, 10)}일`;
};

/**
 * 회원가입 SheetModal에서 보여줄 plain-text 형태로 변환.
 * 설정 화면은 SECTIONS를 직접 .map()으로 렌더링하지만,
 * 회원가입 모달은 단일 Text 컴포넌트라 string 필요.
 */
export function toPlainText(doc: LegalDocument): string {
  const parts: string[] = [doc.title, ''];

  if (doc.prologue) {
    parts.push(doc.prologue, '');
  }

  for (const section of doc.sections) {
    parts.push(section.title);
    parts.push(section.body);
    parts.push('');
  }

  if (doc.epilogue) {
    parts.push(doc.epilogue, '');
  }

  parts.push('부칙');
  parts.push(`- 공고일: ${KOREAN_DATE_FORMAT(doc.publishDate)}`);
  parts.push(`- 시행일: ${KOREAN_DATE_FORMAT(doc.effectiveDate)}`);
  parts.push(`- 버전: ${doc.version}`);

  return parts.join('\n');
}

/**
 * 한글 표기용 날짜 포맷 헬퍼 (외부에서 부칙 라벨에 사용).
 */
export function formatKoreanDate(iso: string): string {
  return KOREAN_DATE_FORMAT(iso);
}
