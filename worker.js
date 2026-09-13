const CACHE_TTL = 300; // 5 minuti
const MAX_BYTES = 1000000; // 1 MB

function reply(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "access-control-allow-origin": "*"
    }
  });
}

async function hashString(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return [...new Uint8Array(digest)]
    .map(x => x.toString(16).padStart(2, "0"))
    .join("");
}

async function hashBytes(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);

  return [...new Uint8Array(digest)]
    .map(x => x.toString(16).padStart(2, "0"))
    .join("");
}

function blockedHost(hostname) {
  const host = hostname.toLowerCase();

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  ) {
    return true;
  }

  const parts = host.split(".").map(Number);

  if (
    parts.length === 4 &&
    parts.every(x => Number.isInteger(x) && x >= 0 && x <= 255)
  ) {
    const [a, b] = parts;

    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }

  return false;
}

export default {
  async fetch(request, env, ctx) {
    const requestUrl = new URL(request.url);

    // HOME
    if (requestUrl.pathname === "/") {
      return reply({
        service: "FreshGate",
        version: "0.1",
        status: "online",
        endpoints: {
          status: "/status",
          fresh: "/fresh?url=https://example.com"
        }
      });
    }

    // STATUS
    if (requestUrl.pathname === "/status") {
      return reply({
        service: "FreshGate",
        status: "ok",
        time: new Date().toISOString()
      });
    }

    // FRESH CHECK
    if (requestUrl.pathname === "/fresh") {
      const target = requestUrl.searchParams.get("url");

      if (!target) {
        return reply({
          error: "Missing url parameter"
        }, 400);
      }

      let parsed;

      try {
        parsed = new URL(target);

        if (!["http:", "https:"].includes(parsed.protocol)) {
          throw new Error("Invalid protocol");
        }

        if (blockedHost(parsed.hostname)) {
          return reply({
            error: "Private or local addresses are not allowed"
          }, 400);
        }
      } catch {
        return reply({
          error: "Invalid URL"
        }, 400);
      }

      const normalizedUrl = parsed.toString();
      const id = await hashString(normalizedUrl);

      const cache = caches.default;

      const cacheKey = new Request(
        "https://freshgate-cache.invalid/" + id
      );

      const previous = await cache.match(cacheKey);

      if (previous) {
        const saved = await previous.json();

        return reply({
          url: normalizedUrl,
          reachable: true,
          changed: false,
          recommendation: "skip",
          source: "cache",
          last_check: saved.checked_at,
          hash: saved.hash
        });
      }

      let response;

      try {
        response = await fetch(normalizedUrl, {
          method: "GET",
          redirect: "follow",
          headers: {
            "user-agent": "FreshGate/0.1"
          }
        });
      } catch {
        return reply({
          url: normalizedUrl,
          reachable: false,
          error: "Remote request failed"
        }, 502);
      }

      const contentLength = Number(
        response.headers.get("content-length") || "0"
      );

      if (contentLength > MAX_BYTES) {
        return reply({
          url: normalizedUrl,
          reachable: true,
          status: response.status,
          error: "Page too large for FreshGate v0.1"
        }, 413);
      }

      const body = await response.arrayBuffer();

      if (body.byteLength > MAX_BYTES) {
        return reply({
          url: normalizedUrl,
          reachable: true,
          status: response.status,
          error: "Page too large for FreshGate v0.1"
        }, 413);
      }

      const contentHash = await hashBytes(body);

      const result = {
        url: normalizedUrl,
        final_url: response.url,
        reachable: true,
        status: response.status,
        changed: null,
        recommendation: "read",
        source: "remote",
        hash: contentHash,
        checked_at: new Date().toISOString()
      };

      const cacheResponse = new Response(
        JSON.stringify(result),
        {
          headers: {
            "content-type": "application/json",
            "cache-control": `public, max-age=${CACHE_TTL}`
          }
        }
      );

      ctx.waitUntil(
        cache.put(cacheKey, cacheResponse)
      );

      return reply(result);
    }

    return reply({
      error: "Not found"
    }, 404);
  }
};