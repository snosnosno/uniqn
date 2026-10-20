#!/usr/bin/env node
/**
 * UNIQN Mobile - public 테이블 명시 GRANT 누락 가드
 *
 * @description Supabase 는 2026-10-30 부터 public 스키마 신규 테이블에 Data API 권한
 *   (anon/authenticated/service_role GRANT)을 자동 부여하지 않는다. preview branch ·
 *   로컬 `supabase db reset` · 신규 프로젝트처럼 마이그를 처음부터 재실행하는 환경도
 *   "신규 생성"이라, GRANT 없는 테이블은 supabase-js/PostgREST 에서
 *   "permission denied" 로 죽는다.
 *
 * 규칙: supabase/migrations/*.sql 에서 `CREATE TABLE public.x` 한 테이블은
 *   반드시 `GRANT ... ON [TABLE] ...x... TO ...service_role` 를 가져야 한다.
 *   - CUTOFF 이후 파일: **같은 마이그 파일 안에** 있어야 한다(Supabase 권고와 동일).
 *   - CUTOFF 이하 파일: 어느 마이그에 있든 인정(기존 테이블은 백필 마이그로 보강).
 *   service_role 을 기준으로 삼는 이유: deny-all 테이블도 EF 는 service_role 로 접근하므로
 *   모든 테이블이 최소한 이것만은 가져야 하고, "GRANT 를 생각했다"는 표지가 된다.
 *   anon/authenticated 부여 여부는 테이블별 설계라 이 스크립트가 강제하지 않는다.
 *
 * 왜 pgTAP 이 아닌가: 테스트 픽스처(jpc_helpers.sql)가 마이그 뒤에
 *   `GRANT ALL ON ALL TABLES` 를 실행하고, baseline 의 ALTER DEFAULT PRIVILEGES 도
 *   재실행 시 자동 부여를 되살리므로, DB 상태 단언은 항상 통과한다(공허한 검증).
 *   마이그 **소스**를 대조해야 잡힌다.
 *
 * 한계(의도적): DO 블록 안 동적 SQL(EXECUTE format(...)) 로 만든 테이블·GRANT 는 못 본다.
 *
 * 사용: node scripts/check-table-grants.js
 */

const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'supabase', 'migrations');
// 이 파일명(타임스탬프) 이후 마이그는 같은 파일 안에 GRANT 가 있어야 한다.
const CUTOFF = '20261020120000';

const CREATE_TABLE_RE =
  /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\."?([a-z_][a-z0-9_]*)"?\s*\(/gi;
const DROP_TABLE_RE = /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?public\."?([a-z_][a-z0-9_]*)"?/gi;
// GRANT <privs [(cols)]> ON [TABLE] a, public.b TO r1, r2;  — 함수·시퀀스·스키마 GRANT 는 제외.
const GRANT_RE =
  /\bGRANT\s+[^;]*?\bON\s+(?!FUNCTION\b|SEQUENCE\b|SCHEMA\b|ALL\b)(?:TABLE\s+)?([^;]*?)\s+TO\s+([^;]*?);/gi;

/** 주석을 지워 주석 속 예시 SQL 을 정의로 오인하지 않게 한다. */
function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
}

function main() {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  /** table -> { file } (마지막 CREATE 기준) */
  const created = new Map();
  /** table -> Set<file> (service_role GRANT 가 있는 파일) */
  const granted = new Map();
  const dropped = new Set();

  for (const file of files) {
    const sql = stripComments(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));

    for (const m of sql.matchAll(CREATE_TABLE_RE)) {
      const table = m[1].toLowerCase();
      created.set(table, file);
      dropped.delete(table);
    }
    for (const m of sql.matchAll(DROP_TABLE_RE)) {
      dropped.add(m[1].toLowerCase());
    }
    for (const m of sql.matchAll(GRANT_RE)) {
      if (!/\bservice_role\b/i.test(m[2])) {
        continue;
      }
      for (const raw of m[1].split(',')) {
        const table = raw
          .trim()
          .replace(/^public\./i, '')
          .replace(/"/g, '')
          .toLowerCase();
        if (!granted.has(table)) {
          granted.set(table, new Set());
        }
        granted.get(table).add(file);
      }
    }
  }

  const violations = [];
  for (const [table, file] of created) {
    if (dropped.has(table)) {
      continue;
    }
    const grantFiles = granted.get(table) ?? new Set();
    const needsSameFile = file.slice(0, CUTOFF.length) > CUTOFF;
    const ok = needsSameFile ? grantFiles.has(file) : grantFiles.size > 0;
    if (!ok) {
      violations.push({ table, file, needsSameFile });
    }
  }

  if (violations.length === 0) {
    console.log(
      `✅ public 테이블 ${created.size - dropped.size}개 모두 service_role 명시 GRANT 보유`
    );
    return;
  }

  console.error(
    '❌ 명시 GRANT 가 없는 public 테이블 (Supabase 2026-10-30 이후 permission denied):'
  );
  for (const v of violations) {
    const where = v.needsSameFile ? '같은 마이그 파일 안에' : '마이그 어딘가에';
    console.error(`  - public.${v.table}  (${v.file}) → ${where} GRANT 추가 필요`);
  }
  console.error(
    '\n예) GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.<t> TO authenticated;\n' +
      '    GRANT ALL ON TABLE public.<t> TO service_role;\n' +
      '    (anon 은 공개 읽기가 필요할 때만)'
  );
  process.exit(1);
}

main();
