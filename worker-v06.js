import v05 from "./worker-v05.js";

const ORIGIN =
  "https://freshgate-api.franktherecensor.workers.dev";

const PAID_ENDPOINT =
  `${ORIGIN}/api/check-freshness`;

const OPENAPI =
  `${ORIGIN}/openapi.json`;

const X402_DISCOVERY =
  `${ORIGIN}/.well-known/x402`;

const PAY_TO =
  "0xdAFfFEdd9faA96d35b6D70715D073BC11475F25f";

function textResponse(body, contentType = "text/plain; charset=utf-8") {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*"
    }
  });
}

function jsonResponse(data) {
  return new Response(
    JSON.stringify(data, null, 2),
    {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=300",
        "access-control-allow-origin": "*"
      }
    }
  );
}

function llmsTxt() {
  return `# FreshGate

> FreshGate is a pay-per-call web freshness and change-detection API designed for AI agents. It helps an agent decide whether a public web page needs to be fetched again.

FreshGate uses the x402 payment protocol.

Price: $0.001 USDC per paid freshness check.
Network: Base mainnet.
Payment scheme: exact.
Payment recipient: ${PAY_TO}

The main paid endpoint accepts a public HTTP or HTTPS URL and returns freshness and change-detection information.

## API

- [Paid freshness endpoint](${PAID_ENDPOINT}?url=https%3A%2F%2Fexample.com): Check whether a public web page changed.
- [OpenAPI specification](${OPENAPI}): Machine-readable API documentation.
- [x402 discovery metadata](${X402_DISCOVERY}): x402 service and payment metadata.
- [Extended LLM documentation](${ORIGIN}/llms-full.txt): Detailed usage information.

## Usage

Call:

GET ${PAID_ENDPOINT}?url=https%3A%2F%2Fexample.com

Optional parameter:

ttl = maximum acceptable age of a previous check, in seconds.

A request without payment returns HTTP 402 Payment Required.

x402-compatible clients should read the payment requirements from the HTTP response and retry with a valid x402 payment.
`;
}

function llmsFullTxt() {
  return `# FreshGate

FreshGate is a lightweight freshness and change-detection service for AI agents.

Its purpose is to reduce unnecessary full-page downloads.

An agent can use FreshGate before fetching a URL. FreshGate checks the remote resource and returns information that helps the agent determine whether previously cached content can be reused or whether the page should be fetched again.

## Primary endpoint

GET ${PAID_ENDPOINT}

### Query parameters

url

Required.

A public HTTP or HTTPS URL.

Example:

https://example.com

ttl

Optional.

Maximum acceptable age, in seconds, for a previous FreshGate check.

Default:

300

## Example request

${PAID_ENDPOINT}?url=https%3A%2F%2Fexample.com&ttl=300

## Payment

Protocol:

x402

Scheme:

exact

Price:

0.001 USDC

Network:

Base mainnet

CAIP-2 network identifier:

eip155:8453

USDC contract on Base:

0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

Payment recipient:

${PAY_TO}

A request without valid payment returns:

HTTP 402 Payment Required

An x402-compatible client should inspect the payment requirements returned by the server, construct the required payment payload, and retry the request.

## Typical response

A successful paid request can contain fields such as:

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

hash

checked_at

checks

changes

## Agent decision model

FreshGate is intended to be called before an expensive or unnecessary full-page retrieval.

Typical workflow:

1. Agent wants content from a URL.
2. Agent calls FreshGate.
3. FreshGate determines current page freshness/change state.
4. If content is unchanged, the agent may reuse cached content.
5. If content changed, the agent can fetch the page again.

## Machine-readable documentation

OpenAPI:

${OPENAPI}

x402 discovery:

${X402_DISCOVERY}

Short LLM description:

${ORIGIN}/llms.txt

## Service identity

Name:

FreshGate

Category:

Web utility / freshness / change detection

Designed for:

AI agents, autonomous software and machine-to-machine API consumers.

Payment recipient:

${PAY_TO}
`;
}

function robotsTxt() {
  return `User-agent: *
Allow: /

Sitemap: ${ORIGIN}/sitemap.xml
`;
}

function sitemapXml() {
  const urls = [
    ORIGIN,
    `${ORIGIN}/llms.txt`,
    `${ORIGIN}/llms-full.txt`,
    `${ORIGIN}/openapi.json`,
    `${ORIGIN}/.well-known/x402`
  ];

  const entries = urls
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/llms.txt") {
      return textResponse(
        llmsTxt(),
        "text/markdown; charset=utf-8"
      );
    }

    if (url.pathname === "/llms-full.txt") {
      return textResponse(
        llmsFullTxt(),
        "text/markdown; charset=utf-8"
      );
    }

    if (url.pathname === "/robots.txt") {
      return textResponse(
        robotsTxt(),
        "text/plain; charset=utf-8"
      );
    }

    if (url.pathname === "/sitemap.xml") {
      return textResponse(
        sitemapXml(),
        "application/xml; charset=utf-8"
      );
    }

    if (url.pathname === "/discovery.json") {
      return jsonResponse({
        serviceName: "FreshGate",
        description:
          "Pay-per-call web freshness and change detection API for AI agents.",
        endpoint: PAID_ENDPOINT,
        openapi: OPENAPI,
        x402: X402_DISCOVERY,
        llms: `${ORIGIN}/llms.txt`,
        price: {
          amount: "0.001",
          currency: "USDC",
          network: "eip155:8453",
          scheme: "exact"
        },
        payTo: PAY_TO,
        tags: [
          "web",
          "freshness",
          "change-detection",
          "url-monitoring",
          "ai-agents"
        ]
      });
    }

    return v05.fetch(
      request,
      env,
      ctx
    );
  }
};