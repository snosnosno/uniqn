const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const firebaseToolsPath = path.join(
  process.env.USERPROFILE || process.env.HOME || '',
  '.config',
  'configstore',
  'firebase-tools.json'
);

function refreshFirebaseCliSession(cwd) {
  if (process.platform === 'win32') {
    execFileSync(
      process.env.ComSpec || 'cmd.exe',
      ['/d', '/s', '/c', 'npx firebase-tools projects:list --json'],
      {
        cwd,
        stdio: 'ignore',
        windowsHide: true,
      }
    );
    return;
  }

  execFileSync('npx', ['firebase-tools', 'projects:list', '--json'], {
    cwd,
    stdio: 'ignore',
  });
}

function readFirebaseToolsConfig() {
  return JSON.parse(fs.readFileSync(firebaseToolsPath, 'utf8'));
}

function ensureFreshFirebaseAccessToken(options = {}) {
  const { cwd = process.cwd(), minLifetimeMs = 60000 } = options;
  let config = readFirebaseToolsConfig();
  const accessToken = config.tokens?.access_token;
  const expiresAt = Number(config.tokens?.expires_at || 0);

  if (accessToken && expiresAt > Date.now() + minLifetimeMs) {
    return accessToken;
  }

  refreshFirebaseCliSession(cwd);

  config = readFirebaseToolsConfig();
  const refreshedToken = config.tokens?.access_token;
  const refreshedExpiresAt = Number(config.tokens?.expires_at || 0);

  if (!refreshedToken || refreshedExpiresAt <= Date.now()) {
    throw new Error('Unable to refresh Firebase CLI access token');
  }

  return refreshedToken;
}

module.exports = {
  readFirebaseToolsConfig,
  ensureFreshFirebaseAccessToken,
};
