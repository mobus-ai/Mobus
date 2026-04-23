import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./index.js";

const { server } = createServer();
const transport = new StdioServerTransport();
await server.connect(transport);
