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

const PAY_TO =
  "0xdAFfFEdd9faA96d35b6D70715D073BC11475F25f";

const PRICE_USD = "0.001";

const ORIGIN =
  "https://freshgate-api.franktherecensor.workers.dev";

const NETWORK =
  "eip155:8453";

const BASE_USDC =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const FACILITATOR_URL =
  "https://facilitator.payai.network";

const TAGS = [
  "web",
  "freshness",
  "change-detection",
  "url-monitoring",
  "ai-agents"
];


// --------------------------------------------------
// FACILITATOR + BASE MAINNET
// --------------------------------------------------

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


// --------------------------------------------------
// BAZAAR DISCOVERY
// --------------------------------------------------

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
            "Public HTTP or HTTPS URL whose content freshness should be checked"
        },

        ttl: {
          type:
            "integer",

          minimum:
            0,

          maximum:
            86400,

          description:
            "Maximum acceptable age of a previous FreshGate check in seconds"
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
          "https://example.com",

        final_url:
          "https://example.com",

        reachable:
          true,

        status:
          200,

        changed:
          false,

        recommendation:
          "reuse_previous_content",

        hash:
          "example-content-hash",

        checked_at:
          0,

        checks:
          1,

        changes:
          0
      },

      schema: {
        type:
          "object",

        properties: {

          service: {
            type:
              "string"
          },

          version: {
            type:
              "string"
          },

          paid: {
            type:
              "boolean"
          },

          price_usdc: {
            type:
              "number"
          },

          network: {
            type:
              "string"
          },

          url: {
            type:
              "string"
          },

          final_url: {
            type:
              "string"
          },

          reachable: {
            type:
              "boolean"
          },

          status: {
            type:
              "integer"
          },

          changed: {},

          recommendation: {
            type:
              "string"
          },

          hash: {
            type:
              "string"
          },

          checked_at: {},

          checks: {},

          changes: {}
        }
      }
    }
  });


// --------------------------------------------------
// HONO
// --------------------------------------------------

const app =
  new Hono();


// --------------------------------------------------
// X402 PAID ROUTE
// --------------------------------------------------

const paidRoutes = {

  "GET /api/check-freshness": {

    accepts: [
      {
        scheme:
          "exact",

        price:
          "$0.001",

        network:
          NETWORK,

        payTo:
          PAY_TO
      }
    ],

    description:
      "Check whether a public web page changed before fetching it again. Useful for AI agents that want to avoid unnecessary web fetches.",

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


app.use(
  paymentMiddleware(
    paidRoutes,
    resourceServer
  )
);


// --------------------------------------------------
// OPENAPI
// --------------------------------------------------

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
          "Pay-per-call web freshness and change detection API for AI agents.",

        "x-guidance":
          "Use FreshGate before fetching a public URL. It checks whether the page changed so an agent can avoid unnecessary full web fetches."
      },

      servers: [
        {
          url:
            ORIGIN
        }
      ],

      "x-discovery": {

        ownershipProofs: [
          PAY_TO
        ]
      },

      paths: {

        "/api/check-freshness": {

          get: {

            operationId:
              "checkWebPageFreshness",

            summary:
              "Check whether a web page changed",

            description:
              "Use before re-fetching a public URL. Returns status, hash, change state and freshness metadata. Costs $0.001 USDC.",

            tags:
              TAGS,

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
                  "Maximum acceptable age of a previous check in seconds",

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

            "x-payment-info": {

              protocols: [
                {
                  x402: {}
                }
              ],

              price: {

                mode:
                  "fixed",

                currency:
                  "USD",

                amount:
                  PRICE_USD
              },

              scheme:
                "exact",

              network:
                NETWORK,

              amount:
                "1000",

              asset:
                BASE_USDC,

              payTo:
                PAY_TO,

              maxTimeoutSeconds:
                60,

              extra: {

                name:
                  "USDC",

                version:
                  "2"
              }
            },

            responses: {

              "200": {

                description:
                  "Freshness result",

                content: {

                  "application/json": {

                    schema: {

                      type:
                        "object",

                      properties: {

                        service: {
                          type:
                            "string"
                        },

                        version: {
                          type:
                            "string"
                        },

                        paid: {
                          type:
                            "boolean"
                        },

                        price_usdc: {
                          type:
                            "number"
                        },

                        network: {
                          type:
                            "string"
                        },

                        url: {
                          type:
                            "string"
                        },

                        final_url: {
                          type:
                            "string"
                        },

                        reachable: {
                          type:
                            "boolean"
                        },

                        status: {
                          type:
                            "integer"
                        },

                        changed: {},

                        recommendation: {
                          type:
                            "string"
                        },

                        hash: {
                          type:
                            "string"
                        },

                        checked_at: {},

                        checks: {},

                        changes: {}
                      }
                    }
                  }
                }
              },

              "402": {

                description:
                  "Payment Required via x402"
              },

              "400": {

                description:
                  "Invalid URL"
              }
            }
          }
        }
      }
    });
  }
);


// --------------------------------------------------
// X402 DISCOVERY
// --------------------------------------------------

app.get(
  "/.well-known/x402",
  (c) => {

    return c.json({

      version:
        2,

      resources: [

        {
          url:
            `${ORIGIN}/api/check-freshness`,

          method:
            "GET",

          serviceName:
            "FreshGate",

          description:
            "Check whether a public web page changed before fetching it again.",

          tags:
            TAGS,

          price:
            "$0.001",

          currency:
            "USDC",

          network:
            NETWORK,

          payTo:
            PAY_TO
        }
      ]
    });
  }
);


// --------------------------------------------------
// PAID API
// --------------------------------------------------

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


    const result =
      await response.json();


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


// --------------------------------------------------
// MAIN WORKER
// --------------------------------------------------

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
        "/openapi.json" ||

      url.pathname ===
        "/.well-known/x402" ||

      url.pathname ===
        "/api/check-freshness"
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