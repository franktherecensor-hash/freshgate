const DEFAULT_TTL = 300;
const MAX_BYTES = 1000000;

function reply(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "access-control-allow-origin": "*"
    }
  });
}

async function sha256(buffer) {
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

  const p = host.split(".").map(Number);

  if (
    p.length === 4 &&
    p.every(x => Number.isInteger(x) && x >= 0 && x <= 255)
  ) {
    const [a, b] = p;

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
  async fetch(request, env) {
    const u = new URL(request.url);

    if (u.pathname === "/") {
      return reply({
        service: "FreshGate",
        version: "0.2",
        status: "online",
        database: true,
        endpoints: {
          status: "/status",
          stats: "/stats",
          fresh: "/fresh?url=https://example.com"
        }
      });
    }

    if (u.pathname === "/status") {
      return reply({
        service: "FreshGate",
        version: "0.2",
        status: "ok",
        database: !!env.DB,
        time: new Date().toISOString()
      });
    }

    if (u.pathname === "/stats") {
      try {
        const stats = await env.DB.prepare(`
          SELECT
            COUNT(*) AS pages,
            COALESCE(SUM(checks), 0) AS checks,
            COALESCE(SUM(changes), 0) AS changes
          FROM pages
        `).first();

        return reply(stats);
      } catch (e) {
        return reply({
          error: "Database error",
          detail: String(e)
        }, 500);
      }
    }

    if (u.pathname !== "/fresh") {
      return reply({ error: "Not found" }, 404);
    }

    const raw = u.searchParams.get("url");

    if (!raw) {
      return reply({ error: "Missing url parameter" }, 400);
    }

    let target;

    try {
      target = new URL(raw);

      if (!["http:", "https:"].includes(target.protocol)) {
        throw new Error();
      }

      if (blockedHost(target.hostname)) {
        return reply({
          error: "Private/local addresses are not allowed"
        }, 400);
      }

      target.hash = "";
    } catch {
      return reply({ error: "Invalid URL" }, 400);
    }

    const normalized = target.toString();

    const ttlValue = Number(
      u.searchParams.get("ttl") || DEFAULT_TTL
    );

    const ttl = Math.max(
      0,
      Math.min(
        86400,
        Number.isFinite(ttlValue)
          ? ttlValue
          : DEFAULT_TTL
      )
    );

    const now = Math.floor(Date.now() / 1000);

    let previous;

    try {
      previous = await env.DB.prepare(
        "SELECT * FROM pages WHERE url = ?"
      )
        .bind(normalized)
        .first();
    } catch (e) {
      return reply({
        error: "Database read failed",
        detail: String(e)
      }, 500);
    }

    if (
      previous &&
      now - previous.checked_at <= ttl
    ) {
      return reply({
        url: normalized,
        reachable: true,
        status: previous.status_code,
        changed: false,
        recommendation: "skip",
        source: "database-cache",
        checked_at: previous.checked_at,
        age_seconds: now - previous.checked_at,
        checks: previous.checks,
        changes: previous.changes,
        hash: previous.content_hash
      });
    }

    const headers = {
      "user-agent": "FreshGate/0.2"
    };

    if (previous?.etag) {
      headers["if-none-match"] = previous.etag;
    }

    if (previous?.last_modified) {
      headers["if-modified-since"] =
        previous.last_modified;
    }

    let response;

    try {
      response = await fetch(normalized, {
        method: "GET",
        headers,
        redirect: "follow"
      });
    } catch {
      return reply({
        url: normalized,
        reachable: false,
        error: "Remote request failed"
      }, 502);
    }

    let changed = null;
    let contentHash =
      previous?.content_hash || null;

    if (response.status === 304 && previous) {
      changed = false;
    } else {
      const length = Number(
        response.headers.get("content-length") || "0"
      );

      if (length > MAX_BYTES) {
        return reply({
          error: "Page too large",
          max_bytes: MAX_BYTES
        }, 413);
      }

      const body = await response.arrayBuffer();

      if (body.byteLength > MAX_BYTES) {
        return reply({
          error: "Page too large",
          max_bytes: MAX_BYTES
        }, 413);
      }

      contentHash = await sha256(body);

      if (previous) {
        changed =
          contentHash !== previous.content_hash;
      }
    }

    const checks =
      (previous?.checks || 0) + 1;

    const changes =
      (previous?.changes || 0) +
      (changed === true ? 1 : 0);

    const changedAt =
      changed === true
        ? now
        : previous?.changed_at || now;

    const statusCode =
      response.status === 304 && previous
        ? previous.status_code
        : response.status;

    const etag =
      response.headers.get("etag") ||
      previous?.etag ||
      null;

    const lastModified =
      response.headers.get("last-modified") ||
      previous?.last_modified ||
      null;

    try {
      await env.DB.prepare(`
        INSERT INTO pages (
          url,
          final_url,
          status_code,
          content_hash,
          etag,
          last_modified,
          checked_at,
          changed_at,
          checks,
          changes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

        ON CONFLICT(url) DO UPDATE SET
          final_url = excluded.final_url,
          status_code = excluded.status_code,
          content_hash = excluded.content_hash,
          etag = excluded.etag,
          last_modified = excluded.last_modified,
          checked_at = excluded.checked_at,
          changed_at = excluded.changed_at,
          checks = excluded.checks,
          changes = excluded.changes
      `)
        .bind(
          normalized,
          response.url || normalized,
          statusCode,
          contentHash,
          etag,
          lastModified,
          now,
          changedAt,
          checks,
          changes
        )
        .run();
    } catch (e) {
      return reply({
        error: "Database write failed",
        detail: String(e)
      }, 500);
    }

    return reply({
      url: normalized,
      final_url: response.url || normalized,
      reachable: true,
      status: statusCode,
      changed,
      recommendation:
        changed === false ? "skip" : "read",
      source: "remote",
      checked_at: now,
      checks,
      changes,
      hash: contentHash
    });
  }
};