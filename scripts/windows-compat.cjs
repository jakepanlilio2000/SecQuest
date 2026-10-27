// Restricted Windows execution hosts may deny uv_os_get_passwd. Tooling such as
// tsx only needs a stable temporary-directory label; never used for app identity.
const os = require("node:os");
try {
  os.userInfo();
} catch {
  const original = os.userInfo;
  os.userInfo = function (options) {
    try {
      return original(options);
    } catch {
      return {
        username: process.env.USERNAME || "secquest-local",
        uid: -1,
        gid: -1,
        shell: null,
        homedir: process.env.USERPROFILE || os.tmpdir(),
      };
    }
  };
  require("node:module").syncBuiltinESMExports();
}
