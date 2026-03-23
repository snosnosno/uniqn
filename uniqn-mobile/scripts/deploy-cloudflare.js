#!/usr/bin/env node
/**
 * Cloudflare Pages 배포 스크립트
 *
 * Wrangler가 node_modules 폴더를 무시하는 문제를 해결하기 위해
 * 빌드 후 assets/node_modules를 assets/vendors로 변경합니다.
 *
 * 사용법: npm run deploy:cloudflare
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const ASSETS_DIR = path.join(DIST_DIR, 'assets');
const NODE_MODULES_DIR = path.join(ASSETS_DIR, 'node_modules');
const VENDORS_DIR = path.join(ASSETS_DIR, 'vendors');
const JS_DIR = path.join(DIST_DIR, '_expo', 'static', 'js', 'web');
const ROOT_DIR = path.join(__dirname, '..');

function moveDirectory(sourceDir, targetDir) {
  try {
    fs.renameSync(sourceDir, targetDir);
    return;
  } catch (error) {
    if (error?.code !== 'EPERM') {
      throw error;
    }
  }

  fs.cpSync(sourceDir, targetDir, { recursive: true });
  fs.rmSync(sourceDir, { recursive: true, force: true });
}

// --force 플래그로 커밋되지 않은 변경사항 허용
const forceFlag = process.argv.includes('--force');

console.log('🚀 Cloudflare Pages 배포 시작\n');

// 0. Git 상태 확인 (커밋되지 않은 변경사항 경고)
try {
  const gitStatus = execSync('git status --porcelain', { cwd: ROOT_DIR, encoding: 'utf-8' }).trim();
  if (gitStatus) {
    console.warn('⚠️  커밋되지 않은 변경사항이 있습니다:');
    console.warn(
      gitStatus
        .split('\n')
        .map((l) => `   ${l}`)
        .join('\n')
    );
    if (!forceFlag) {
      console.error('\n❌ 변경사항을 커밋한 후 배포하세요.');
      console.error('   커밋 없이 배포하려면: npm run deploy:cloudflare -- --force');
      process.exit(1);
    }
    console.warn('\n   --force 플래그로 계속 진행합니다.\n');
  }
} catch {
  // git이 없는 환경에서는 무시
}

// 1. 웹 빌드
console.log('📦 Step 1: Expo Web 빌드...');
try {
  execSync('npm run build:web', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
} catch (error) {
  console.error('❌ 빌드 실패');
  process.exit(1);
}

// 2. node_modules → vendors 폴더명 변경
console.log('\n🔄 Step 2: assets/node_modules → assets/vendors 변경...');
if (fs.existsSync(NODE_MODULES_DIR)) {
  if (fs.existsSync(VENDORS_DIR)) {
    fs.rmSync(VENDORS_DIR, { recursive: true, force: true });
  }
  moveDirectory(NODE_MODULES_DIR, VENDORS_DIR);
  console.log('   ✅ 폴더명 변경 완료');
} else {
  console.log('   ⚠️ node_modules 폴더 없음 (이미 변경됨)');
}

// 3. JS 파일 내 경로 수정
console.log('\n📝 Step 3: JS 파일 내 경로 수정...');
if (fs.existsSync(JS_DIR)) {
  const jsFiles = fs.readdirSync(JS_DIR).filter((f) => f.endsWith('.js'));
  let modifiedCount = 0;

  jsFiles.forEach((file) => {
    const filePath = path.join(JS_DIR, file);
    let content = fs.readFileSync(filePath, 'utf-8');

    if (content.includes('/assets/node_modules/')) {
      content = content.replace(/\/assets\/node_modules\//g, '/assets/vendors/');
      fs.writeFileSync(filePath, content);
      modifiedCount++;
      console.log(`   ✅ ${file} 수정됨`);
    }
  });

  if (modifiedCount === 0) {
    console.log('   ⚠️ 수정할 파일 없음');
  }
} else {
  console.error('   ❌ JS 디렉토리 없음');
  process.exit(1);
}

// 4. Wrangler 배포 (wrangler.toml 설정 사용)
console.log('\n🌐 Step 4: Cloudflare Pages 배포...');
const commitDirtyFlag = forceFlag ? ' --commit-dirty=true' : '';

// 최근 커밋 메시지를 ASCII-safe하게 가져옴 (한글 깨짐 방지)
let commitMessage = 'deploy';
try {
  const raw = execSync('git log -1 --pretty=format:%s', {
    cwd: ROOT_DIR,
    encoding: 'utf-8',
  }).trim();
  // wrangler가 non-UTF-8로 인식하는 경우 방지: ASCII 외 문자는 유니코드 이스케이프
  commitMessage = raw.replace(
    /[^\x20-\x7E]/g,
    (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`
  );
} catch {
  // git 없으면 기본값 사용
}

try {
  execSync(
    `npx wrangler pages deploy dist --project-name=uniqn-app${commitDirtyFlag} --commit-message="${commitMessage}"`,
    {
      stdio: 'inherit',
      cwd: ROOT_DIR,
    }
  );
} catch (error) {
  console.error('❌ 배포 실패');
  process.exit(1);
}

console.log('\n✨ 배포 완료!');
console.log('🔗 https://uniqn-app.pages.dev');
