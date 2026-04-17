#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

function debug(message) {
  if (process.env.FIREBASE_MCP_WRAPPER_DEBUG === '1') {
    process.stderr.write(`[firebase-mcp-wrapper] ${message}\n`);
  }
}

function buildFirebaseSpawnSpec() {
  const firebaseArgs = ['mcp', ...process.argv.slice(2)];
  if (process.env.FIREBASE_CLI_ENTRYPOINT) {
    return {
      command: process.execPath,
      args: [process.env.FIREBASE_CLI_ENTRYPOINT, ...firebaseArgs],
      shell: false,
    };
  }

  if (process.env.FIREBASE_BIN) {
    return {
      command: process.env.FIREBASE_BIN,
      args: firebaseArgs,
      shell: false,
    };
  }

  const appData = process.env.APPDATA;
  if (appData) {
    const globalCliEntrypoint = path.join(
      appData,
      'npm',
      'node_modules',
      'firebase-tools',
      'lib',
      'bin',
      'firebase.js'
    );

    if (fs.existsSync(globalCliEntrypoint)) {
      return {
        command: process.execPath,
        args: [globalCliEntrypoint, ...firebaseArgs],
        shell: false,
      };
    }
  }

  if (process.platform === 'win32') {
    return {
      command: 'firebase.cmd',
      args: firebaseArgs,
      shell: true,
    };
  }

  return {
    command: 'firebase',
    args: firebaseArgs,
    shell: false,
  };
}

function writeContentLengthMessage(json) {
  const payload = Buffer.from(json, 'utf8');
  process.stdout.write(`Content-Length: ${payload.length}\r\n\r\n`);
  process.stdout.write(payload);
}

function findHeaderTerminator(buffer) {
  const crlf = buffer.indexOf('\r\n\r\n');
  if (crlf !== -1) {
    return { index: crlf, length: 4 };
  }

  const lf = buffer.indexOf('\n\n');
  if (lf !== -1) {
    return { index: lf, length: 2 };
  }

  return null;
}

function drainParentBuffer(state, onJsonMessage) {
  while (state.buffer.length > 0) {
    const headerTerminator = findHeaderTerminator(state.buffer);

    if (headerTerminator) {
      const headerText = state.buffer.subarray(0, headerTerminator.index).toString('utf8');
      const lengthMatch = headerText.match(/(?:^|\r?\n)Content-Length:\s*(\d+)/i);

      if (lengthMatch) {
        const contentLength = Number(lengthMatch[1]);
        const messageStart = headerTerminator.index + headerTerminator.length;
        const messageEnd = messageStart + contentLength;

        if (state.buffer.length < messageEnd) {
          return;
        }

        const message = state.buffer.subarray(messageStart, messageEnd).toString('utf8');
        state.buffer = state.buffer.subarray(messageEnd);
        onJsonMessage(message);
        continue;
      }
    }

    const newlineIndex = state.buffer.indexOf('\n');
    if (newlineIndex === -1) {
      return;
    }

    const line = state.buffer.subarray(0, newlineIndex).toString('utf8').trim();
    state.buffer = state.buffer.subarray(newlineIndex + 1);

    if (line) {
      onJsonMessage(line);
    }
  }
}

const firebaseSpawnSpec = buildFirebaseSpawnSpec();
debug(
  `spawning ${firebaseSpawnSpec.command} ${firebaseSpawnSpec.args.join(' ')} (shell=${firebaseSpawnSpec.shell})`
);
const child = spawn(firebaseSpawnSpec.command, firebaseSpawnSpec.args, {
  shell: firebaseSpawnSpec.shell,
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true,
});

child.on('error', (error) => {
  debug(`child process error: ${error.message}`);
  process.stderr.write(`Failed to start Firebase MCP server: ${error.message}\n`);
  process.exit(1);
});

child.stderr.on('data', (chunk) => {
  debug(`child stderr chunk (${chunk.length} bytes)`);
  process.stderr.write(chunk);
});

const parentState = { buffer: Buffer.alloc(0) };
process.stdin.on('data', (chunk) => {
  debug(`parent stdin chunk (${chunk.length} bytes)`);
  parentState.buffer = Buffer.concat([parentState.buffer, chunk]);
  drainParentBuffer(parentState, (jsonMessage) => {
    debug(`forwarding parent message (${Buffer.byteLength(jsonMessage, 'utf8')} bytes)`);
    child.stdin.write(`${jsonMessage}\n`);
  });
});

process.stdin.on('end', () => {
  child.stdin.end();
});

const childState = { buffer: Buffer.alloc(0) };
child.stdout.on('data', (chunk) => {
  debug(`child stdout chunk (${chunk.length} bytes)`);
  childState.buffer = Buffer.concat([childState.buffer, chunk]);

  drainParentBuffer(childState, (jsonMessage) => {
    debug(`forwarding child message (${Buffer.byteLength(jsonMessage, 'utf8')} bytes)`);
    writeContentLengthMessage(jsonMessage);
  });
});

child.on('exit', (code, signal) => {
  debug(`child exit code=${code ?? 'null'} signal=${signal ?? 'null'}`);
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
