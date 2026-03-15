#!/usr/bin/env node

const { fileExists, functionsDir, runOrExit, uniqnMobileDir } = require('./shared');

function main() {
  console.log('[hook] pre-push: 최신 품질 게이트 실행');

  if (fileExists(require('path').join(uniqnMobileDir, 'package.json'))) {
    console.log('[hook] pre-push: uniqn-mobile npm run quality');
    runOrExit(npmCommand(), ['run', 'quality'], { cwd: uniqnMobileDir });
  }

  if (fileExists(require('path').join(functionsDir, 'package.json'))) {
    console.log('[hook] pre-push: functions npm run build');
    runOrExit(npmCommand(), ['run', 'build'], { cwd: functionsDir });
  }

  console.log('[hook] pre-push: 완료');
}

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

main();
