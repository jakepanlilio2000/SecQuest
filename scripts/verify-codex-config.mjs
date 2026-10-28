import { readFileSync, writeFileSync } from "node:fs";
const before = readFileSync(process.argv[2], "utf8");
const after = readFileSync(process.argv[3], "utf8");
// Codex's TOML writer omits empty argument arrays and serializes floats.
// Compare remaining content without disclosing any configuration values.
const normalize = (s) => {
  let section = "";
  const lines = s
    .split(/\r?\n/)
    .filter((l) => l.trim() && !/^args\s*=\s*\[\s*\]\s*$/.test(l))
    .map((l) =>
      l
        .replace(
          /^(startup_timeout_sec\s*=\s*)([0-9.]+)\s*$/,
          (_m, key, n) => key + Number(n),
        )
        .trim(),
    );
  // This comparison is specific to this single-line Codex serialization;
  // fail closed if a later configuration introduces multiline constructs.
  const entries = lines.map((line) => {
    if (line.startsWith("[")) {
      section = line;
      return section;
    }
    if (!line.includes("=")) throw Error("Unsupported multiline configuration");
    return section + " " + line;
  });
  return entries.sort().join("\n");
};
const stripped = after.replace(
  /\r?\n\[mcp_servers\.shadcn\][\s\S]*?(?=\r?\n\[|$)/,
  "",
);
const result = {
  serverConfigured: after.includes("[mcp_servers.shadcn]"),
  otherConfigurationEquivalentAfterCodexSerialization:
    normalize(before) === normalize(stripped),
};
writeFileSync(
  "data/qa/codex-config-preservation.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result));
if (
  !result.serverConfigured ||
  !result.otherConfigurationEquivalentAfterCodexSerialization
)
  process.exitCode = 1;
