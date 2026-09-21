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

const AMOUNT =
  "1000"; // $0.001 USDC


const REQUIREMENT = {
  scheme: "exact",

  network:
    NETWORK,

  amount:
    AMOUNT,

  asset:
    USDC,

  payTo:
    PAY_TO,

  maxTimeoutSeconds:
    60,

  extra: {
    assetTransferMethod:
      "eip3009",

    name:
      "USD Coin",

    version:
      "2"
  }
};


const BAZAAR = {
  bazaar: {
    info: {
      input: {
        type:
          "http",

        method:
          "GET",

        queryParams: {
          url:
            "https://example.com",

          ttl:
            "300"
        }
      },

      output: {
        type:
          "json",

        example: {
          service:
            "FreshGate",

          version:
            "0.8.0",

          paid:
            true,

          price_usdc:
            0.001,

          network:
            "base",

          url:
            "https://example.com/",

          reachable:
            true,

          status:
            200,

          changed:
            false,

          recommendation:
            "skip"
        }
      }
    },

    schema: {
      type:
        "object",

      properties: {
        input: {
          type:
            "object",

          properties: {
            type: {
              type:
                "string",

              const:
                "http"
            },

            method: {
              type:
                "string",

              enum: [
                "GET"
              ]
            },

            queryParams: {
              type:
                "object",

              properties: {
                url: {
                  type:
                    "string",

                  format:
                    "uri",

                  description:
                    "Public HTTP or HTTPS URL to check for freshness and changes."
                },

                ttl: {
                  type:
                    "string",

                  pattern:
                    "^[0-9]+$",

                  description:
                    "Cache TTL in seconds."
                }
              },

              required: [
                "url"
              ]
            }
          },

          required: [
            "type",
            "method",
            "queryParams"
          ]
        },

        output: {
          type:
            "object",

          properties: {
            type: {
              type:
                "string",

              const:
                "json"
            },

            example: {
              type:
                "object"
            }
          },

          required: [
            "type",
            "example"
          ]
        }
      },

      required: [
        "input",
        "output"
      ]
    }
  }
};


function paymentRequiredObject(error) {
  return {
    x402Version:
      2,

    error:
      error ||
      "PAYMENT-SIGNATURE header is required",

    resource: {
      url:
        ENDPOINT,

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
  const bytes =
    new TextEncoder().encode(
      JSON.stringify(value)
    );

  let binary =
    "";

  for (const b of bytes) {
    binary +=
      String.fromCharCode(b);
  }

  return btoa(binary);
}


function decodeBase64JSON(value) {
  let clean =
    String(value || "")
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

  return JSON.parse(
    new TextDecoder().decode(
      bytes
    )
  );
}


function decodeBase64Text(value) {
  try {
    let clean =
      String(value || "")
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

    return new TextDecoder()
      .decode(bytes);

  } catch {
    return null;
  }
}


function sameAddress(
  a,
  b
) {
  return (
    typeof a ===
      "string" &&

    typeof b ===
      "string" &&

    a.toLowerCase() ===
      b.toLowerCase()
  );
}


function acceptedRequirementIsValid(
  accepted
) {
  return !!(
    accepted &&

    accepted.scheme ===
      REQUIREMENT.scheme &&

    accepted.network ===
      REQUIREMENT.network &&

    String(
      accepted.amount
    ) ===
      REQUIREMENT.amount &&

    sameAddress(
      accepted.asset,
      REQUIREMENT.asset
    ) &&

    sameAddress(
      accepted.payTo,
      REQUIREMENT.payTo
    ) &&

    Number(
      accepted.maxTimeoutSeconds
    ) ===
      REQUIREMENT.maxTimeoutSeconds
  );
}


function canonicalPaymentPayload(
  paymentPayload
) {
  return {
    ...paymentPayload,

    resource:
      paymentRequiredObject()
        .resource,

    accepted:
      REQUIREMENT,

    extensions: {
      ...(
        paymentPayload
          ?.extensions ||
        {}
      ),

      bazaar:
        BAZAAR.bazaar
    }
  };
}


function corsHeaders() {
  return {
    "access-control-allow-origin":
      "*",

    "access-control-allow-methods":
      "GET, POST, OPTIONS",

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
      status:
        200,

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

<meta
name="viewport"
content="width=device-width,initial-scale=1">

<title>
Payment Required
</title>

<style>

body {
font-family:
system-ui,
-apple-system,
sans-serif;

max-width:
760px;

margin:
80px auto;

padding:
24px;
}

h1 {
font-size:
48px;
}

.box {
background:
#fff4c7;

padding:
24px;

border-radius:
16px;

font-size:
18px;
}

</style>
</head>

<body>

<h1>
Payment Required
</h1>

<p>
This resource is protected by the x402 payment protocol.
</p>

<div class="box">

<b>
FreshGate
</b>

<br><br>

Price:
$0.001 USDC

<br>

Network:
Base mainnet

<br>

Protocol:
x402 v2

<br>

Scheme:
exact

</div>

</body>
</html>`,

      {
        status:
          402,

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
        method:
          "POST",

        headers: {
          "content-type":
            "application/json"
        },

        body:
          JSON.stringify({
            x402Version:
              2,

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
    ) ||
    "300";


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
    paymentPayload
      ?.x402Version !== 2
  ) {
    return paymentRequiredResponse(
      request,
      "FreshGate requires x402 version 2"
    );
  }


  if (
    !acceptedRequirementIsValid(
      paymentPayload
        ?.accepted
    )
  ) {
    return paymentRequiredResponse(
      request,
      "Payment requirements do not match FreshGate"
    );
  }


  paymentPayload =
    canonicalPaymentPayload(
      paymentPayload
    );


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
    !verify.data
      ?.isValid
  ) {
    return paymentRequiredResponse(
      request,

      verify.data
        ?.invalidMessage ||

      verify.data
        ?.invalidReason ||

      "Payment verification failed"
    );
  }


  const internalUrl =
    new URL(
      "/fresh",
      ORIGIN
    );

  internalUrl
    .searchParams
    .set(
      "url",
      target
    );

  internalUrl
    .searchParams
    .set(
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
      await freshnessResponse
        .json();

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
    freshnessResponse
      .status >= 400
  ) {
    return jsonResponse(
      freshness,
      freshnessResponse.status
    );
  }


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
    !settlement.data
      ?.success
  ) {
    return jsonResponse(
      {
        error:
          "Payment settlement failed",

        reason:
          settlement.data
            ?.errorReason ||
          "unknown",

        message:
          settlement.data
            ?.errorMessage ||
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
    settlement
      .response
      .headers
      .get(
        "EXTENSION-RESPONSES"
      );


  if (
    extensionResponses
  ) {
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
        "0.8.0",

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


async function listingStatus() {
  const response =
    await fetch(
      `${FACILITATOR}/discovery/listing-status?resource=${encodeURIComponent(ENDPOINT)}`,
      {
        headers: {
          accept:
            "application/json"
        }
      }
    );


  let data;

  try {
    data =
      await response.json();

  } catch {
    data = {
      error:
        "Invalid listing-status response"
    };
  }


  return {
    httpStatus:
      response.status,

    data
  };
}


async function bazaarStatus() {
  try {
    const response =
      await fetch(
        `${FACILITATOR}/discovery/resources?payTo=${encodeURIComponent(PAY_TO)}&limit=100`,
        {
          headers: {
            accept:
              "application/json"
          }
        }
      );


    const data =
      await response.json();


    const items =
      Array.isArray(
        data?.items
      )
        ? data.items
        : [];


    const matches =
      items.filter(
        item =>
          item?.resource ===
            ENDPOINT ||

          item?.resource?.url ===
            ENDPOINT
      );


    return {
      service:
        "FreshGate",

      version:
        "0.8.0",

      endpoint:
        ENDPOINT,

      payTo:
        PAY_TO,

      discoveryHttpStatus:
        response.status,

      listed:
        matches.length > 0,

      matches,

      totalForWallet:
        data
          ?.pagination
          ?.total ??
        items.length,

      listingStatus:
        await listingStatus()
    };

  } catch (error) {
    return {
      service:
        "FreshGate",

      version:
        "0.8.0",

      endpoint:
        ENDPOINT,

      payTo:
        PAY_TO,

      listed:
        false,

      error:
        error instanceof Error
          ? error.message
          : String(error)
    };
  }
}


async function verifyOnlySubmit(
  request
) {
  let body;

  try {
    body =
      await request.json();

  } catch {
    return jsonResponse(
      {
        ok:
          false,

        error:
          "Invalid JSON body"
      },
      400
    );
  }


  let paymentPayload =
    body?.paymentPayload;


  if (
    !paymentPayload ||

    paymentPayload
      .x402Version !== 2 ||

    !acceptedRequirementIsValid(
      paymentPayload
        .accepted
    )
  ) {
    return jsonResponse(
      {
        ok:
          false,

        error:
          "Payment payload does not match FreshGate requirements"
      },
      400
    );
  }


  const authorization =
    paymentPayload
      ?.payload
      ?.authorization;

  const signature =
    paymentPayload
      ?.payload
      ?.signature;


  if (
    typeof signature !==
      "string" ||

    !signature
      .startsWith(
        "0x"
      ) ||

    !authorization ||

    !sameAddress(
      authorization.to,
      PAY_TO
    ) ||

    String(
      authorization.value
    ) !==
      AMOUNT ||

    typeof authorization
      .from !==
        "string" ||

    typeof authorization
      .nonce !==
        "string"
  ) {
    return jsonResponse(
      {
        ok:
          false,

        error:
          "Invalid FreshGate EIP-3009 authorization"
      },
      400
    );
  }


  paymentPayload =
    canonicalPaymentPayload(
      paymentPayload
    );


  let verify;

  try {
    verify =
      await facilitatorCall(
        "/verify",
        paymentPayload
      );

  } catch (error) {
    return jsonResponse(
      {
        ok:
          false,

        error:
          "PayAI verification service unavailable",

        message:
          error instanceof Error
            ? error.message
            : String(error)
      },
      503
    );
  }


  const rawExtensionResponses =
    verify
      .response
      .headers
      .get(
        "EXTENSION-RESPONSES"
      );


  let extensionResponses =
    null;


  if (
    rawExtensionResponses
  ) {
    const decoded =
      decodeBase64Text(
        rawExtensionResponses
      );

    if (
      decoded
    ) {
      try {
        extensionResponses =
          JSON.parse(
            decoded
          );

      } catch {
        extensionResponses = {
          raw:
            decoded
        };
      }
    }
  }


  return jsonResponse(
    {
      ok:
        verify.data
          ?.isValid === true,

      mode:
        "verify-only",

      settled:
        false,

      verifyHttpStatus:
        verify.response.status,

      verify:
        verify.data,

      extensionResponses,

      extensionResponsesPresent:
        !!rawExtensionResponses,

      listingStatus:
        await listingStatus(),

      note:
        "This route calls PayAI /verify only. It never calls /settle."
    },

    verify.response.ok
      ? 200
      : verify.response.status,

    rawExtensionResponses
      ? {
          "EXTENSION-RESPONSES":
            rawExtensionResponses
        }
      : {}
  );
}


function verifyPage() {
  const html =
`<!doctype html>

<html lang="it">

<head>

<meta charset="utf-8">

<meta
name="viewport"
content="width=device-width,initial-scale=1,viewport-fit=cover">

<title>
FreshGate Bazaar Verify
</title>

<style>

* {
box-sizing:
border-box;
}

body {
margin:
0;

background:
#f5f6f8;

color:
#111827;

font-family:
system-ui,
-apple-system,
sans-serif;
}

main {
max-width:
720px;

margin:
auto;

padding:
22px 15px 50px;
}

h1 {
font-size:
30px;
}

.c {
background:
#fff;

border:
1px solid #e5e7eb;

border-radius:
17px;

padding:
17px;

margin:
13px 0;
}

.w {
background:
#fff7d6;
}

.s {
font-size:
18px;

font-weight:
800;
}

button {
width:
100%;

margin-top:
10px;

padding:
15px;

border:
0;

border-radius:
13px;

background:
#111827;

color:
#fff;

font-size:
17px;

font-weight:
800;
}

button:disabled {
opacity:
.4;
}

.ok {
color:
#08783e;

font-weight:
800;
}

.bad {
color:
#b42318;

font-weight:
800;
}

.st {
margin-top:
9px;

font-weight:
700;
}

.sm {
font-size:
13px;

color:
#4b5563;

line-height:
1.45;
}

pre {
white-space:
pre-wrap;

word-break:
break-word;

background:
#0f172a;

color:
#e2e8f0;

padding:
12px;

border-radius:
11px;

font-size:
12px;

max-height:
350px;

overflow:
auto;
}

</style>

</head>


<body>

<main>


<h1>
FreshGate Bazaar Verify
</h1>


<p>
Fa arrivare la dichiarazione Bazaar a PayAI usando solo <b>/verify</b>.
</p>


<div class="c w">

<b>
Sicurezza
</b>

<p class="sm">

La firma autorizza
$0,001 USDC
per circa 60 secondi.

Questa pagina la invia solo a
PayAI
<code>/verify</code>.

Non chiama mai
<code>/settle</code>.

La firma resta comunque una vera autorizzazione di pagamento finché non scade:
usala solo qui e completa il test subito.

</p>

</div>


<div class="c">

<div class="s">
1. Test 402
</div>

<button id="b1">
Testa FreshGate
</button>

<div
id="s1"
class="st">
</div>

</div>


<div class="c">

<div class="s">
2. Wallet
</div>

<p class="sm">

Su iPhone,
se Safari non vede il wallet,
apri questa stessa pagina nel browser interno di Coinbase Wallet
o di un wallet EVM compatibile.

</p>

<button id="b2">
Collega wallet
</button>

<div
id="s2"
class="st">
</div>

</div>


<div class="c">

<div class="s">
3. Firma
</div>

<button
id="b3"
disabled>

Firma $0,001 USDC

</button>

<div
id="s3"
class="st">
</div>

</div>


<div class="c">

<div class="s">
4. Verify-only
</div>

<button
id="b4"
disabled>

Invia solo /verify

</button>

<div
id="s4"
class="st">
</div>

<pre
id="o4"
hidden>
</pre>

</div>


<div class="c">

<div class="s">
5. Bazaar
</div>

<button id="b5">
Controlla listing
</button>

<div
id="s5"
class="st">
</div>

<pre
id="o5"
hidden>
</pre>

</div>


</main>


<script>


const ENDPOINT =
${JSON.stringify(ENDPOINT)};


const VERIFY =
${JSON.stringify(
  `${ORIGIN}/api/verify-bazaar-submit`
)};


const STATUS =
${JSON.stringify(
  `${ORIGIN}/api/bazaar-status`
)};


const CHAIN =
"0x2105";


let challenge =
null;

let accepted =
null;

let account =
null;

let paymentPayload =
null;


const $ =
id =>
  document
    .getElementById(
      id
    );


function status(
  id,
  text,
  ok
) {
  const e =
    $(id);

  e.textContent =
    text;

  e.className =
    "st" +
    (
      ok === true
        ? " ok"
        : ok === false
          ? " bad"
          : ""
    );
}


function decodeHeader(
  value
) {
  let x =
    value
      .replace(
        /-/g,
        "+"
      )
      .replace(
        /_/g,
        "/"
      );

  while (
    x.length % 4
  ) {
    x += "=";
  }

  const binary =
    atob(x);

  const bytes =
    Uint8Array.from(
      binary,
      c =>
        c.charCodeAt(0)
    );

  return JSON.parse(
    new TextDecoder()
      .decode(
        bytes
      )
  );
}


function randomNonce() {
  const a =
    new Uint8Array(
      32
    );

  crypto
    .getRandomValues(
      a
    );

  return "0x" +
    [...a]
      .map(
        x =>
          x
            .toString(16)
            .padStart(
              2,
              "0"
            )
      )
      .join("");
}


function refreshButtons() {
  $("b3").disabled =
    !(
      challenge &&
      accepted &&
      account
    );

  $("b4").disabled =
    !paymentPayload;
}


$("b1").onclick =
async () => {

  try {

    status(
      "s1",
      "Controllo..."
    );


    const r =
      await fetch(
        ENDPOINT +
        "?url=" +
        encodeURIComponent(
          "https://example.com"
        ),
        {
          headers: {
            Accept:
              "application/json"
          },

          cache:
            "no-store"
        }
      );


    if (
      r.status !== 402
    ) {
      throw Error(
        "HTTP " +
        r.status +
        ", atteso 402"
      );
    }


    const h =
      r.headers.get(
        "PAYMENT-REQUIRED"
      );


    challenge =
      h
        ? decodeHeader(h)
        : await r.json();


    if (
      challenge
        ?.x402Version !== 2
    ) {
      throw Error(
        "La risposta non è x402 v2"
      );
    }


    if (
      !challenge
        ?.extensions
        ?.bazaar
        ?.info ||

      !challenge
        ?.extensions
        ?.bazaar
        ?.schema
    ) {
      throw Error(
        "Manca extensions.bazaar info/schema"
      );
    }


    accepted =
      challenge
        .accepts
        ?.find(
          x =>
            x.scheme ===
              "exact" &&

            x.network ===
              "eip155:8453"
        );


    if (
      !accepted
    ) {
      throw Error(
        "Manca il requisito exact su Base"
      );
    }


    status(
      "s1",
      "402 x402 v2 + Bazaar OK ✓",
      true
    );


    refreshButtons();

  } catch (e) {

    status(
      "s1",
      e?.message ||
      String(e),
      false
    );
  }
};


$("b2").onclick =
async () => {

  try {

    if (
      !window.ethereum
    ) {
      throw Error(
        "Wallet non rilevato. Apri questa pagina nel browser interno di Coinbase Wallet o di un wallet EVM compatibile."
      );
    }


    const accounts =
      await window.ethereum
        .request({
          method:
            "eth_requestAccounts"
        });


    account =
      accounts?.[0];


    if (
      !account
    ) {
      throw Error(
        "Nessun account selezionato"
      );
    }


    let chain =
      await window.ethereum
        .request({
          method:
            "eth_chainId"
        });


    if (
      String(chain)
        .toLowerCase() !==
      CHAIN
    ) {

      try {

        await window.ethereum
          .request({
            method:
              "wallet_switchEthereumChain",

            params: [
              {
                chainId:
                  CHAIN
              }
            ]
          });

      } catch (e) {

        if (
          e?.code ===
          4902
        ) {

          await window.ethereum
            .request({
              method:
                "wallet_addEthereumChain",

              params: [
                {
                  chainId:
                    CHAIN,

                  chainName:
                    "Base",

                  nativeCurrency: {
                    name:
                      "Ether",

                    symbol:
                      "ETH",

                    decimals:
                      18
                  },

                  rpcUrls: [
                    "https://mainnet.base.org"
                  ],

                  blockExplorerUrls: [
                    "https://basescan.org"
                  ]
                }
              ]
            });

        } else {

          throw e;
        }
      }
    }


    status(
      "s2",
      "Wallet " +
      account.slice(
        0,
        6
      ) +
      "…" +
      account.slice(
        -4
      ) +
      " su Base ✓",
      true
    );


    refreshButtons();

  } catch (e) {

    status(
      "s2",
      e?.message ||
      String(e),
      false
    );
  }
};


$("b3").onclick =
async () => {

  try {

    if (
      !challenge ||
      !accepted ||
      !account
    ) {
      throw Error(
        "Completa prima i passaggi 1 e 2"
      );
    }


    const now =
      Math.floor(
        Date.now() /
        1000
      );


    const authorization = {
      from:
        account,

      to:
        accepted.payTo,

      value:
        String(
          accepted.amount
        ),

      validAfter:
        String(
          Math.max(
            0,
            now - 600
          )
        ),

      validBefore:
        String(
          now +
          Number(
            accepted.maxTimeoutSeconds ||
            60
          )
        ),

      nonce:
        randomNonce()
    };


    const typedData = {

      types: {

        EIP712Domain: [
          {
            name:
              "name",

            type:
              "string"
          },

          {
            name:
              "version",

            type:
              "string"
          },

          {
            name:
              "chainId",

            type:
              "uint256"
          },

          {
            name:
              "verifyingContract",

            type:
              "address"
          }
        ],


        TransferWithAuthorization: [

          {
            name:
              "from",

            type:
              "address"
          },

          {
            name:
              "to",

            type:
              "address"
          },

          {
            name:
              "value",

            type:
              "uint256"
          },

          {
            name:
              "validAfter",

            type:
              "uint256"
          },

          {
            name:
              "validBefore",

            type:
              "uint256"
          },

          {
            name:
              "nonce",

            type:
              "bytes32"
          }
        ]
      },


      domain: {

        name:
          accepted
            .extra
            ?.name ||
          "USD Coin",

        version:
          accepted
            .extra
            ?.version ||
          "2",

        chainId:
          8453,

        verifyingContract:
          accepted.asset
      },


      primaryType:
        "TransferWithAuthorization",


      message:
        authorization
    };


    const signature =
      await window.ethereum
        .request({

          method:
            "eth_signTypedData_v4",

          params: [
            account,
            JSON.stringify(
              typedData
            )
          ]
        });


    paymentPayload = {

      x402Version:
        2,

      resource:
        challenge.resource,

      accepted,

      payload: {
        signature,
        authorization
      },

      extensions:
        challenge.extensions
    };


    status(
      "s3",
      "Firma pronta. Premi Verify subito ✓",
      true
    );


    refreshButtons();

  } catch (e) {

    status(
      "s3",
      e?.message ||
      String(e),
      false
    );
  }
};


$("b4").onclick =
async () => {

  try {

    if (
      !paymentPayload
    ) {
      throw Error(
        "Firma prima"
      );
    }


    status(
      "s4",
      "Invio a PayAI /verify..."
    );


    $("b4").disabled =
      true;


    const r =
      await fetch(
        VERIFY,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              paymentPayload
            })
        }
      );


    const d =
      await r.json();


    $("o4").hidden =
      false;


    $("o4").textContent =
      JSON.stringify(
        d,
        null,
        2
      );


    const z =
      d
        ?.extensionResponses
        ?.bazaar;


    if (
      z?.status ===
        "processing" ||

      z?.status ===
        "success"
    ) {

      status(
        "s4",
        "Bazaar accettato: " +
        z.status +
        " ✓",
        true
      );

    } else if (
      z?.status ===
      "rejected"
    ) {

      status(
        "s4",
        "Bazaar rifiutato: " +
        (
          z.rejectedReason ||
          "motivo non indicato"
        ),
        false
      );

    } else if (
      d?.verify?.isValid ===
      true
    ) {

      status(
        "s4",
        "Verify valido. Nessun EXTENSION-RESPONSES: controlliamo il listing.",
        true
      );

    } else {

      status(
        "s4",
        "Verify non valido: " +
        (
          d?.verify
            ?.invalidMessage ||

          d?.verify
            ?.invalidReason ||

          d?.error ||

          "errore sconosciuto"
        ),
        false
      );
    }

  } catch (e) {

    status(
      "s4",
      e?.message ||
      String(e),
      false
    );

  } finally {

    refreshButtons();
  }
};


$("b5").onclick =
async () => {

  try {

    status(
      "s5",
      "Controllo catalogo..."
    );


    const r =
      await fetch(
        STATUS,
        {
          cache:
            "no-store"
        }
      );


    const d =
      await r.json();


    $("o5").hidden =
      false;


    $("o5").textContent =
      JSON.stringify(
        d,
        null,
        2
      );


    status(
      "s5",

      d?.listed
        ? "FreshGate è nel Bazaar ✓"
        : "FreshGate non è ancora nel Bazaar",

      !!d?.listed
    );

  } catch (e) {

    status(
      "s5",
      e?.message ||
      String(e),
      false
    );
  }
};


</script>

</body>

</html>`;


  return new Response(
    html,
    {
      status:
        200,

      headers: {
        ...corsHeaders(),

        "content-type":
          "text/html; charset=utf-8",

        "content-security-policy":
          "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self' https://facilitator.payai.network; img-src 'self' data:; frame-ancestors 'none'"
      }
    }
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
      `${ORIGIN}/llms.txt`,

    verifyBazaar:
      `${ORIGIN}/verify-bazaar`
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
        "0.8.0",

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
          status:
            204,

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
        "/verify-bazaar" &&

      request.method ===
        "GET"
    ) {

      return verifyPage();
    }


    if (
      url.pathname ===
        "/api/verify-bazaar-submit" &&

      request.method ===
        "POST"
    ) {

      return verifyOnlySubmit(
        request
      );
    }


    if (
      url.pathname ===
      "/api/bazaar-status"
    ) {

      return jsonResponse(
        await bazaarStatus()
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

        x402Version:
          2,

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

Bazaar verify helper:
${ORIGIN}/verify-bazaar
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
          "0.8.0",

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
          true,

        verifyOnlyHelper:
          `${ORIGIN}/verify-bazaar`
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