import { Hono } from "hono";

import {
  paymentMiddleware,
  x402ResourceServer
} from "@x402/hono";

import {
  HTTPFacilitatorClient
} from "@x402/core/server";

import {
  ExactEvmScheme
} from "@x402/evm/exact/server";

import {
  declareDiscoveryExtension
} from "@x402/extensions/bazaar";

import v04 from "./worker-v04.js";
import core from "./worker-v02.js";


// ==================================================
// CONFIG
// ==================================================

const ORIGIN =
  "https://freshgate-api.franktherecensor.workers.dev";

const PAID_ENDPOINT =
  `${ORIGIN}/api/check-freshness`;

const PAY_TO =
  "0xdAFfFEdd9faA96d35b6D70715D073BC11475F25f";

const NETWORK =
  "eip155:8453";

const PRICE =
  "$0.001";

const FACILITATOR_URL =
  "https://facilitator.payai.network";


// ==================================================
// X402
// ==================================================

const facilitatorClient =
  new HTTPFacilitatorClient({
    url: FACILITATOR_URL
  });

const resourceServer =
  new x402ResourceServer(
    facilitatorClient
  ).register(
    NETWORK,
    new ExactEvmScheme()
  );


// ==================================================
// BAZAAR METADATA
// ==================================================

const discovery =
  declareDiscoveryExtension({

    input: {
      url: "https://example.com",
      ttl: 300
    },

    inputSchema: {

      properties: {

        url: {
          type: "string",
          format: "uri",
          description:
            "Public HTTP or HTTPS URL to check"
        },

        ttl: {
          type: "integer",
          minimum: 0,
          maximum: 86400,
          description:
            "Maximum acceptable age of the previous check in seconds"
        }
      },

      required: [
        "url"
      ]
    },

    output: {

      example: {
        service: "FreshGate",
        version: "0.6.2",
        paid: true,
        price_usdc: 0.001,
        network: "base",
        url: "https://example.com/",
        reachable: true,
        status: 200,
        changed: false,
        recommendation: "skip"
      },

      schema: {

        type: "object",

        properties: {

          service: {
            type: "string"
          },

          version: {
            type: "string"
          },

          paid: {
            type: "boolean"
          },

          price_usdc: {
            type: "number"
          },

          network: {
            type: "string"
          },

          url: {
            type: "string"
          },

          reachable: {
            type: "boolean"
          },

          status: {
            type: "integer"
          },

          changed: {
            type: "boolean"
          },

          recommendation: {
            type: "string"
          }
        }
      }
    }
  });


// ==================================================
// HONO + X402
// ==================================================

const app =
  new Hono();

const routes = {

  "GET /api/check-freshness": {

    accepts: [
      {
        scheme: "exact",
        price: PRICE,
        network: NETWORK,
        payTo: PAY_TO
      }
    ],

    description:
      "Pay-per-call web freshness and change detection API for AI agents.",

    mimeType:
      "application/json",

    serviceName:
      "FreshGate",

    tags: [
      "utility",
      "web",
      "freshness",
      "change-detection",
      "ai-agents"
    ],

    extensions:
      discovery
  }
};


app.use(
  paymentMiddleware(
    routes,
    resourceServer
  )
);


// ==================================================
// PAID ENDPOINT
// ==================================================

app.get(
  "/api/check-freshness",

  async (c) => {

    const target =
      c.req.query("url");

    const ttl =
      c.req.query("ttl") || "300";


    if (!target) {

      return c.json(
        {
          error:
            "Missing url parameter"
        },
        400
      );
    }


    try {

      const parsed =
        new URL(target);

      if (
        parsed.protocol !== "http:" &&
        parsed.protocol !== "https:"
      ) {

        return c.json(
          {
            error:
              "Invalid URL"
          },
          400
        );
      }

    } catch {

      return c.json(
        {
          error:
            "Invalid URL"
        },
        400
      );
    }


    const internalUrl =
      new URL(
        "/fresh",
        ORIGIN
      );

    internalUrl.searchParams.set(
      "url",
      target
    );

    internalUrl.searchParams.set(
      "ttl",
      ttl
    );


    const response =
      await core.fetch(
        new Request(
          internalUrl.toString()
        ),
        c.env,
        c.executionCtx
      );


    const result =
      await response.json();


    return c.json(
      {
        service:
          "FreshGate",

        version:
          "0.6.2",

        paid:
          true,

        price_usdc:
          0.001,

        network:
          "base",

        ...result
      },

      response.status
    );
  }
);


// ==================================================
// PUBLIC HELPERS
// ==================================================

function json(data) {

  return new Response(
    JSON.stringify(
      data,
      null,
      2
    ),

    {
      status: 200,

      headers: {
        "content-type":
          "application/json; charset=utf-8",

        "access-control-allow-origin":
          "*",

        "cache-control":
          "public, max-age=300"
      }
    }
  );
}


function text(
  value,
  contentType =
    "text/plain; charset=utf-8"
) {

  return new Response(
    value,

    {
      status: 200,

      headers: {
        "content-type":
          contentType,

        "access-control-allow-origin":
          "*",

        "cache-control":
          "public, max-age=300"
      }
    }
  );
}


// ==================================================
// MAIN WORKER
// ==================================================

export default {

  async fetch(
    request,
    env,
    ctx
  ) {

    const url =
      new URL(
        request.url
      );


    // PAID X402 ROUTE

    if (
      url.pathname ===
      "/api/check-freshness"
    ) {

      return app.fetch(
        request,
        env,
        ctx
      );
    }


    // X402 STATUS

    if (
      url.pathname ===
      "/api/x402-status"
    ) {

      return json({

        service:
          "FreshGate",

        version:
          "0.6.2",

        status:
          "online",

        x402:
          true,

        facilitator:
          FACILITATOR_URL,

        network:
          NETWORK,

        price:
          PRICE,

        payTo:
          PAY_TO,

        endpoint:
          PAID_ENDPOINT,

        bazaar:
          true
      });
    }


    // DISCOVERY

    if (
      url.pathname ===
      "/discovery.json"
    ) {

      return json({

        serviceName:
          "FreshGate",

        description:
          "Pay-per-call web freshness and change detection API for AI agents.",

        endpoint:
          PAID_ENDPOINT,

        price: {
          amount: "0.001",
          currency: "USDC",
          network: NETWORK,
          scheme: "exact"
        },

        payTo:
          PAY_TO,

        openapi:
          `${ORIGIN}/openapi.json`,

        x402:
          `${ORIGIN}/.well-known/x402`,

        llms:
          `${ORIGIN}/llms.txt`,

        tags: [
          "utility",
          "web",
          "freshness",
          "change-detection",
          "ai-agents"
        ]
      });
    }


    // WELL-KNOWN X402

    if (
      url.pathname ===
      "/.well-known/x402"
    ) {

      return json({

        x402Version: 2,

        resources: [

          {
            resource:
              PAID_ENDPOINT,

            url:
              PAID_ENDPOINT,

            method:
              "GET",

            serviceName:
              "FreshGate",

            description:
              "Pay-per-call web freshness and change detection API for AI agents.",

            price:
              PRICE,

            currency:
              "USDC",

            network:
              NETWORK,

            scheme:
              "exact",

            payTo:
              PAY_TO
          }
        ]
      });
    }


    // OPENAPI

    if (
      url.pathname ===
      "/openapi.json"
    ) {

      return json({

        openapi:
          "3.1.0",

        info: {

          title:
            "FreshGate",

          version:
            "0.6.2",

          description:
            "Pay-per-call web freshness and change detection API for AI agents."
        },

        servers: [
          {
            url:
              ORIGIN
          }
        ],

        paths: {

          "/api/check-freshness": {

            get: {

              operationId:
                "checkWebPageFreshness",

              summary:
                "Check whether a web page changed",

              parameters: [

                {
                  name: "url",
                  in: "query",
                  required: true,

                  schema: {
                    type: "string",
                    format: "uri"
                  }
                },

                {
                  name: "ttl",
                  in: "query",
                  required: false,

                  schema: {
                    type: "integer",
                    default: 300
                  }
                }
              ],

              responses: {

                "200": {
                  description:
                    "Freshness result"
                },

                "402": {
                  description:
                    "Payment Required via x402"
                }
              }
            }
          }
        }
      });
    }


    // LLMS.TXT

    if (
      url.pathname ===
      "/llms.txt"
    ) {

      return text(
`# FreshGate

FreshGate is a pay-per-call web freshness and change-detection API for AI agents.

Price: $0.001 USDC
Network: Base mainnet
Protocol: x402
Scheme: exact

Paid endpoint:
${PAID_ENDPOINT}?url=https%3A%2F%2Fexample.com

Payment recipient:
${PAY_TO}

OpenAPI:
${ORIGIN}/openapi.json

x402 metadata:
${ORIGIN}/.well-known/x402

Discovery:
${ORIGIN}/discovery.json

An unpaid request returns HTTP 402 Payment Required.
`,
        "text/markdown; charset=utf-8"
      );
    }


    // ROBOTS

    if (
      url.pathname ===
      "/robots.txt"
    ) {

      return text(
`User-agent: *
Allow: /
`
      );
    }


    // EVERYTHING ELSE

    return v04.fetch(
      request,
      env,
      ctx
    );
  }
};