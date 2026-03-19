const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..", "..");
const activePackagePath = path.join(rootDir, "uniqn-mobile", "package.json");

const {
  ACTIVE_PACKAGE_JSON_PATH,
  getActiveAppVersion,
  readActiveAppPackageJson,
} = require("../active-app-metadata");
const { getPackageVersion: getUpdateDocsPackageVersion } = require("../update-docs");

test("active app metadata resolves to uniqn-mobile package.json", () => {
  assert.equal(ACTIVE_PACKAGE_JSON_PATH, activePackagePath);

  const activePackage = JSON.parse(fs.readFileSync(activePackagePath, "utf8"));

  assert.equal(readActiveAppPackageJson().name, activePackage.name);
  assert.equal(getActiveAppVersion(), activePackage.version);
});

test("document scripts reference active-app-metadata instead of app2 package.json", () => {
  const scriptFiles = [
    "check-docs.js",
    "generate-changelog.js",
    "update-docs.js",
  ];

  for (const scriptFile of scriptFiles) {
    const source = fs.readFileSync(path.join(rootDir, "scripts", scriptFile), "utf8");

    assert.match(source, /active-app-metadata/);
    assert.doesNotMatch(source, /app2[\\/]+package\.json/);
  }
});

test("update-docs package version matches the active app version", () => {
  const activePackage = JSON.parse(fs.readFileSync(activePackagePath, "utf8"));

  assert.equal(getUpdateDocsPackageVersion(), activePackage.version);
});
