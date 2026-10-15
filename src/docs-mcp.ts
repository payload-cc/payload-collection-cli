#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createDocsServer } from "./mcp/docs";

createDocsServer()
	.connect(new StdioServerTransport())
	.catch((error) => {
		console.error("Docs MCP startup failed:", error);
		process.exitCode = 1;
	});
