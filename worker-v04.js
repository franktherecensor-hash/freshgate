import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createLegacyMcpHandler } from "agents/mcp";
import { withX402 } from "agents/x402";
import { z } from "zod";

import v03 from "./worker-v03.js";
import core from "./worker-v02.js";

const PAY_TO =
  "0xdAFfFEdd9faA96d35b6D70715D073BC11475F25f";

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

    "Use before re-fetching a public URL. Checks whether the page changed and returns freshness, hash and HTTP metadata. Helps avoid unnecessary full web fetches. Price: $0.001 USDC.",

    PRICE_USD,

    {
      url: z
        .string()
        .url()
        .describe(
          "Public HTTP or HTTPS URL to check for content changes"
        ),

      known_hash: z
        .string()
        .optional()
        .describe(
          "Hash previously returned by FreshGate. Send it to determine whether the content changed"
        ),

      max_age_seconds: z
        .number()
        .int()
        .min(0)
        .max(86400)
        .optional()
        .describe(
          "Maximum acceptable age of a previous FreshGate check, in seconds"
        )
    },

    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },

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
              text: JSON.stringify(
                result,
                null,
                2
              )
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
        version: "0.4.0",

        paid: true,
        price_usd: PRICE_USD,
        network: "base",

        url: result.url,
        final_url:
          result.final_url ?? result.url,

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
    const url = new URL(request.url);

    // MCP x402 a pagamento
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

    // Tutte le API/MCP precedenti restano operative
    return v03.fetch(
      request,
      env,
      ctx
    );
  }
};