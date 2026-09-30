#!/usr/bin/env node
/**
 * ops-web 로컬 시드 실행기 — `npm run seed:local`.
 *
 * 🔒 로컬 전용이 **구조로** 보장된다: 접속 문자열을 받지 않고, 로컬 Supabase 가 띄운
 *    Docker 컨테이너(`supabase_db_<project_id>`) 안의 psql 에 SQL 을 흘려 넣을 뿐이다.
 *    prod 로 향할 경로 자체가 없다.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTAINER = 'supabase_db_uniqn'; // uniqn-mobile/supabase/config.toml project_id = "uniqn"
// 순서 중요: 계정(멱등 초기화) → 대회 데이터(없을 때만 생성)
const FILES = ['seed-local-ops.sql', 'seed-local-ops-data.sql'];

for (const file of FILES) {
  const sql = fs.readFileSync(path.join(here, file), 'utf8');
  const result = spawnSync(
    'docker',
    // -o /dev/null: set_config 등 SELECT 결과 출력을 버린다(에러는 stderr 로 그대로 나온다).
    [
      'exec',
      '-i',
      CONTAINER,
      'psql',
      '-U',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-q',
      '-o',
      '/dev/null',
    ],
    { input: sql, encoding: 'utf8' }
  );
  if (result.error || result.status !== 0) {
    process.stderr.write(
      `✖ ${file} 실패 — 로컬 Supabase 가 떠 있는지 확인하세요(uniqn-mobile 에서 npx supabase start).\n${
        result.stderr || result.error?.message || ''
      }\n`
    );
    process.exit(1);
  }
  process.stdout.write(`✔ ${file}\n`);
}
