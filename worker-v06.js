import v04 from "./worker-v04.js";
import core from "./worker-v02.js";

const ORIGIN =
  "https://freshgate-api.franktherecensor.workers.dev";

const ENDPOINT =
  `${ORIGIN}/api/check-freshness`;

const FACILITATOR =
  "https://facilitator.payai.network";

const PAY_TO =
  "0xdAFfFEdd9faA96d35b6D70715D073BC11475F25f";

const NETWORK =
  "eip155:8453";

const USDC =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// $0.001 USDC = 1000 atomic units (6 decimals)
const AMOUNT =
  "1000";


const REQUIREMENT = {
  scheme: "exact",
  network: NETWORK,
  amount: AMOUNT,
  asset: USDC,
  payTo: PAY_TO,
  maxTimeoutSeconds: 60,

  extra: {
    name: "USDC",
    version: "2",
    facilitator: FACILITATOR
  }
};


const BAZAAR = {
  bazaar: {
    info: {
      input: {
        type: "http",
        method: "GET",

        queryParams: {
          url: "https://example.com",
          ttl: "300"
        }
      },

      output: {
        type: "json",

        example: {
          service: "FreshGate",
          version: "0.7.0",
          paid: true,
          price_usdc: 0.001,
          network: "base",
          url: "https://example.com/",
          reachable: true,
          status: 200,
          changed: false,
          recommendation: "skip"
        }
      }
    }
  }
};


function paymentRequiredObject(error) {
  return {
    x402Version: 2,

    error:
      error ||
      "PAYMENT-SIGNATURE header is required",

    resource: {
      url: ENDPOINT,

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
      ]
    },

    accepts: [
      REQUIREMENT
    ],

    extensions:
      BAZAAR
  };
}


function encodeBase64JSON(value) {
  const text =
    JSON.stringify(value);

  const bytes =
    new TextEncoder().encode(text);

  let binary = "";

  for (
    let i = 0;
    i < bytes.length;
    i++
  ) {
    binary +=
      String.fromCharCode(
        bytes[i]
      );
  }

  return btoa(binary);
}


function decodeBase64JSON(value) {
  let clean =
    value
      .trim()
      .replace(/-/g, "+")
      .replace(/_/g, "/");

  while (
    clean.length % 4
  ) {
    clean += "=";
  }

  const binary =
    atob(clean);

  const bytes =
    new Uint8Array(
      binary.length
    );

  for (
    let i = 0;
    i < binary.length;
    i++
  ) {
    bytes[i] =
      binary.charCodeAt(i);
  }

  const text =
    new TextDecoder().decode(
      bytes
    );

  return JSON.parse(text);
}


function corsHeaders() {
  return {
    "access-control-allow-origin":
      "*",

    "access-control-allow-methods":
      "GET, OPTIONS",

    "access-control-allow-headers":
      "Content-Type, PAYMENT-SIGNATURE, X-PAYMENT",

    "access-control-expose-headers":
      "PAYMENT-REQUIRED, PAYMENT-RESPONSE, EXTENSION-RESPONSES",

    "cache-control":
      "no-store"
  };
}


function jsonResponse(
  data,
  status = 200,
  extraHeaders = {}
) {
  return new Response(
    JSON.stringify(
      data,
      null,
      2
    ),

    {
      status,

      headers: {
        ...corsHeaders(),

        "content-type":
          "application/json; charset=utf-8",

        ...extraHeaders
      }
    }
  );
}


function textResponse(
  text,
  contentType =
    "text/plain; charset=utf-8"
) {
  return new Response(
    text,

    {
      status: 200,

      headers: {
        ...corsHeaders(),
        "content-type":
          contentType
      }
    }
  );
}


function paymentRequiredResponse(
  request,
  error
) {
  const challenge =
    paymentRequiredObject(
      error
    );

  const header =
    encodeBase64JSON(
      challenge
    );

  const accept =
    request.headers.get(
      "accept"
    ) || "";

  if (
    accept.includes(
      "text/html"
    )
  ) {
    return new Response(
`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Payment Required</title>
<style>
body{
font-family:system-ui,-apple-system,sans-serif;
max-width:760px;
margin:80px auto;
padding:24px;
}
h1{font-size:48px}
p{font-size:20px;line-height:1.5}
.box{
background:#fff4c7;
padding:24px;
border-radius:16px;
}
</style>
</head>
<body>

<h1>Payment Required</h1>

<p>
This resource is protected by the x402 payment protocol.
</p>

<div class="box">
<strong>FreshGate</strong><br><br>
Price: $0.001 USDC<br>
Network: Base mainnet<br>
Protocol: x402 v2<br>
Scheme: exact
</div>

</body>
</html>`,

      {
        status: 402,

        headers: {
          ...corsHeaders(),

          "content-type":
            "text/html; charset=utf-8",

          "PAYMENT-REQUIRED":
            header
        }
      }
    );
  }

  return jsonResponse(
    challenge,
    402,
    {
      "PAYMENT-REQUIRED":
        header
    }
  );
}


async function facilitatorCall(
  path,
  paymentPayload
) {
  const response =
    await fetch(
      `${FACILITATOR}${path}`,
      {
        method: "POST",

        headers: {
          "content-type":
            "application/json"
        },

        body: JSON.stringify({
          x402Version: 2,

          paymentPayload,

          paymentRequirements:
            REQUIREMENT
        })
      }
    );

  let data;

  try {
    data =
      await response.json();
  } catch {
    data = {
      error:
        "Invalid facilitator response"
    };
  }

  return {
    response,
    data
  };
}


async function handlePaidRequest(
  request,
  env,
  ctx
) {
  const url =
    new URL(
      request.url
    );

  const target =
    url.searchParams.get(
      "url"
    );

  const ttl =
    url.searchParams.get(
      "ttl"
    ) || "300";


  if (!target) {
    return jsonResponse(
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
    return jsonResponse(
      {
        error:
          "Invalid URL"
      },
      400
    );
  }


  // x402 v2
  const paymentHeader =
    request.headers.get(
      "PAYMENT-SIGNATURE"
    );


  if (!paymentHeader) {
    return paymentRequiredResponse(
      request
    );
  }


  let paymentPayload;

  try {
    paymentPayload =
      decodeBase64JSON(
        paymentHeader
      );
  } catch {
    return paymentRequiredResponse(
      request,
      "Invalid PAYMENT-SIGNATURE header"
    );
  }


  if (
    paymentPayload?.x402Version !== 2
  ) {
    return paymentRequiredResponse(
      request,
      "FreshGate requires x402 version 2"
    );
  }


  if (
    paymentPayload?.scheme !==
      "exact" ||
    paymentPayload?.network !==
      NETWORK
  ) {
    return paymentRequiredResponse(
      request,
      "Unsupported payment scheme or network"
    );
  }


  // -------------------------
  // VERIFY PAYMENT
  // -------------------------

  let verify;

  try {
    verify =
      await facilitatorCall(
        "/verify",
        paymentPayload
      );
  } catch (error) {
    console.error(
      "PayAI verify error:",
      error
    );

    return jsonResponse(
      {
        error:
          "Payment verification service unavailable"
      },
      503
    );
  }


  if (
    !verify.data?.isValid
  ) {
    return paymentRequiredResponse(
      request,
      verify.data?.invalidMessage ||
      verify.data?.invalidReason ||
      "Payment verification failed"
    );
  }


  // -------------------------
  // EXECUTE FRESHGATE
  // -------------------------

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


  let freshnessResponse;

  try {
    freshnessResponse =
      await core.fetch(
        new Request(
          internalUrl.toString()
        ),
        env,
        ctx
      );
  } catch (error) {
    console.error(
      "FreshGate internal error:",
      error
    );

    return jsonResponse(
      {
        error:
          "FreshGate internal check failed"
      },
      502
    );
  }


  let freshness;

  try {
    freshness =
      await freshnessResponse.json();
  } catch {
    return jsonResponse(
      {
        error:
          "Invalid FreshGate internal response"
      },
      502
    );
  }


  if (
    freshnessResponse.status >= 400
  ) {
    return jsonResponse(
      freshness,
      freshnessResponse.status
    );
  }


  // -------------------------
  // SETTLE PAYMENT
  // -------------------------

  let settlement;

  try {
    settlement =
      await facilitatorCall(
        "/settle",
        paymentPayload
      );
  } catch (error) {
    console.error(
      "PayAI settle error:",
      error
    );

    return jsonResponse(
      {
        error:
          "Payment settlement service unavailable"
      },
      503
    );
  }


  if (
    !settlement.data?.success
  ) {
    return jsonResponse(
      {
        error:
          "Payment settlement failed",

        reason:
          settlement.data?.errorReason ||
          "unknown",

        message:
          settlement.data?.errorMessage ||
          null
      },
      502
    );
  }


  const responseHeaders = {
    "PAYMENT-RESPONSE":
      encodeBase64JSON(
        settlement.data
      )
  };


  const extensionResponses =
    settlement.response.headers.get(
      "EXTENSION-RESPONSES"
    );


  if (extensionResponses) {
    responseHeaders[
      "EXTENSION-RESPONSES"
    ] =
      extensionResponses;
  }


  return jsonResponse(
    {
      service:
        "FreshGate",

      version:
        "0.7.0",

      paid:
        true,

      price_usdc:
        0.001,

      network:
        "base",

      ...freshness
    },
    200,
    responseHeaders
  );
}


function discovery() {
  return {
    serviceName:
      "FreshGate",

    description:
      "Pay-per-call web freshness and change detection API for AI agents.",

    endpoint:
      ENDPOINT,

    protocol:
      "x402",

    x402Version:
      2,

    price: {
      amount:
        "0.001",

      atomicAmount:
        AMOUNT,

      currency:
        "USDC",

      network:
        NETWORK,

      scheme:
        "exact"
    },

    asset:
      USDC,

    payTo:
      PAY_TO,

    facilitator:
      FACILITATOR,

    openapi:
      `${ORIGIN}/openapi.json`,

    x402:
      `${ORIGIN}/.well-known/x402`,

    llms:
      `${ORIGIN}/llms.txt`
  };
}


function openApi() {
  return {
    openapi:
      "3.1.0",

    info: {
      title:
        "FreshGate",

      version:
        "0.7.0",

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
            "checkFreshness",

          summary:
            "Check whether a web page changed",

          parameters: [
            {
              name: "url",
              in: "query",
              required: true,

              schema: {
                type:
                  "string",

                format:
                  "uri"
              }
            },

            {
              name: "ttl",
              in: "query",
              required: false,

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
                "Successful freshness check"
            },

            "402": {
              description:
                "x402 Payment Required"
            }
          }
        }
      }
    }
  };
}


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
      request.method ===
        "OPTIONS"
    ) {
      return new Response(
        null,
        {
          status: 204,
          headers:
            corsHeaders()
        }
      );
    }


    if (
      url.pathname ===
      "/api/check-freshness"
    ) {
      return handlePaidRequest(
        request,
        env,
        ctx
      );
    }


    if (
      url.pathname ===
      "/discovery.json"
    ) {
      return jsonResponse(
        discovery()
      );
    }


    if (
      url.pathname ===
      "/.well-known/x402"
    ) {
      return jsonResponse({
        x402Version: 2,

        resources: [
          {
            resource:
              ENDPOINT,

            method:
              "GET",

            serviceName:
              "FreshGate",

            description:
              "Pay-per-call web freshness and change detection API for AI agents.",

            accepts: [
              REQUIREMENT
            ],

            extensions:
              BAZAAR
          }
        ]
      });
    }


    if (
      url.pathname ===
      "/openapi.json"
    ) {
      return jsonResponse(
        openApi()
      );
    }


    if (
      url.pathname ===
      "/llms.txt"
    ) {
      return textResponse(
`# FreshGate

FreshGate is a pay-per-call web freshness and change-detection API for AI agents.

Protocol: x402 v2
Price: $0.001 USDC
Network: Base mainnet
Scheme: exact

Endpoint:
${ENDPOINT}?url=https%3A%2F%2Fexample.com

Payment recipient:
${PAY_TO}

Facilitator:
${FACILITATOR}

Discovery:
${ORIGIN}/discovery.json

OpenAPI:
${ORIGIN}/openapi.json

x402:
${ORIGIN}/.well-known/x402
`,
        "text/markdown; charset=utf-8"
      );
    }


    if (
      url.pathname ===
      "/api/x402-status"
    ) {
      return jsonResponse({
        service:
          "FreshGate",

        version:
          "0.7.0",

        status:
          "online",

        x402Version:
          2,

        network:
          NETWORK,

        scheme:
          "exact",

        price:
          "$0.001",

        payTo:
          PAY_TO,

        facilitator:
          FACILITATOR,

        bazaar:
          true
      });
    }


    if (
      url.pathname ===
      "/robots.txt"
    ) {
      return textResponse(
`User-agent: *
Allow: /
`
      );
    }


    return v04.fetch(
      request,
      env,
      ctx
    );
  }
};