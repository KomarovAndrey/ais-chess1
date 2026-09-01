import { describe, expect, it } from "vitest";
import { checkPublicReadRateLimit, getRequestIp } from "@/lib/rateLimit";

describe("rateLimit", () => {
  it("getRequestIp reads x-forwarded-for", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getRequestIp(req)).toBe("1.2.3.4");
  });

  it("checkPublicReadRateLimit allows burst then blocks", async () => {
    const id = `test-public-${Date.now()}`;
    let allowed = 0;
    for (let i = 0; i < 35; i++) {
      if (await checkPublicReadRateLimit(id)) allowed += 1;
    }
    expect(allowed).toBe(30);
    expect(await checkPublicReadRateLimit(id)).toBe(false);
  });
});
