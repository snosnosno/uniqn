const fs = require("fs");
const path = require("path");

const ACTIVE_APP_DIR = path.join(__dirname, "../uniqn-mobile");
const ACTIVE_PACKAGE_JSON_PATH = path.join(ACTIVE_APP_DIR, "package.json");

function readActiveAppPackageJson() {
  return JSON.parse(fs.readFileSync(ACTIVE_PACKAGE_JSON_PATH, "utf8"));
}

function getActiveAppVersion() {
  return readActiveAppPackageJson().version;
}

module.exports = {
  ACTIVE_APP_DIR,
  ACTIVE_PACKAGE_JSON_PATH,
  readActiveAppPackageJson,
  getActiveAppVersion,
};
