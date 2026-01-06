#!/usr/bin/env node
/**
 * Bundle Size Checker for UNIQN Mobile
 *
 * 번들 크기가 목표(500KB gzip)를 초과하면 CI를 실패시킵니다.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// 설정
const CONFIG = {
  maxBundleSize: 500 * 1024, // 500KB (gzip)
  bundleDir: path.join(__dirname, '..', 'dist', '_expo', 'static', 'js', 'web'),
  reportFile: path.join(__dirname, '..', 'bundle-size-report.txt'),
};

/**
 * 파일 크기를 읽기 쉬운 형식으로 변환
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 파일의 gzip 크기 계산
 */
function getGzipSize(filePath) {
  const content = fs.readFileSync(filePath);
  const gzipped = zlib.gzipSync(content, { level: 9 });
  return gzipped.length;
}

/**
 * 디렉토리 내 JS 파일들의 크기 분석
 */
function analyzeBundle() {
  if (!fs.existsSync(CONFIG.bundleDir)) {
    console.error(`Bundle directory not found: ${CONFIG.bundleDir}`);
    console.error('Run "npm run build:web" first.');
    process.exit(1);
  }

  const files = fs
    .readdirSync(CONFIG.bundleDir)
    .filter((file) => file.endsWith('.js'));

  if (files.length === 0) {
    console.error('No JavaScript files found in bundle directory.');
    process.exit(1);
  }

  const results = files.map((file) => {
    const filePath = path.join(CONFIG.bundleDir, file);
    const stats = fs.statSync(filePath);
    const gzipSize = getGzipSize(filePath);

    return {
      name: file,
      originalSize: stats.size,
      gzipSize,
    };
  });

  // 크기 순으로 정렬
  results.sort((a, b) => b.gzipSize - a.gzipSize);

  return results;
}

/**
 * 리포트 생성
 */
function generateReport(results) {
  const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0);
  const totalGzip = results.reduce((sum, r) => sum + r.gzipSize, 0);
  const isOverBudget = totalGzip > CONFIG.maxBundleSize;

  const status = isOverBudget ? 'FAIL' : 'PASS';
  const emoji = isOverBudget ? '🔴' : '🟢';
  const percentage = ((totalGzip / CONFIG.maxBundleSize) * 100).toFixed(1);

  let report = `### Bundle Analysis ${emoji}\n\n`;
  report += `| File | Original | Gzip |\n`;
  report += `|------|----------|------|\n`;

  results.forEach((r) => {
    report += `| ${r.name} | ${formatBytes(r.originalSize)} | ${formatBytes(r.gzipSize)} |\n`;
  });

  report += `\n`;
  report += `**Total**: ${formatBytes(totalOriginal)} (original) / ${formatBytes(totalGzip)} (gzip)\n`;
  report += `**Budget**: ${formatBytes(CONFIG.maxBundleSize)} (${percentage}% used)\n`;
  report += `**Status**: ${status}\n`;

  return { report, isOverBudget, totalGzip };
}

// 메인 실행
function main() {
  console.log('Analyzing bundle size...\n');

  const results = analyzeBundle();
  const { report, isOverBudget, totalGzip } = generateReport(results);

  // 콘솔 출력
  console.log(report);

  // 파일로 저장 (GitHub Actions용)
  fs.writeFileSync(CONFIG.reportFile, report);
  console.log(`\nReport saved to: ${CONFIG.reportFile}`);

  // GitHub Actions 출력
  if (process.env.GITHUB_ACTIONS) {
    const outputFile = process.env.GITHUB_OUTPUT;
    if (outputFile) {
      fs.appendFileSync(
        outputFile,
        `bundle-size=${formatBytes(totalGzip)}\n`
      );
      fs.appendFileSync(outputFile, `is-over-budget=${isOverBudget}\n`);
    }
  }

  // 예산 초과 시 실패
  if (isOverBudget) {
    console.error(
      `\nBundle size (${formatBytes(totalGzip)}) exceeds budget (${formatBytes(CONFIG.maxBundleSize)})`
    );
    process.exit(1);
  }

  console.log('\nBundle size check passed!');
  process.exit(0);
}

main();
