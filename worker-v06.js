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

const TAGS = [
  "utility",
  "web",
  "freshness",
  "change-detection",
  "ai-agents"
];


// ==================================================
// PAYAI + X402
// ==================================================

const facilitatorClient =
  new HTTPFacilitatorClient(
    facilitator
  );

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
// BAZAAR
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
            "Public HTTP or HTTPS URL to check"
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
          "0.6.1",

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
          "remote"
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

          changed: {
            type:
              "boolean"
          },

          recommendation: {
            type:
              "string"
          }
        }
      }
    }
  });


// ==================================================
// HONO — SOLO ROTTA PAGATA
// ==================================================

const app =
  new Hono();


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
      "Pay-per-call web freshness and change detection API for AI agents.",

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
  "/api/check-freshness",

  paymentMiddleware(
    paidRoutes,
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
          "0.6.1",

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
// ERROR LOGGING
// ==================================================

app.onError(
  (err, c) => {

    console.error(
      "FreshGate x402 error",
      err?.message || err,
      err?.stack || ""
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
// HELPERS
// ==================================================

function textResponse(
  body,
  contentType = "text/plain; charset=utf-8"
) {

  return new Response(
    body,
    {
      status:
        200,

      headers: {

        "content-type":
          contentType,

        "cache-control":
          "public, max-age=300",

        "access-control-allow-origin":
          "*"
      }
    }
  );
}


function jsonResponse(data) {

  return new Response(
    JSON.stringify(
      data,
      null,
      2
    ),

    {
      status:
        200,

      headers: {

        "content-type":
          "application/json; charset=utf-8",

        "cache-control":
          "public, max-age=300",

        "access-control-allow-origin":
          "*"
      }
    }
  );
}


// ==================================================
// LLMS.TXT
// ==================================================

function llmsTxt() {

  return `# FreshGate

> FreshGate is a pay-per-call web freshness and change-detection API designed for AI agents.

FreshGate helps an AI agent determine whether a public web page has changed before fetching the complete page again.

Protocol: x402
Price: $0.001 USDC
Network: Base mainnet
CAIP-2: eip155:8453
Payment scheme: exact
Payment recipient: ${PAY_TO}

## API

Paid endpoint:

GET ${PAID_ENDPOINT}?url=https%3A%2F%2Fexample.com

Optional parameter:

ttl=300

## Documentation

OpenAPI:
${ORIGIN}/openapi.json

x402 metadata:
${ORIGIN}/.well-known/x402

Discovery:
${ORIGIN}/discovery.json

Extended documentation:
${ORIGIN}/llms-full.txt

A request without a valid x402 payment returns HTTP 402 Payment Required.

x402-compatible agents should read the payment requirements from the 402 response and retry with a valid payment.
`;
}


// ==================================================
// LLMS FULL
// ==================================================

function llmsFullTxt() {

  return `# FreshGate

FreshGate is a web freshness and change-detection API designed for AI agents and autonomous software.

The service can be called before downloading a web page again.

## Why use FreshGate?

An AI agent may already have cached content for a URL.

Instead of downloading the entire page again, the agent can ask FreshGate whether the resource has changed.

## Paid endpoint

GET ${PAID_ENDPOINT}

Required query parameter:

url

Example:

${PAID_ENDPOINT}?url=https%3A%2F%2Fexample.com

Optional query parameter:

ttl

Default:

300 seconds

## x402 payment

Price:

0.001 USDC

Network:

Base mainnet

CAIP-2 network:

eip155:8453

Scheme:

exact

Recipient:

${PAY_TO}

An unpaid request returns HTTP 402 Payment Required.

The client reads the x402 payment requirements, signs the required payment and retries the request.

## Typical response fields

service
version
paid
price_usdc
network
url
final_url
reachable
status
changed
recommendation
source
checked_at
checks
changes
hash

## Typical agent workflow

1. Agent needs information from a URL.
2. Agent calls FreshGate.
3. FreshGate checks whether the URL changed.
4. If unchanged, the agent may use cached information.
5. If changed, the agent can fetch the page again.

## Machine-readable resources

OpenAPI:
${ORIGIN}/openapi.json

x402:
${ORIGIN}/.well-known/x402

Discovery:
${ORIGIN}/discovery.json

LLM:
${ORIGIN}/llms.txt
`;
}


// ==================================================
// ROBOTS
// ==================================================

function robotsTxt() {

  return `User-agent: *
Allow: /

Sitemap: ${ORIGIN}/sitemap.xml
`;
}


// ==================================================
// SITEMAP
// ==================================================

function sitemapXml() {

  const urls = [
    ORIGIN,
    `${ORIGIN}/llms.txt`,
    `${ORIGIN}/llms-full.txt`,
    `${ORIGIN}/openapi.json`,
    `${ORIGIN}/.well-known/x402`,
    `${ORIGIN}/discovery.json`
  ];


  const entries =
    urls
      .map(
        url => `  <url>
    <loc>${url}</loc>
  </url>`
      )
      .join("\n");


  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>`;
}


// ==================================================
// X402 PUBLIC METADATA
// ==================================================

function x402Metadata() {

  return {

    x402Version:
      2,

    version:
      2,

    resources: [

      {

        resource:
          PAID_ENDPOINT,

        url:
          PAID_ENDPOINT,

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
  };
}


// ==================================================
// DISCOVERY.JSON
// ==================================================

function discoveryJson() {

  return {

    serviceName:
      "FreshGate",

    description:
      "Pay-per-call web freshness and change detection API for AI agents.",

    endpoint:
      PAID_ENDPOINT,

    openapi:
      `${ORIGIN}/openapi.json`,

    x402:
      `${ORIGIN}/.well-known/x402`,

    llms:
      `${ORIGIN}/llms.txt`,

    price: {

      amount:
        "0.001",

      currency:
        "USDC",

      network:
        NETWORK,

      scheme:
        "exact"
    },

    payTo:
      PAY_TO,

    tags:
      TAGS
  };
}


// ==================================================
// OPENAPI
// ==================================================

function openApi() {

  return {

    openapi:
      "3.1.0",

    info: {

      title:
        "FreshGate",

      version:
        "0.6.1",

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
            "Check a URL before fetching the complete page again. Requires a $0.001 USDC x402 payment on Base.",

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
                  300,

                minimum:
                  0,

                maximum:
                  86400
              }
            }
          ],

          responses: {

            "200": {
              description:
                "Successful paid freshness check"
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
  };
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


    // -----------------------------
    // PAID ENDPOINT
    // -----------------------------

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


    // -----------------------------
    // LLMS
    // -----------------------------

    if (
      url.pathname ===
      "/llms.txt"
    ) {

      return textResponse(
        llmsTxt(),
        "text/markdown; charset=utf-8"
      );
    }


    if (
      url.pathname ===
      "/llms-full.txt"
    ) {

      return textResponse(
        llmsFullTxt(),
        "text/markdown; charset=utf-8"
      );
    }


    // -----------------------------
    // DISCOVERY
    // -----------------------------

    if (
      url.pathname ===
      "/discovery.json"
    ) {

      return jsonResponse(
        discoveryJson()
      );
    }


    if (
      url.pathname ===
      "/.well-known/x402"
    ) {

      return jsonResponse(
        x402Metadata()
      );
    }


    if (
      url.pathname ===
      "/openapi.json"
    ) {

      return jsonResponse(
        openApi()
      );
    }


    // -----------------------------
    // ROBOTS / SITEMAP
    // -----------------------------

    if (
      url.pathname ===
      "/robots.txt"
    ) {

      return textResponse(
        robotsTxt()
      );
    }


    if (
      url.pathname ===
      "/sitemap.xml"
    ) {

      return textResponse(
        sitemapXml(),
        "application/xml; charset=utf-8"
      );
    }


    // -----------------------------
    // X402 STATUS
    // -----------------------------

    if (
      url.pathname ===
      "/api/x402-status"
    ) {

      return jsonResponse({

        service:
          "FreshGate",

        version:
          "0.6.1",

        status:
          "online",

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
          PAID_ENDPOINT
      });
    }


    // -----------------------------
    // EVERYTHING ELSE -> OLD APP
    // -----------------------------

    return v04.fetch(
      request,
      env,
      ctx
    );
  }
};