import { Hono } from "hono";
import {
  paymentMiddleware,
  x402ResourceServer
} from "@x402/hono";

import {
  HTTPFacilitatorClient
} from "@x402/core/server";

import {
  registerExactEvmScheme
} from "@x402/evm/exact/server";

import v04 from "./worker-v04.js";
import core from "./worker-v02.js";

const PAY_TO =
  "0xdAFfFEdd9faA96d35b6D70715D073BC11475F25f";

const PRICE_USD = "0.001";

const ORIGIN =
  "https://freshgate-api.franktherecensor.workers.dev";

const BASE_USDC =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const facilitatorClient =
  new HTTPFacilitatorClient({
    url: "https://x402.org/facilitator"
  });

const resourceServer =
  new x402ResourceServer(
    facilitatorClient
  );

registerExactEvmScheme(
  resourceServer
);

const app = new Hono();

app.use(
  paymentMiddleware(
    {
      "GET /api/check-freshness": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.001",
            network: "eip155:8453",
            payTo: PAY_TO
          }
        ],

        description:
          "Check whether a public web page has changed before fetching it again.",

        mimeType:
          "application/json"
      }
    },

    resourceServer
  )
);


// ---------- OPENAPI DISCOVERY ----------

app.get(
  "/openapi.json",
  (c) => {
    return c.json({
      openapi: "3.1.0",

      info: {
        title: "FreshGate",
        version: "0.5.0",

        description:
          "Pay-per-call web freshness API for AI agents.",

        "x-guidance":
          "Use GET /api/check-freshness before re-fetching a public URL. FreshGate checks whether the page changed and returns freshness and hash metadata."
      },

      servers: [
        {
          url: ORIGIN
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
              "Use before re-fetching a public URL. Returns page status, content hash, change state and FreshGate metadata.",

            parameters: [
              {
                name: "url",
                in: "query",
                required: true,

                description:
                  "Public HTTP or HTTPS URL to check",

                schema: {
                  type: "string",
                  format: "uri"
                }
              },

              {
                name: "ttl",
                in: "query",
                required: false,

                description:
                  "Maximum acceptable age of a previous check in seconds",

                schema: {
                  type: "integer",
                  minimum: 0,
                  maximum: 86400,
                  default: 300
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
                mode: "fixed",
                currency: "USD",
                amount: PRICE_USD
              },

              scheme: "exact",
              network: "eip155:8453",

              amount: "1000",

              asset: BASE_USDC,

              payTo: PAY_TO,

              maxTimeoutSeconds: 60,

              extra: {
                name: "USDC",
                version: "2"
              }
            },

            responses: {
              "200": {
                description:
                  "Freshness result",

                content: {
                  "application/json": {
                    schema: {
                      type: "object",

                      properties: {
                        url: {
                          type: "string"
                        },

                        reachable: {
                          type: "boolean"
                        },

                        status: {
                          type: "integer"
                        },

                        changed: {},

                        recommendation: {
                          type: "string"
                        },

                        hash: {
                          type: "string"
                        },

                        checked_at: {}
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


// ---------- X402 COMPATIBILITY DISCOVERY ----------

app.get(
  "/.well-known/x402",
  (c) => {
    return c.json({
      version: 1,

      resources: [
        `${ORIGIN}/api/check-freshness`
      ],

      ownershipProofs: [
        PAY_TO
      ]
    });
  }
);


// ---------- PAID HTTP API ----------

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
      parsed = new URL(target);

      if (
        parsed.protocol !== "http:" &&
        parsed.protocol !== "https:"
      ) {
        throw new Error();
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
        service: "FreshGate",
        version: "0.5.0",

        paid: true,
        price_usdc: 0.001,
        network: "base",

        ...result
      },
      response.status
    );
  }
);


// ---------- WORKER ----------

export default {
  async fetch(
    request,
    env,
    ctx
  ) {

    const url =
      new URL(request.url);

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

    // Tutto ciò che già funziona
    // resta gestito dalla v0.4
    return v04.fetch(
      request,
      env,
      ctx
    );
  }
};