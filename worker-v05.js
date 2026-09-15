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
  declareDiscoveryExtension,
  bazaarResourceServerExtension
} from "@x402/extensions/bazaar";

import {
  facilitator
} from "@payai/facilitator";

import v04 from "./worker-v04.js";
import core from "./worker-v02.js";


// ==================================================
// FRESHGATE CONFIG
// ==================================================

const PAY_TO =
  "0xdAFfFEdd9faA96d35b6D70715D073BC11475F25f";

const ORIGIN =
  "https://freshgate-api.franktherecensor.workers.dev";

const NETWORK =
  "eip155:8453";

const PRICE =
  "$0.001";

const TAGS = [
  "utility",
  "web",
  "freshness",
  "change-detection",
  "url-monitoring",
  "ai-agents"
];


// ==================================================
// PAYAI FACILITATOR
// ==================================================

const facilitatorClient =
  new HTTPFacilitatorClient(
    facilitator
  );


// ==================================================
// X402 RESOURCE SERVER
// ==================================================

const resourceServer =
  new x402ResourceServer(
    facilitatorClient
  )
    .register(
      NETWORK,
      new ExactEvmScheme()
    )
    .registerExtension(
      bazaarResourceServerExtension
    );


// ==================================================
// HONO
// ==================================================

const app =
  new Hono();


// ==================================================
// BAZAAR DISCOVERY METADATA
// ==================================================

const bazaarDiscovery =
  declareDiscoveryExtension({

    input: {
      url:
        "https://example.com",

      ttl:
        300
    },

    inputSchema: {

      type:
        "object",

      properties: {

        url: {
          type:
            "string",

          format:
            "uri",

          description:
            "Public HTTP or HTTPS URL whose freshness should be checked"
        },

        ttl: {
          type:
            "integer",

          minimum:
            0,

          maximum:
            86400,

          description:
            "Maximum acceptable age of a previous check in seconds"
        }
      },

      required: [
        "url"
      ]
    },

    output: {

      example: {

        service:
          "FreshGate",

        version:
          "0.6.0",

        paid:
          true,

        price_usdc:
          0.001,

        network:
          "base",

        url:
          "https://example.com/",

        final_url:
          "https://example.com/",

        reachable:
          true,

        status:
          200,

        changed:
          false,

        recommendation:
          "skip",

        source:
          "remote",

        checked_at:
          1789467366,

        checks:
          1,

        changes:
          0,

        hash:
          "example-content-hash"
      }
    }
  });


// ==================================================
// PAID X402 ROUTE
// ==================================================

const paidRoutes = {

  "GET /api/check-freshness": {

    accepts: [
      {
        scheme:
          "exact",

        price:
          PRICE,

        network:
          NETWORK,

        payTo:
          PAY_TO
      }
    ],

    description:
      "Pay-per-call web freshness and change detection API for AI agents. Check whether a public web page changed before fetching it again.",

    mimeType:
      "application/json",

    serviceName:
      "FreshGate",

    tags:
      TAGS,

    extensions: {
      ...bazaarDiscovery
    }
  }
};


// ==================================================
// PAYMENT MIDDLEWARE
// ==================================================

app.use(
  paymentMiddleware(
    paidRoutes,
    resourceServer
  )
);


// ==================================================
// PAID API
// ==================================================

app.get(
  "/api/check-freshness",

  async (c) => {

    const target =
      c.req.query(
        "url"
      );

    const ttl =
      c.req.query(
        "ttl"
      ) || "300";


    if (!target) {

      return c.json(
        {
          error:
            "Missing url parameter"
        },
        400
      );
    }


    let parsed;

    try {

      parsed =
        new URL(
          target
        );


      if (
        parsed.protocol !==
          "http:" &&
        parsed.protocol !==
          "https:"
      ) {

        throw new Error(
          "Invalid protocol"
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


    let result;

    try {

      result =
        await response.json();

    } catch {

      return c.json(
        {
          error:
            "FreshGate internal freshness check failed"
        },
        502
      );
    }


    return c.json(
      {

        service:
          "FreshGate",

        version:
          "0.6.0",

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
// WELL KNOWN X402
// ==================================================

app.get(
  "/.well-known/x402",

  (c) => {

    return c.json({

      x402Version:
        2,

      version:
        2,

      resources: [

        {

          resource:
            `${ORIGIN}/api/check-freshness`,

          url:
            `${ORIGIN}/api/check-freshness`,

          method:
            "GET",

          type:
            "http",

          serviceName:
            "FreshGate",

          description:
            "Pay-per-call web freshness and change detection API for AI agents.",

          mimeType:
            "application/json",

          tags:
            TAGS,

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
);


// ==================================================
// OPENAPI
// ==================================================

app.get(
  "/openapi.json",

  (c) => {

    return c.json({

      openapi:
        "3.1.0",

      info: {

        title:
          "FreshGate",

        version:
          "0.6.0",

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
              "Check whether a public web page changed",

            description:
              "Checks whether a URL changed before an AI agent fetches the complete page. Payment: $0.001 USDC via x402 on Base.",

            tags: [
              "FreshGate"
            ],

            parameters: [

              {

                name:
                  "url",

                in:
                  "query",

                required:
                  true,

                description:
                  "Public HTTP or HTTPS URL to check",

                schema: {

                  type:
                    "string",

                  format:
                    "uri"
                },

                example:
                  "https://example.com"
              },

              {

                name:
                  "ttl",

                in:
                  "query",

                required:
                  false,

                description:
                  "Maximum acceptable age of the previous check in seconds",

                schema: {

                  type:
                    "integer",

                  minimum:
                    0,

                  maximum:
                    86400,

                  default:
                    300
                }
              }
            ],

            responses: {

              "200": {

                description:
                  "Freshness result returned after successful x402 payment"
              },

              "400": {

                description:
                  "Invalid URL or request"
              },

              "402": {

                description:
                  "Payment Required via x402"
              },

              "500": {

                description:
                  "Internal server error"
              }
            }
          }
        }
      }
    });
  }
);


// ==================================================
// HEALTH CHECK
// ==================================================

app.get(
  "/api/x402-status",

  (c) => {

    return c.json({

      service:
        "FreshGate",

      version:
        "0.6.0",

      x402:
        true,

      facilitator:
        "PayAI",

      network:
        NETWORK,

      price:
        PRICE,

      payTo:
        PAY_TO,

      bazaar:
        true,

      endpoint:
        `${ORIGIN}/api/check-freshness`,

      status:
        "online"
    });
  }
);


// ==================================================
// ERROR LOGGING
// ==================================================

app.onError(
  (err, c) => {

    console.error(
      "FreshGate x402 error:",
      err
    );

    return c.json(
      {
        error:
          "Internal Server Error",

        component:
          "FreshGate x402"
      },
      500
    );
  }
);


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


    if (
      url.pathname ===
        "/api/check-freshness" ||

      url.pathname ===
        "/api/x402-status" ||

      url.pathname ===
        "/.well-known/x402" ||

      url.pathname ===
        "/openapi.json"
    ) {

      return app.fetch(
        request,
        env,
        ctx
      );
    }


    return v04.fetch(
      request,
      env,
      ctx
    );
  }
};