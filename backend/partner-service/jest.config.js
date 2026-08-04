/**
 * Jest config — resolves `shared/` in both runtimes:
 * - container: docker-compose mounts the repo's shared/ at ./shared (has lib/)
 * - host (pre-push hook): ./shared holds only a partial utils/ copy, so map
 *   shared imports to the repo root ../../shared instead
 */

const path = require("path");
const fs = require("fs");

const localShared = path.resolve(__dirname, "shared");
const repoShared = path.resolve(__dirname, "../../shared");
const sharedPath = fs.existsSync(path.join(localShared, "lib"))
  ? localShared
  : repoShared;

module.exports = {
  testEnvironment: "node",
  moduleNameMapper: {
    "^(?:\\.\\./)+shared/(.*)$": `${sharedPath}/$1`,
  },
};
