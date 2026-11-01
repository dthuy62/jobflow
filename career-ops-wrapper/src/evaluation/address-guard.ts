import { BlockList, isIP } from "node:net";

// Addresses the posting fetcher must never connect to: anything that is not
// a public unicast address on the internet.
const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4]
] as const) {
  blocked.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8]
] as const) {
  blocked.addSubnet(network, prefix, "ipv6");
}

/** `true` for any address the fetcher must refuse, including IPv4 embedded in IPv6. */
export function isBlockedAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  const version = isIP(ip);
  if (version === 4) {
    return blocked.check(ip, "ipv4");
  }
  if (version !== 6) {
    return true;
  }

  const groups = expandIpv6(ip);
  if (!groups) {
    return true;
  }
  const embedded = embeddedIpv4(groups);
  if (embedded !== undefined) {
    return blocked.check(embedded, "ipv4");
  }
  return blocked.check(ip, "ipv6");
}

/**
 * The IPv4 address carried by an IPv4-mapped (`::ffff:a.b.c.d`),
 * IPv4-compatible (`::a.b.c.d`) or NAT64 (`64:ff9b::a.b.c.d`) IPv6 address.
 */
function embeddedIpv4(groups: number[]): string | undefined {
  const high = groups.slice(0, 5);
  const isMapped = high.every((group) => group === 0) && groups[5] === 0xffff;
  const isCompatible = high.every((group) => group === 0) && groups[5] === 0 && (groups[6] ?? 0) !== 0;
  const isNat64 = groups[0] === 0x64 && groups[1] === 0xff9b && groups.slice(2, 6).every((group) => group === 0);
  if (!isMapped && !isCompatible && !isNat64) {
    return undefined;
  }
  const [hi = 0, lo = 0] = groups.slice(6);
  return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join(".");
}

function expandIpv6(ip: string): number[] | undefined {
  let text = ip.toLowerCase();
  const dotted = text.match(/(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (dotted) {
    const octets = dotted.split(".").map(Number);
    const [a = 0, b = 0, c = 0, d = 0] = octets;
    text = `${text.slice(0, -dotted.length)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }

  const [head = "", tail, ...rest] = text.split("::");
  if (rest.length > 0) {
    return undefined;
  }
  const parse = (part: string): number[] => (part === "" ? [] : part.split(":").map((group) => parseInt(group, 16)));
  const left = parse(head);
  const right = tail === undefined ? [] : parse(tail);
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (tail === undefined && missing !== 0)) {
    return undefined;
  }
  const groups = [...left, ...Array<number>(missing).fill(0), ...right];
  return groups.every((group) => Number.isInteger(group) && group >= 0 && group <= 0xffff) ? groups : undefined;
}
