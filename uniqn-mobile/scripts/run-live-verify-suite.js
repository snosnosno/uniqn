const { spawn } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';
const npxCommand = isWindows ? 'npx.cmd' : 'npx';
const nodeCommand = process.execPath;
const baseUrl = process.env.LIVE_BASE_URL || 'http://127.0.0.1:4101';
const serveListenTarget = process.env.LIVE_SERVE_LISTEN || 'tcp://127.0.0.1:4101';

function logStep(message) {
  const timestamp = new Date().toISOString();
  process.stdout.write(`[live-suite ${timestamp}] ${message}\n`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createExitError(command, code, signal) {
  if (signal) {
    return new Error(`Command failed with signal ${signal}: ${command}`);
  }

  return new Error(`Command failed with exit code ${code}: ${command}`);
}

function spawnInherited(command, args, options = {}) {
  const useShell = isWindows && command.toLowerCase().endsWith('.cmd');
  const child = spawn(command, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
    shell: useShell,
    ...options,
  });

  const commandLabel = [command, ...args].join(' ');

  const completion = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(createExitError(commandLabel, code, signal));
    });
  });

  return { child, completion, commandLabel };
}

async function runCommand(command, args, options = {}) {
  const { completion, commandLabel } = spawnInherited(command, args, options);
  logStep(`running: ${commandLabel}`);
  await completion;
}

async function waitForServer(url, timeout = 60000) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeout) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.ok || response.status === 301 || response.status === 302) {
        return;
      }

      lastError = new Error(`Unexpected status: ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await delay(1000);
  }

  const errorMessage =
    lastError instanceof Error ? lastError.message : 'unknown error while waiting for server';
  throw new Error(`Timed out waiting for server ${url}: ${errorMessage}`);
}

async function terminateProcess(child) {
  if (!child || child.killed || child.exitCode !== null) {
    return;
  }

  if (isWindows) {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });

      killer.once('error', () => resolve());
      killer.once('exit', () => resolve());
    });
    return;
  }

  child.kill('SIGTERM');
  await delay(1000);
  if (child.exitCode === null) {
    child.kill('SIGKILL');
  }
}

async function main() {
  logStep('exporting web build');
  await runCommand(npxCommand, ['expo', 'export', '--platform', 'web']);

  logStep(`starting serve on ${serveListenTarget}`);
  const serveProcess = spawnInherited(
    npxCommand,
    ['serve', 'dist', '-l', serveListenTarget, '-s', '--no-clipboard'],
    {
      env: {
        ...process.env,
        LIVE_BASE_URL: baseUrl,
      },
    }
  );
  const serveCompletion = serveProcess.completion.catch(() => {});

  try {
    await waitForServer(baseUrl, 60000);
    logStep(`server ready: ${baseUrl}`);

    await runCommand(nodeCommand, [path.join(__dirname, 'manage-live-test-users.js'), 'create'], {
      env: {
        ...process.env,
        LIVE_BASE_URL: baseUrl,
      },
    });

    await runCommand(nodeCommand, [path.join(__dirname, 'live-verify-smoke.js')], {
      env: {
        ...process.env,
        LIVE_BASE_URL: baseUrl,
      },
    });

    await runCommand(nodeCommand, [path.join(__dirname, 'live-verify-deep.js')], {
      env: {
        ...process.env,
        LIVE_BASE_URL: baseUrl,
      },
    });
  } finally {
    logStep('stopping serve');
    await terminateProcess(serveProcess.child);
    await serveCompletion;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
