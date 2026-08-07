/**
 * 마이그레이션 SQL 에서 "DB 가 실제로 INSERT 하는 알림 type" 을 정적으로 추출한다.
 *
 * @description
 * 기존 드리프트 가드(typeCategoryMapDrift.test.ts)는 클라 SSOT ↔ EF 사본의 일치만 본다.
 * 둘 다 DB 와 어긋나 있어도 "정합"으로 판정한다 — 실제로 그렇게 4종이 새어 나갔다
 * (work_log_check_in/out · job_posting_collaborator_added/removed, 2026-08-07 발견).
 * 이 모듈은 그 세 번째 축(DB 발송 타입)을 레포 파일에서 뽑아낸다.
 *
 * ⚠️ 이 추출기는 그 자체가 테스트 대상이다 — extractDbNotificationTypes.test.ts 참조.
 *    테스트 본문에 인라인으로 두면 파싱 규칙이 영원히 검증되지 않는다.
 */

import fs from 'fs';
import path from 'path';

export interface ExtractResult {
  /** 재생 후 살아있는 함수 본문에서 얻은 알림 type 리터럴 */
  types: Set<string>;
  /** 리터럴로 해소하지 못한 표현식 — 테스트가 이것을 [] 로 단언해 '빈 통과'를 막는다 */
  unresolved: string[];
  /** 재생 후 살아있는 함수 수 — prod pg_proc 카운트와의 교차검증 신호 */
  liveFunctionCount: number;
}

interface FunctionDef {
  key: string;
  body: string;
}

/** `CREATE [OR REPLACE] FUNCTION` / `DROP FUNCTION [IF EXISTS]` 를 등장 순서대로 훑는다. */
const STATEMENT_RE =
  /\b(CREATE(?:\s+OR\s+REPLACE)?|DROP)\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?((?:[A-Za-z_][\w$]*|"[^"]+")\s*\.\s*)?([A-Za-z_][\w$]*|"[^"]+")\s*\(/gi;

/**
 * `start` 가 여는 괄호를 가리킬 때, 문자열·달러인용을 존중하며 짝 괄호 위치를 돌려준다.
 * `[^)]*` 로 대신하면 `DEFAULT now()` 같은 중첩 호출에서 끊긴다(실재: 20260727160000).
 */
function matchParen(sql: string, start: number): number {
  let depth = 0;
  for (let i = start; i < sql.length; i += 1) {
    const ch = sql[i];
    if (ch === "'") {
      i = skipSingleQuoted(sql, i);
      continue;
    }
    if (ch === '$') {
      const tag = readDollarTag(sql, i);
      if (tag) {
        const end = sql.indexOf(tag, i + tag.length);
        i = end === -1 ? sql.length : end + tag.length - 1;
        continue;
      }
    }
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** 여는 따옴표 위치를 받아 닫는 따옴표 위치를 돌려준다(`''` 이스케이프 처리). */
function skipSingleQuoted(sql: string, openIdx: number): number {
  let i = openIdx + 1;
  while (i < sql.length) {
    if (sql[i] === "'") {
      if (sql[i + 1] === "'") {
        i += 2;
        continue;
      }
      return i;
    }
    i += 1;
  }
  return sql.length;
}

/** `$$` · `$function$` 등 달러 인용 태그를 읽는다. 아니면 null. */
function readDollarTag(sql: string, idx: number): string | null {
  const m = /^\$[A-Za-z_]*\$/.exec(sql.slice(idx, idx + 40));
  return m ? m[0] : null;
}

/** 인자 목록 문자열에서 최상위 콤마를 세어 arity 를 구한다. */
function countArity(argList: string): number {
  const trimmed = argList.trim();
  if (!trimmed) return 0;
  let depth = 0;
  let count = 1;
  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i];
    if (ch === "'") {
      i = skipSingleQuoted(trimmed, i);
      continue;
    }
    if (ch === '(' || ch === '[') depth += 1;
    else if (ch === ')' || ch === ']') depth -= 1;
    else if (ch === ',' && depth === 0) count += 1;
  }
  return count;
}

function normalizeIdent(raw: string | undefined, fallback: string): string {
  const v = (raw ?? fallback).trim().replace(/\s*\.\s*$/, '');
  return v.replace(/^"|"$/g, '').toLowerCase();
}

/** 최상위 콤마로 자른다(괄호·문자열·달러인용 존중). */
function splitTopLevel(expr: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < expr.length; i += 1) {
    const ch = expr[i];
    if (ch === "'") {
      i = skipSingleQuoted(expr, i);
      continue;
    }
    if (ch === '$') {
      const tag = readDollarTag(expr, i);
      if (tag) {
        const end = expr.indexOf(tag, i + tag.length);
        i = end === -1 ? expr.length : end + tag.length - 1;
        continue;
      }
    }
    if (ch === '(' || ch === '[') depth += 1;
    else if (ch === ')' || ch === ']') depth -= 1;
    else if (ch === ',' && depth === 0) {
      parts.push(expr.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(expr.slice(start));
  return parts.map((p) => p.trim());
}

/** 표현식 안의 모든 문자열 리터럴을 모은다(CASE 식이면 분기별 리터럴이 전부 잡힌다). */
function collectLiterals(expr: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < expr.length; i += 1) {
    if (expr[i] === "'") {
      const end = skipSingleQuoted(expr, i);
      out.push(expr.slice(i + 1, end).replace(/''/g, "'"));
      i = end;
    }
  }
  return out;
}

/** 알림 타입으로 볼 수 있는 형태만 남긴다(`::text` 캐스트·포맷 문자열 등 노이즈 제거). */
function looksLikeNotificationType(value: string): boolean {
  return /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(value);
}

/**
 * plpgsql 변수 / CTE 별칭을 리터럴로 역추적한다.
 * 이게 없으면 6종(job_updated·job_closed·review_reminder 등)을 통째로 놓친다.
 */
function backtraceIdentifier(body: string, ident: string): string[] {
  const out: string[] = [];
  const varRe = new RegExp(`\\b${ident}\\s*:?=\\s*'([^']*)'`, 'gi');
  let m = varRe.exec(body);
  while (m) {
    out.push(m[1]);
    m = varRe.exec(body);
  }
  const aliasRe = new RegExp(`'([^']*)'(?:::[\\w.]+)?\\s+AS\\s+${ident}\\b`, 'gi');
  m = aliasRe.exec(body);
  while (m) {
    out.push(m[1]);
    m = aliasRe.exec(body);
  }
  return out;
}

/** 함수 본문에서 notifications INSERT 의 type 값을 뽑는다. */
function scanBody(body: string, types: Set<string>, unresolved: string[], label: string): void {
  const insertRe = /INSERT\s+INTO\s+(?:public\s*\.\s*)?notifications\s*\(/gi;
  let ins = insertRe.exec(body);
  while (ins) {
    const colOpen = body.indexOf('(', ins.index + ins[0].length - 1);
    const colClose = matchParen(body, colOpen);
    if (colClose === -1) break;

    const columns = splitTopLevel(body.slice(colOpen + 1, colClose)).map((c) =>
      c.replace(/^"|"$/g, '').toLowerCase()
    );
    const typeIdx = columns.indexOf('type');
    if (typeIdx === -1) {
      insertRe.lastIndex = colClose;
      ins = insertRe.exec(body);
      continue;
    }

    // VALUES 튜플 / SELECT 목록 두 형태를 모두 받는다.
    const tail = body.slice(colClose + 1);
    const valuesM = /^\s*VALUES\s*\(/i.exec(tail);
    const exprs: string[] = [];
    if (valuesM) {
      const tupleOpen = colClose + 1 + valuesM[0].length - 1;
      const tupleClose = matchParen(body, tupleOpen);
      if (tupleClose !== -1) {
        exprs.push(...splitTopLevel(body.slice(tupleOpen + 1, tupleClose)));
      }
    } else {
      const selM = /^\s*SELECT\s/i.exec(tail);
      if (selM) {
        const listStart = colClose + 1 + selM[0].length;
        const fromIdx = findTopLevelKeyword(body, listStart, 'FROM');
        exprs.push(...splitTopLevel(body.slice(listStart, fromIdx === -1 ? body.length : fromIdx)));
      }
    }

    const raw = exprs[typeIdx];
    if (raw === undefined) {
      unresolved.push(`${label}: type 위치(${typeIdx}) 표현식을 찾지 못함`);
    } else {
      const found = collectLiterals(raw).filter(looksLikeNotificationType);
      if (found.length > 0) {
        found.forEach((t) => types.add(t));
      } else {
        // 리터럴이 없다 = 변수/별칭이다. 역추적한다.
        const identM = /^([A-Za-z_][\w$]*)/.exec(raw.trim());
        const traced = identM
          ? backtraceIdentifier(body, identM[1]).filter(looksLikeNotificationType)
          : [];
        if (traced.length > 0) {
          traced.forEach((t) => types.add(t));
        } else {
          unresolved.push(
            `${label}: type 표현식을 리터럴로 해소 실패 — ${raw.trim().slice(0, 80)}`
          );
        }
      }
    }

    insertRe.lastIndex = colClose;
    ins = insertRe.exec(body);
  }
}

/** `FROM` 처럼 최상위(괄호 밖)에 있는 키워드 위치를 찾는다. */
function findTopLevelKeyword(sql: string, from: number, keyword: string): number {
  let depth = 0;
  const kw = keyword.toUpperCase();
  for (let i = from; i < sql.length; i += 1) {
    const ch = sql[i];
    if (ch === "'") {
      i = skipSingleQuoted(sql, i);
      continue;
    }
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      if (depth === 0) return i;
      depth -= 1;
    } else if (depth === 0 && sql.slice(i, i + kw.length).toUpperCase() === kw) {
      const before = sql[i - 1];
      const after = sql[i + kw.length];
      if (!/[\w$]/.test(before ?? ' ') && !/[\w$]/.test(after ?? ' ')) return i;
    }
  }
  return -1;
}

/**
 * 마이그레이션 디렉터리를 타임스탬프 순으로 재생해 살아있는 함수 정의를 구한 뒤,
 * 그 본문에서 알림 type 리터럴을 추출한다.
 *
 * ⚠️ `archive/` 는 제외한다 — 재실행되지 않는 보존용이라 정의 소스가 아니다
 *    (scripts/check-rpc-migrations.js 와 같은 규약).
 */
export function extractDbNotificationTypes(migrationsDir: string): ExtractResult {
  const files = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.sql'))
    .map((d) => d.name)
    .sort();

  const live = new Map<string, FunctionDef>();

  for (const name of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, name), 'utf8');
    STATEMENT_RE.lastIndex = 0;
    let m = STATEMENT_RE.exec(sql);
    while (m) {
      const verb = m[1].toUpperCase().startsWith('DROP') ? 'DROP' : 'CREATE';
      const schema = normalizeIdent(m[2], 'public');
      const fnName = normalizeIdent(m[3], '');
      const argOpen = m.index + m[0].length - 1;
      const argClose = matchParen(sql, argOpen);
      if (argClose === -1) break;
      const key = `${schema}.${fnName}/${countArity(sql.slice(argOpen + 1, argClose))}`;

      if (verb === 'DROP') {
        live.delete(key);
        STATEMENT_RE.lastIndex = argClose;
      } else {
        // 본문은 `AS $tag$ … $tag$` 안에 있다. 없으면 SQL 언어 함수 — 본문 없이 넘긴다.
        const afterArgs = sql.slice(argClose + 1, argClose + 4000);
        const tagM = /\bAS\s+(\$[A-Za-z_]*\$)/i.exec(afterArgs);
        if (tagM) {
          const tag = tagM[1];
          const bodyStart = argClose + 1 + tagM.index + tagM[0].length;
          const bodyEnd = sql.indexOf(tag, bodyStart);
          const body = bodyEnd === -1 ? sql.slice(bodyStart) : sql.slice(bodyStart, bodyEnd);
          live.set(key, { key, body });
          STATEMENT_RE.lastIndex = bodyEnd === -1 ? sql.length : bodyEnd + tag.length;
        } else {
          live.set(key, { key, body: '' });
          STATEMENT_RE.lastIndex = argClose;
        }
      }
      m = STATEMENT_RE.exec(sql);
    }
  }

  const types = new Set<string>();
  const unresolved: string[] = [];
  for (const fn of live.values()) {
    if (fn.body) scanBody(fn.body, types, unresolved, fn.key);
  }

  return { types, unresolved, liveFunctionCount: live.size };
}
