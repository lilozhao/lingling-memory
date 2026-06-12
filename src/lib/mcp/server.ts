import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMemoryTools } from "./tools/memory-tools";

export function buildMcpServer(userId: string): McpServer {
  const server = new McpServer({
    name: "lingling-memory-mcp",
    version: "1.0.0",
  });

  registerMemoryTools(server, userId);

  return server;
}
