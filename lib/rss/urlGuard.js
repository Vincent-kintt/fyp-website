import { BlockList, isIP } from "node:net";

// SSRF defense for server-side RSS fetches. The only live attacker vector is
// the LLM hallucinating a feed URL; the allowlist is the primary control and
// this guard is the IP-literal backstop (OWASP SSRF Case 1).

const BLOCKED = new BlockList();

// IPv4 private/reserved: this-host, RFC1918, CGNAT, loopback, link-local
// (incl. cloud metadata 169.254/16), multicast, reserved.
[
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
].forEach(([net, prefix]) => BLOCKED.addSubnet(net, prefix, "ipv4"));
BLOCKED.addAddress("255.255.255.255", "ipv4");

// IPv6: loopback, unspecified, link-local, unique-local, multicast.
// v4-mapped (::ffff:a.b.c.d) is auto-checked against the ipv4 rules by node:net.
[
  ["::1", 128],
  ["::", 128],
  ["fe80::", 10],
  ["fc00::", 7],
  ["ff00::", 8],
].forEach(([net, prefix]) => BLOCKED.addSubnet(net, prefix, "ipv6"));

const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

export function isFeedUrlSafe(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }

  if (!ALLOWED_SCHEMES.has(url.protocol)) {
    return { ok: false, reason: "Unsupported scheme" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "URL must not contain credentials" };
  }

  // new URL keeps the surrounding brackets in `.hostname` for IPv6 literals.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const family = isIP(host); // 0 = hostname (not an IP literal), 4 or 6 otherwise
  if (family && BLOCKED.check(host, family === 6 ? "ipv6" : "ipv4")) {
    return { ok: false, reason: "Internal/reserved address blocked" };
  }

  return { ok: true };
}
