import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

import core from "./worker-v02.js";

function createFreshGateServer(env, origin, ctx) {
  const server = new McpServer({
    name: "freshgate",
    version: "0.3.0"
  });

  server.registerTool(
    "check_freshness",
    {
      description:
        "Check whether a web page should be read again. " +
        "Use this before re-fetching a URL that an agent has previously read. " +
        "If you have a previous FreshGate hash, pass it as known_hash. " +
        "A matching hash means the agent can reuse its previous content.",

      inputSchema: {
        url: z.string().url(),

        known_hash: z
          .string()
          .optional()
          .describe(
            "FreshGate hash saved when this page was previously read"
          ),

        max_age_seconds: z
          .number()
          .int()
          .min(0)
          .max(86400)
          .optional()
          .describe(
            "Maximum age of a cached FreshGate check. Use 0 for a live recheck."
          )
      }
    },

    async ({
      url,
      known_hash,
      max_age_seconds = 300
    }) => {
      const internal = new URL("/fresh", origin);

      internal.searchParams.set("url", url);
      internal.searchParams.set(
        "ttl",
        String(max_age_seconds)
      );

      const response = await core.fetch(
        new Request(internal.toString()),
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

      let agentRecommendation = "read";
      let reason = "No previous client hash supplied.";

      if (known_hash) {
        if (known_hash === result.hash) {
          agentRecommendation = "reuse_previous_content";
          reason =
            "The current FreshGate fingerprint matches the agent's previous fingerprint.";
        } else {
          agentRecommendation = "read";
          reason =
            "The current fingerprint differs from the previous fingerprint.";
        }
      }

      const output = {
        url: result.url,
        reachable: result.reachable,
        status: result.status,
        changed_since_freshgate_check:
          result.changed,
        freshgate_source: result.source,
        current_hash: result.hash,
        previous_hash: known_hash || null,
        recommendation: agentRecommendation,
        reason,
        checked_at: result.checked_at ?? null,
        checks: result.checks ?? null,
        changes: result.changes ?? null
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(output, null, 2)
          }
        ]
      };
    }
  );

  server.registerTool(
    "freshgate_stats",
    {
      description:
        "Return FreshGate usage statistics.",
      inputSchema: {}
    },

    async () => {
      const response = await core.fetch(
        new Request(origin + "/stats"),
        env,
        ctx
      );

      const result = await response.json();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
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

    if (url.pathname === "/mcp") {
      const handler = createMcpHandler(
        () =>
          createFreshGateServer(
            env,
            url.origin,
            ctx
          ),
        {
          route: "/mcp"
        }
      );

      return handler(request, env, ctx);
    }

    return core.fetch(request, env, ctx);
  }
};