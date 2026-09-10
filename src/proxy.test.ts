import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { redis } from "@/lib/redis";
import { proxy } from "./proxy";

// polyfill cookies on NextResponse for vitest (node 18+ Response may lack them)
if (!("cookies" in NextResponse.redirect(new URL("http://x")))) {
  Object.defineProperty(NextResponse.prototype, "cookies", {
    get() {
      const headers = this.headers;
      const set = headers.get("set-cookie") ?? "";
      const map = new Map<string, string>();
      for (const part of set.split(", ")) {
        const [kv] = part.split(";");
        const [k, v] = kv.split("=");
        if (k) map.set(k.trim(), decodeURIComponent(v ?? ""));
      }
      return {
        get: (name: string) => {
          const value = map.get(name);
          return value ? { value } : undefined;
        },
      };
    },
  });
}

const mkReq = (path: string, cookie?: string) => {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  return new NextRequest(`http://localhost${path}`, { headers });
};

beforeEach(() => {
  (redis as unknown as { reset(): void }).reset();
});

describe("proxy routing", () => {
  it("redirects non-room paths to /", async () => {
    const res = await proxy(mkReq("/dashboard"));
    const location = res.headers.get("location");
    expect(location).toBe("http://localhost/");
  });

  it("redirects to ?error=room-not-found when meta does not exist", async () => {
    const res = await proxy(mkReq("/room/missing"));
    const location = res.headers.get("location");
    expect(location).toContain("error=room-not-found");
  });
});

describe("room join via proxy", () => {
  it("issues an x-auth-token cookie and adds token to connected list", async () => {
    await redis.hset("meta:r1", { createdAt: Date.now() });
    await redis.expire("meta:r1", 600);

    const res = await proxy(mkReq("/room/r1"));
    expect(res.status).toBe(200);

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("x-auth-token=");

    const tokens = await redis.lrange("connected:r1", 0, -1);
    expect(tokens).toHaveLength(1);
    expect(typeof tokens[0]).toBe("string");
  });

  it("passes through directly when the cookie is already valid", async () => {
    await redis.hset("meta:r2", { createdAt: Date.now() });
    await redis.expire("meta:r2", 600);
    await redis.rpush("connected:r2", "existing-tok");

    const res = await proxy(mkReq("/room/r2", "x-auth-token=existing-tok"));
    expect(res.status).toBe(200);

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toBe("");

    const count = await redis.llen("connected:r2");
    expect(count).toBe(1);
  });

  it("redirects to ?error=room-full when two users already joined", async () => {
    await redis.hset("meta:r3", { createdAt: Date.now() });
    await redis.expire("meta:r3", 600);
    await redis.rpush("connected:r3", "t1", "t2");

    const res = await proxy(mkReq("/room/r3"));
    const location = res.headers.get("location");
    expect(location).toContain("error=room-full");

    const tokens = await redis.lrange("connected:r3", 0, -1);
    expect(tokens).toEqual(["t1", "t2"]);
  });
});