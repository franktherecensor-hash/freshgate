import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createLegacyMcpHandler } from "agents/mcp";
import { withX402 } from "agents/x402";
import { z } from "zod";

import v03 from "./worker-v03.js";
import core from "./worker-v02.js";

const PAY_TO =
  "0xdafffedd9faa96d35b6d70715d073bc11475f25f";

const PRICE_USD = 0.001;

function createPaidServer(env, origin, ctx) {
  const server = withX402(
    new McpServer({
      name: "FreshGate Paid",
      version: "0.4.0"
    }),
    {
      network: "base",
      recipient: PAY_TO,
      facilitator: {
        url: "https://x402.org/facilitator"
      }
    }
  );

  server.paidTool(
    "check_freshness",
    "Check whether a web page has changed. Paid FreshGate tool.",
    PRICE_USD,
    {
      url: z.string().url(),

      known_hash: z
        .string()
        .optional()
        .describe(
          "Hash returned by FreshGate from a previous check"
        ),

      max_age_seconds: z
        .number()
        .int()
        .min(0)
        .max(86400)
        .optional()
    },
    {},
    async ({
      url,
      known_hash,
      max_age_seconds = 300
    }) => {
      const internalUrl =
        new URL("/fresh", origin);

      internalUrl.searchParams.set(
        "url",
        url
      );

      internalUrl.searchParams.set(
        "ttl",
        String(max_age_seconds)
      );

      const response = await core.fetch(
        new Request(internalUrl.toString()),
        env,
        ctx
      );

      const result = await response.json();

      if (!response.ok) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify(result)
            }
          ]
        };
      }

      let recommendation = "read";

      if (
        known_hash &&
        known_hash === result.hash
      ) {
        recommendation =
          "reuse_previous_content";
      }

      const output = {
        service: "FreshGate",
        paid: true,
        price_usd: PRICE_USD,

        url: result.url,
        reachable: result.reachable,
        status: result.status,

        changed: result.changed,

        current_hash: result.hash,
        previous_hash:
          known_hash || null,

        recommendation,

        checked_at:
          result.checked_at ?? null,

        checks:
          result.checks ?? null,

        changes:
          result.changes ?? null
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              output,
              null,
              2
            )
          }
        ]
      };
    }
  );

  return server;
}

export default {
  async fetch(request, env, ctx) {
    const url =
      new URL(request.url);

    // Nuovo MCP x402 di test
    if (url.pathname === "/paid-mcp") {
      const handler =
        createLegacyMcpHandler(
          createPaidServer(
            env,
            url.origin,
            ctx
          ),
          {
            route: "/paid-mcp",
            enableJsonResponse: true
          }
        );

      return handler(
        request,
        env,
        ctx
      );
    }

    // Tutto il resto continua a usare FreshGate v0.3
    return v03.fetch(
      request,
      env,
      ctx
    );
  }
};