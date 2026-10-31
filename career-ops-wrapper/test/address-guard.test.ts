import { describe, expect, it } from "vitest";
import { isBlockedAddress } from "../src/evaluation/address-guard.js";

describe("isBlockedAddress", () => {
  it.each([
    "127.0.0.1",
    "127.8.8.8",
    "10.0.0.1",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "255.255.255.255",
    "224.0.0.1",
    "::1",
    "::",
    "[::1]",
    "fd00::1",
    "fc00::1",
    "fe80::1",
    "fe80::1%en0",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:10.0.0.1",
    "::ffff:a9fe:a9fe",
    "::127.0.0.1",
    "64:ff9b::7f00:1",
    "not-an-ip",
    ""
  ])("blocks %s", (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700::1111", "::ffff:8.8.8.8", "64:ff9b::808:808"])(
    "allows %s",
    (address) => {
      expect(isBlockedAddress(address)).toBe(false);
    }
  );
});
