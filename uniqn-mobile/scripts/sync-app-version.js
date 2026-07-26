#!/usr/bin/env node
/**
 * UNIQN Mobile - 릴리스 버전 동기화 스크립트
 *
 * @description package.json 의 version 을 Supabase `app_config` 에 반영해
 *   앱 내 버전 체크(versionService.checkVersion)가 실제 출시 버전을 인지하게 한다.
 *
 * 실행 시점: **스토어 출시(승인·공개) 직후** (`npm run release` 체인의 마지막 단계).
 *   - 빌드/제출 성공만으로는 스토어에서 받을 수 없으므로 미리 올리면 존재하지 않는
 *     버전으로 업데이트하라고 안내하게 된다.
 *
 * 자동 갱신 대상 (ios/android):
 *   - latest_version      — "최신 버전" 표시값
 *   - recommended_version — **업데이트 모달의 실제 트리거** (resolveKeysToUpdate 주석 참조).
 *                           둘 다 올려야 사용자에게 안내가 뜬다. 안내일 뿐 앱을 잠그지 않음.
 * 비대상(수동 정책 레버): force_update_version — 자동으로 현재 버전까지 올리면
 *   아직 업데이트하지 않은 사용자가 즉시 앱 잠김. 의도적 결정이 필요해 `--force` opt-in.
 *
 * 필수 env:
 *   - EXPO_PUBLIC_SUPABASE_URL (.env.local 자동 로드)
 *   - SUPABASE_SERVICE_ROLE_KEY (app_config 쓰기는 RLS is_admin() 전용 → service role 로 우회)
 *
 * flags:
 *   --dry-run            변경 없이 적용될 값만 출력
 *   --platform=ios,web   갱신할 플랫폼 (기본 ios,android)
 *   --force              force_update_version 도 함께 갱신 (강제 업데이트 — 신중히)
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const projectRoot = path.resolve(__dirname, '..');

/**
 * .env.local 을 파싱해 key/value 객체로 반환 (process.env 가 우선이므로 fallback 용)
 */
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

/**
 * CLI 인자 파싱 (순수 함수)
 */
function parseArgs(argv) {
  const args = { dryRun: false, force: false, platforms: ['ios', 'android'] };
  for (const arg of argv) {
    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--force') {
      args.force = true;
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
 * 기존 값을 보존하면서 지정 플랫폼만 새 버전으로 덮어쓴 객체 반환 (순수 함수, 테스트 대상)
 * @param {Record<string,string>|null|undefined} current 기존 app_config value (예: { ios, android, web })
 * @param {string} version 새 시맨틱 버전
 * @param {string[]} platforms 갱신할 플랫폼 목록
 */
function buildVersionValue(current, version, platforms) {
  const next = { ...(current || {}) };
  for (const platform of platforms) {
    next[platform] = version;
  }
  return next;
}

/**
 * 갱신할 app_config 키 목록 결정 (순수 함수, 테스트 대상)
 *
 * `recommended_version` 이 기본 대상인 이유 — 업데이트 모달의 실제 트리거이기 때문:
 *   versionService.checkVersion:
 *     shouldUpdate = recommendedVersion ? current < recommendedVersion
 *                                       : current < latestVersion
 *   useVersionCheck: shouldUpdate 일 때만 모달을 띄우고, 아니면 숨긴다.
 * 즉 `recommended_version` 행이 존재하는 한 판정은 항상 그 값으로 내려간다.
 * `latest_version` 만 올리면 updateType 이 'optional' 에 그쳐 **사용자에게 아무 안내도
 * 뜨지 않는다**(2026-07-26 실측: 두 키 모두 1.0.3 에 고착돼 1.0.4 출시 안내가 나가지 않음).
 *
 * `force_update_version` 만 opt-in 인 이유: 현재 버전까지 올리면 아직 업데이트하지 않은
 * 사용자가 즉시 앱 잠김 — 의도적 정책 결정이 필요하다.
 *
 * @param {{ force?: boolean }} args
 * @returns {string[]}
 */
function resolveKeysToUpdate(args) {
  const keys = ['latest_version', 'recommended_version'];
  if (args && args.force) {
    keys.push('force_update_version');
  }
  return keys;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fileEnv = loadEnvLocal();
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || fileEnv.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL 미설정');
  }
  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY 미설정 — .env.local 에 추가하거나 환경변수로 주입하세요 ' +
        '(app_config 쓰기는 admin 권한 필요)'
    );
  }

  const { version } = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`비정상 버전 형식: ${version}`);
  }

  const keysToUpdate = resolveKeysToUpdate(args);

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: rows, error: selectError } = await supabase
    .from('app_config')
    .select('key, value')
    .in('key', keysToUpdate);
  if (selectError) {
    throw new Error(`app_config 조회 실패: ${selectError.message}`);
  }

  const currentMap = new Map((rows || []).map((row) => [row.key, row.value]));

  for (const key of keysToUpdate) {
    const current = currentMap.get(key);
    const nextValue = buildVersionValue(current, version, args.platforms);
    const tag = args.dryRun ? 'DRY-RUN' : 'UPDATE';
    console.log(`[${tag}] ${key}: ${JSON.stringify(current)} → ${JSON.stringify(nextValue)}`);

    if (args.dryRun) {
      continue;
    }

    const { error: updateError } = await supabase
      .from('app_config')
      .update({ value: nextValue })
      .eq('key', key);
    if (updateError) {
      throw new Error(`${key} 갱신 실패: ${updateError.message}`);
    }
  }

  console.log(
    args.dryRun
      ? '\nDry-run 완료 (변경 없음)'
      : `\n✅ app_config 동기화 완료 → ${version} (${args.platforms.join(', ')})`
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌', error.message);
    process.exit(1);
  });
}

module.exports = { buildVersionValue, parseArgs, resolveKeysToUpdate, loadEnvLocal };
