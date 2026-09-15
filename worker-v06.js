import { Hono } from "hono";

import {
  paymentMiddleware,
  x402ResourceServer
} from "@x402/hono";

import {
  ExactEvmScheme
} from "@x402/evm/exact/server";

import {
  HTTPFacilitatorClient
} from "@x402/core/server";

import {
  declareDiscoveryExtension
} from "@x402/extensions/bazaar";

import {
  facilitator
} from "@payai/facilitator";

import v04 from "./worker-v04.js";
import core from "./worker-v02.js";


const PAY_TO =
  "0xdAFfFEdd9faA96d35b6D70715D073BC11475F25f";

const ORIGIN =
  "https://freshgate-api.franktherecensor.workers.dev";

const NETWORK =
  "eip155:8453";


const facilitatorClient =
  new HTTPFacilitatorClient(
    facilitator
  );

const resourceServer =
  new x402ResourceServer(
    facilitatorClient
  ).register(
    NETWORK,
    new ExactEvmScheme()
  );


const app = new Hono();


const paidRoutes = {
  "GET /api/check-freshness": {
    accepts: [
      {
        scheme: "exact",
        price: "$0.001",
        network: NETWORK,
        payTo: PAY_TO
      }
    ],

    description:
      "Check whether a public web page has changed before fetching it again.",

    mimeType:
      "application/json",

    serviceName:
      "FreshGate",

    tags: [
      "web",
      "freshness",
      "change-detection",
      "url-monitoring",
      "ai-agents"
    ],

    extensions: {
      ...declareDiscoveryExtension({
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
                "Maximum acceptable age of a previous check in seconds"
            }
          },

          required: [
            "url"
          ]
        },

        output: {
          example: {
            service: "FreshGate",
            version: "0.6",
            paid: true,
            price_usdc: 0.001,
            network: "base",
            url: "https://example.com/",
            reachable: true,
            status: 200,
            changed: false,
            recommendation: "skip",
            source: "remote"
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
      })
    }
  }
};


/*
 * IMPORTANTE:
 * middleware applicato come nell'esempio ufficiale PayAI/Hono.
 */
app.use(
  paymentMiddleware(
    paidRoutes,
    resourceServer
  )
);


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


    let parsed;

    try {
      parsed =
        new URL(target);

      if (
        parsed.protocol !== "http:" &&
        parsed.protocol !== "https:"
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
          "0.6",

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


app.get(
  "/.well-known/x402",
  (c) => {

    return c.json({
      version: 2,

      resources: [
        {
          url:
            `${ORIGIN}/api/check-freshness`,

          method:
            "GET",

          serviceName:
            "FreshGate",

          description:
            "Pay-per-call web freshness and change detection API for AI agents.",

          tags: [
            "web",
            "freshness",
            "change-detection",
            "url-monitoring",
            "ai-agents"
          ],

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
          "0.6",

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

            description:
              "Check a public URL before downloading it again. Costs $0.001 USDC.",

            parameters: [
              {
                name:
                  "url",

                in:
                  "query",

                required:
                  true,

                schema: {
                  type:
                    "string",

                  format:
                    "uri"
                }
              },

              {
                name:
                  "ttl",

                in:
                  "query",

                required:
                  false,

                schema: {
                  type:
                    "integer",

                  default:
                    300
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
              },

              "400": {
                description:
                  "Invalid request"
              }
            }
          }
        }
      }
    });
  }
);


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