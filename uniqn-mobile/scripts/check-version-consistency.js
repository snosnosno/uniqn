#!/usr/bin/env node
/**
 * UNIQN Mobile - 빌드 전 버전 일관성 가드
 *
 * @description `release:build` 직전 자동 실행. 흔한 릴리스 실수를 빌드 전에 잡는다.
 *   1) package.json version 이 정상 semver 인지
 *   2) app.config.ts 가 버전을 하드코딩하지 않고 package.json 단일 소스를 읽는지
 *   3) 빌드 버전이 Supabase app_config.latest_version 보다 높은지
 *      (같거나 낮으면 = 버전 안 올리고 빌드 → "버전 안 올림" 최다 실수 차단)
 *
 * 읽기 전용 체크라 anon key 만 필요 (app_config SELECT 는 public).
 * 필수 env: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY (.env.local 자동 로드)
 * flags: --skip-db (DB 대조 생략 — 오프라인 빌드용), --platform=ios,android
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const projectRoot = path.resolve(__dirname, '..');

function loadEnvLocal() {
  const envPath = path.join(projectRoot, '.env.local');
  if (!fs.existsSync(envPath)) {
    return {};
  }
  const entries = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }
    entries[trimmed.slice(0, separatorIndex).trim()] = trimmed.slice(separatorIndex + 1).trim();
  }
  return entries;
}

function parseArgs(argv) {
  const args = { skipDb: false, platforms: ['ios', 'android'] };
  for (const arg of argv) {
    if (arg === '--skip-db') {
      args.skipDb = true;
    } else if (arg.startsWith('--platform=')) {
      args.platforms = arg
        .slice('--platform='.length)
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
    }
  }
  return args;
}

/**
 * 시맨틱 버전 비교 (순수 함수) — -1: a<b, 0: a===b, 1: a>b
 */
function compareVersions(a, b) {
  const pa = String(a)
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const pb = String(b)
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] || 0) !== (pb[i] || 0)) {
      return (pa[i] || 0) > (pb[i] || 0) ? 1 : -1;
    }
  }
  return 0;
}

/**
 * app.config.ts 가 버전을 하드코딩하지 않고 package.json 을 읽는지 정적 검사 (순수 함수)
 */
function isSingleSourceIntact(appConfigSource) {
  // `const VERSION = '1.2.3'` 같은 따옴표 리터럴 = 하드코딩 회귀
  const hardcoded = /const\s+VERSION\s*=\s*['"`]\d/.test(appConfigSource);
  const readsPackageJson = /package\.json/.test(appConfigSource);
  return !hardcoded && readsPackageJson;
}

/**
 * 빌드 버전이 각 플랫폼 latest_version 보다 높은지 평가 (순수 함수)
 * @returns {{ok: boolean, problems: string[]}}
 */
function evaluateAgainstLatest(buildVersion, latestValue, platforms) {
  const problems = [];
  const value = latestValue || {};
  for (const platform of platforms) {
    const latest = value[platform];
    if (!latest) {
      problems.push(`app_config.latest_version 에 ${platform} 항목 없음`);
      continue;
    }
    if (compareVersions(buildVersion, latest) <= 0) {
      problems.push(
        `${platform}: 빌드 버전 ${buildVersion} 이 latest_version ${latest} 보다 높지 않음 ` +
          `(버전을 안 올렸을 가능성 — npm version 으로 bump 필요)`
      );
    }
  }
  return { ok: problems.length === 0, problems };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fileEnv = loadEnvLocal();

  // 1) semver 유효성
  const { version } = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`package.json version 형식 비정상: ${version}`);
  }
  console.log(`✓ 빌드 버전: ${version}`);

  // 2) 단일 소스 무결성
  const appConfigSource = fs.readFileSync(path.join(projectRoot, 'app.config.ts'), 'utf8');
  if (!isSingleSourceIntact(appConfigSource)) {
    throw new Error(
      'app.config.ts 가 package.json 단일 소스를 읽지 않거나 버전을 하드코딩함 ' +
        '(VERSION 회귀 — package.json 에서 읽도록 복구 필요)'
    );
  }
  console.log('✓ app.config.ts 단일 소스 무결성');

  // 3) DB 대조 (읽기 전용, anon key)
  if (args.skipDb) {
    console.log('⏭  DB 대조 생략 (--skip-db)');
    console.log('\n✅ 버전 일관성 체크 통과 (로컬만)');
    return;
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || fileEnv.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || fileEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY 미설정 ' +
        '(DB 대조 불가 — 오프라인이면 --skip-db)'
    );
  }

  const supabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'latest_version')
    .maybeSingle();

  if (error) {
    // 일시적 DB 오류로 릴리스를 막지는 않되, 크게 경고
    console.warn(`⚠️  app_config 조회 실패 (DB 대조 건너뜀): ${error.message}`);
    console.log('\n✅ 버전 일관성 체크 통과 (DB 대조 미수행)');
    return;
  }

  const result = evaluateAgainstLatest(version, data && data.value, args.platforms);
  if (!result.ok) {
    throw new Error(
      `버전 일관성 실패:\n  - ${result.problems.join('\n  - ')}\n` +
        `해결: 'npm version patch' 로 버전을 올린 뒤 다시 빌드하세요.`
    );
  }
  console.log(`✓ DB 대조: ${version} > latest_version (${args.platforms.join(', ')})`);
  console.log('\n✅ 버전 일관성 체크 통과');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('\n❌', error.message);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  compareVersions,
  isSingleSourceIntact,
  evaluateAgainstLatest,
  loadEnvLocal,
};
