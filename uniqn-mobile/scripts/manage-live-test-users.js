const fs = require('fs');
const path = require('path');
const { ensureFreshFirebaseAccessToken } = require('./firebase-tools-auth');

const projectRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(projectRoot, '..');
const envFilePath = path.join(projectRoot, '.env.local');
const outputPath = path.join(projectRoot, 'output', 'playwright', 'live-test-users.json');

function readEnvFile(filePath) {
  const entries = {};
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) {
      continue;
    }
    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    entries[key] = value;
  }
  return entries;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function signUpWithEmailPassword(apiKey, email, password) {
  const payload = await requestJson(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    }
  );

  return {
    uid: payload.localId,
    email: payload.email,
    idToken: payload.idToken,
    refreshToken: payload.refreshToken,
  };
}

async function setCustomClaims(projectId, accessToken, uid, claims) {
  return requestJson(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        localId: uid,
        customAttributes: JSON.stringify(claims),
      }),
    }
  );
}

function firestoreValue(value) {
  if (typeof value === 'string') {
    return { stringValue: value };
  }

  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }

  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }

  if (value === null) {
    return { nullValue: null };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((item) => firestoreValue(item)),
      },
    };
  }

  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, innerValue]) => [key, firestoreValue(innerValue)])
        ),
      },
    };
  }

  throw new Error(`Unsupported Firestore value: ${String(value)}`);
}

async function upsertUserDocument(projectId, accessToken, uid, profile) {
  const fieldPaths = Object.keys(profile)
    .map((key) => `updateMask.fieldPaths=${encodeURIComponent(key)}`)
    .join('&');

  return requestJson(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}?${fieldPaths}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: Object.fromEntries(
          Object.entries(profile).map(([key, value]) => [key, firestoreValue(value)])
        ),
      }),
    }
  );
}

async function deleteUserDocument(projectId, accessToken, uid) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete Firestore document for ${uid}: ${response.status}`);
  }
}

async function deleteAuthUser(projectId, accessToken, uid) {
  return requestJson(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:delete`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        localId: uid,
      }),
    }
  );
}

function buildProfile({ uid, email, name, role, phoneNumber }) {
  const now = new Date();
  return {
    uid,
    email,
    name,
    nickname: name,
    displayName: name,
    role,
    status: 'active',
    isActive: true,
    profileCompleted: true,
    emailVerified: true,
    phoneNumber,
    phoneVerified: true,
    createdAt: now,
    updatedAt: now,
  };
}

function createAccountDefinitions(seed) {
  return [
    {
      key: 'admin',
      role: 'admin',
      name: 'Live Test Admin',
      phoneNumber: '+82105550001',
      email: `codex-live-admin-${seed}@example.com`,
      password: `LiveAdmin!${seed}`,
    },
    {
      key: 'employer',
      role: 'employer',
      name: 'Live Test Employer',
      phoneNumber: '+82105550002',
      email: `codex-live-employer-${seed}@example.com`,
      password: `LiveEmployer!${seed}`,
    },
    {
      key: 'staff',
      role: 'staff',
      name: 'Live Test Staff',
      phoneNumber: '+82105550003',
      email: `codex-live-staff-${seed}@example.com`,
      password: `LiveStaff!${seed}`,
    },
  ];
}

async function createAccounts() {
  const env = readEnvFile(envFilePath);
  const accessToken = ensureFreshFirebaseAccessToken({ cwd: workspaceRoot });
  const projectId = env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = env.EXPO_PUBLIC_FIREBASE_API_KEY;
  const seed = Date.now();
  const definitions = createAccountDefinitions(seed);

  const created = [];

  for (const definition of definitions) {
    const authUser = await signUpWithEmailPassword(apiKey, definition.email, definition.password);
    await setCustomClaims(projectId, accessToken, authUser.uid, { role: definition.role });
    await upsertUserDocument(
      projectId,
      accessToken,
      authUser.uid,
      buildProfile({
        uid: authUser.uid,
        email: definition.email,
        name: definition.name,
        role: definition.role,
        phoneNumber: definition.phoneNumber,
      })
    );

    created.push({
      ...definition,
      uid: authUser.uid,
    });
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        projectId,
        accounts: created,
      },
      null,
      2
    )
  );

  console.log(outputPath);
}

async function cleanupAccounts() {
  if (!fs.existsSync(outputPath)) {
    console.log('No live test user file found.');
    return;
  }

  const env = readEnvFile(envFilePath);
  const accessToken = ensureFreshFirebaseAccessToken({ cwd: workspaceRoot });
  const projectId = env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  const payload = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

  for (const account of payload.accounts || []) {
    await deleteUserDocument(projectId, accessToken, account.uid);
    await deleteAuthUser(projectId, accessToken, account.uid);
  }

  fs.unlinkSync(outputPath);
  console.log('cleaned');
}

async function main() {
  const mode = process.argv[2];

  if (mode === 'create') {
    await createAccounts();
    return;
  }

  if (mode === 'cleanup') {
    await cleanupAccounts();
    return;
  }

  throw new Error('Usage: node scripts/manage-live-test-users.js <create|cleanup>');
}

main().catch((error) => {
  console.error(error.payload || error);
  process.exit(1);
});
