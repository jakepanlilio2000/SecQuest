import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve } from "node:path";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const transport = new StdioClientTransport({
  command: process.platform === "win32" ? "npx.cmd" : "npx",
  args: ["shadcn@latest", "mcp"],
  cwd: process.cwd(),
  stderr: "pipe",
  env: {
    ...process.env,
    npm_config_cache: resolve(".npm-cache"),
    npm_config_yes: "true",
    NODE_OPTIONS:
      `${process.env.NODE_OPTIONS ?? ""} --require=${resolve("scripts/windows-compat.cjs")}`.trim(),
  },
});
const client = new Client(
  { name: "secquest-registry-verification", version: "1.0.0" },
  { capabilities: {} },
);
try {
  await client.connect(transport);
  const result = await client.listTools();
  mkdirSync("data/qa", { recursive: true });
  writeFileSync("data/qa/shadcn-tools.json", JSON.stringify(result, null, 2));
  if (process.argv.includes("--discover")) {
    const discovery = {
      registries: await client.callTool({
        name: "get_project_registries",
        arguments: {},
      }),
      searches: {},
    };
    for (const query of ["button", "sidebar", "chart", "data-table"]) {
      const response = await client.callTool({
        name: "search_items_in_registries",
        arguments: { registries: ["@shadcn"], query, limit: 3 },
      });
      discovery.searches[query] = response;
      console.log(JSON.stringify({ query, result: response }));
    }
    const items = await client.callTool({
      name: "view_items_in_registries",
      arguments: {
        items: [
          "@shadcn/button",
          "@shadcn/dialog",
          "@shadcn/tabs",
          "@shadcn/sonner",
          "@shadcn/skeleton",
        ],
      },
    });
    discovery.selectedItems = items;
    writeFileSync(
      "data/qa/shadcn-registry-verification.json",
      JSON.stringify(discovery, null, 2),
    );
    console.log(JSON.stringify({ selectedItems: items }));
  }
  console.log(
    JSON.stringify(
      {
        packageVersion: JSON.parse(
          readFileSync("node_modules/shadcn/package.json", "utf8"),
        ).version,
        server: client.getServerVersion(),
        tools: result.tools.map((t) => ({
          name: t.name,
          inputSchema: t.inputSchema,
        })),
      },
      null,
      2,
    ),
  );
} finally {
  await client.close();
}
