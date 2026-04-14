#!/usr/bin/env node

const { spawnSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Resolve repoRoot from the active git working tree (cwd), not from __dirname.
// Git invokes hooks with cwd = worktree top, so `git rev-parse --show-toplevel`
// returns the correct worktree path even when this script lives in main repo.
function resolveRepoRoot() {
  try {
    const top = execSync('git rev-parse --show-toplevel', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (top) return path.normalize(top);
  } catch {
    // fall through
  }
  return process.cwd();
}

const repoRoot = resolveRepoRoot();
const uniqnMobileDir = path.join(repoRoot, 'uniqn-mobile');
const functionsDir = path.join(repoRoot, 'functions');

function cmd(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

function run(command, args, options = {}) {
  const useShell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(command);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: useShell,
    windowsHide: true,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
}

function runOrExit(command, args, options = {}) {
  const status = run(command, args, options);
  if (status !== 0) {
    process.exit(status);
  }
}

function git(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
    shell: false,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 1) !== 0) {
    const message = (result.stderr || result.stdout || 'git command failed').trim();
    throw new Error(message);
  }

  return result.stdout || '';
}

function getStagedFiles() {
  const output = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']);
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function matchesExtension(file, extensions) {
  return extensions.some((ext) => file.endsWith(ext));
}

function relativeTo(dir, filePath) {
  return path.relative(dir, path.join(repoRoot, filePath)).replace(/\\/g, '/');
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

module.exports = {
  chunk,
  cmd,
  fileExists,
  functionsDir,
  getStagedFiles,
  matchesExtension,
  relativeTo,
  repoRoot,
  run,
  runOrExit,
  uniqnMobileDir,
};
