import { afterEach, describe, expect, it } from "vitest";
import { SITE_URL, siteBaseUrl } from "@/lib/site-url";
import { appBaseUrl, visitorSiteUrl } from "@/server/mail";

/** The site address needs no setting: fixed in code for production, localhost while developing, and APP_BASE_URL still overrides. */
const env = process.env as Record<string, string | undefined>;
const saved = { APP_BASE_URL: env.APP_BASE_URL, NODE_ENV: env.NODE_ENV };
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete env[k]; else env[k] = v; }
});
const req = (headers: Record<string, string> = {}) => new Request("http://x/api", { headers });

describe("site address without APP_BASE_URL", () => {
  it("is the live address in production, and localhost otherwise", () => {
    delete env.APP_BASE_URL;
    env.NODE_ENV = "production";
    expect(siteBaseUrl()).toBe(SITE_URL);
    expect(SITE_URL).toMatch(/^https:\/\/[a-z0-9.-]+$/);
    env.NODE_ENV = "development";
    expect(siteBaseUrl()).toBe("http://localhost:3000");
  });
  it("APP_BASE_URL still wins, and a trailing slash is ignored", () => {
    env.NODE_ENV = "production";
    env.APP_BASE_URL = "http://localhost:3000/";
    expect(siteBaseUrl()).toBe("http://localhost:3000");
    env.APP_BASE_URL = "   ";
    expect(siteBaseUrl()).toBe(SITE_URL);
  });
  it("email links in production always use the fixed address and ignore a forged Host header", () => {
    delete env.APP_BASE_URL;
    env.NODE_ENV = "production";
    expect(appBaseUrl(req({ host: "evil.example", "x-forwarded-host": "evil.example", "x-forwarded-proto": "http" }))).toBe(SITE_URL);
  });
  it("product links in form emails follow the address the visitor is on (local or live), with the fixed address as the fallback", () => {
    delete env.APP_BASE_URL;
    env.NODE_ENV = "production";
    expect(visitorSiteUrl(req({ origin: "http://localhost:3000" }))).toBe("http://localhost:3000");
    expect(visitorSiteUrl(req({ origin: "https://www.example-live.in" }))).toBe("https://www.example-live.in");
    expect(visitorSiteUrl(req({ origin: "javascript:alert(1)" }))).toBe(SITE_URL);
    expect(visitorSiteUrl(req())).toBe(SITE_URL);
  });
  it("while developing, email links follow the address the request came in on", () => {
    delete env.APP_BASE_URL;
    env.NODE_ENV = "development";
    expect(appBaseUrl(req({ host: "localhost:3000" }))).toBe("http://localhost:3000");
    expect(appBaseUrl(req({ host: "192.168.1.42:3000" }))).toBe("https://192.168.1.42:3000");
  });
});
