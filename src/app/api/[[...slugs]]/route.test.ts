import { beforeEach, describe, expect, it } from "vitest";
import { redis } from "@/lib/redis";
import { realtime } from "@/lib/realtime";
import { GET, POST, DELETE } from "./route";

const API = "http://test";

const rq = (
  method: string,
  path: string,
  body?: unknown,
  cookie?: string,
) => {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  if (body) headers["content-type"] = "application/json";
  return new Request(`${API}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
};

const seedRoom = async (id: string, extraConnected: string[] = []) => {
  await redis.hset(`meta:${id}`, { createdAt: Date.now() });
  await redis.expire(`meta:${id}`, 600);
  for (const t of extraConnected) await redis.rpush(`connected:${id}`, t);
};

beforeEach(() => {
  (redis as unknown as { reset(): void }).reset();
  const rt = realtime as unknown as { calls: unknown[] };
  rt.calls.length = 0;
});

describe("POST /api/room/create", () => {
  it("creates a room with a TTL", async () => {
    const res = await POST(rq("POST", "/api/room/create"));
    expect(res.status).toBe(200);

    const { roomId } = (await res.json()) as { roomId: string };
    expect(typeof roomId).toBe("string");
    expect(roomId.length).toBeGreaterThan(0);

    const ttl = await redis.ttl(`meta:${roomId}`);
    expect(ttl).toBeGreaterThan(0);
  });
});

describe("GET /api/room/ttl", () => {
  it("returns remaining TTL for a valid room", async () => {
    const id = "ttl-room";
    await seedRoom(id, ["tok-a"]);

    const res = await GET(
      rq("GET", `/api/room/ttl?roomId=${id}`, undefined, "x-auth-token=tok-a"),
    );
    expect(res.status).toBe(200);
    const { ttl } = (await res.json()) as { ttl: number };
    expect(ttl).toBeGreaterThan(0);
  });

  it("returns 401 with no cookie", async () => {
    const id = "ttl-room2";
    await seedRoom(id, ["tok-a"]);

    const res = await GET(rq("GET", `/api/room/ttl?roomId=${id}`));
    expect(res.status).toBe(401);
  });

  it("returns 401 with an invalid token", async () => {
    const id = "ttl-room3";
    await seedRoom(id, ["tok-a"]);

    const res = await GET(
      rq("GET", `/api/room/ttl?roomId=${id}`, undefined, "x-auth-token=wrong"),
    );
    expect(res.status).toBe(401);
  });
});

describe("POST /api/messages", () => {
  it("stores the message and emits chat.message", async () => {
    const id = "msg-room";
    await seedRoom(id, ["tok-a"]);

    const res = await POST(
      rq(
        "POST",
        `/api/messages?roomId=${id}`,
        { sender: "user-a", text: "hello" },
        "x-auth-token=tok-a",
      ),
    );
    expect(res.status).toBe(200);

    const stored = await redis.lrange(`messages:${id}`, 0, -1);
    expect(stored).toHaveLength(1);
    expect((stored[0] as unknown as { text: string }).text).toBe("hello");

    const calls = (realtime as unknown as { calls: Array<{ event: string }> })
      .calls;
    expect(calls).toHaveLength(1);
    expect(calls[0].event).toBe("chat.message");
  });

  it("rejects when room does not exist", async () => {
    await seedRoom("ghost-room", ["tok-a"]);
    await redis.del("meta:ghost-room");

    const res = await POST(
      rq(
        "POST",
        "/api/messages?roomId=ghost-room",
        { sender: "a", text: "hi" },
        "x-auth-token=tok-a",
      ),
    );
    expect(res.status).toBe(500);
  });
});

describe("GET /api/messages", () => {
  it("returns messages with token stripped for the requesting user", async () => {
    const id = "list-room";
    const storedMsg = {
      id: "m1",
      sender: "beta",
      text: "hey",
      timestamp: Date.now(),
      roomId: id,
      token: "tok-b",
    };
    await seedRoom(id, ["tok-b"]);
    await redis.rpush(`messages:${id}`, storedMsg);

    const res = await GET(
      rq("GET", `/api/messages?roomId=${id}`, undefined, "x-auth-token=tok-b"),
    );
    expect(res.status).toBe(200);
    const { messages } = (await res.json()) as { messages: Array<{ token?: string }> };
    expect(messages).toHaveLength(1);
    expect(messages[0].token).toBe("tok-b");
  });

  it("masks the token when queried by a different user", async () => {
    const id = "mask-room";
    const storedMsg = {
      id: "m2",
      sender: "beta",
      text: "hey",
      timestamp: Date.now(),
      roomId: id,
      token: "tok-b",
    };
    await seedRoom(id, ["tok-a", "tok-b"]);
    await redis.rpush(`messages:${id}`, storedMsg);

    const res = await GET(
      rq("GET", `/api/messages?roomId=${id}`, undefined, "x-auth-token=tok-a"),
    );
    const { messages } = (await res.json()) as { messages: Array<{ token?: string }> };
    expect(messages[0].token).toBeUndefined();
  });
});

describe("DELETE /api/room", () => {
  it("destroys the room and emits chat.destroy", async () => {
    const id = "del-room";
    await seedRoom(id, ["tok-a"]);
    await redis.rpush(`messages:${id}`, {
      id: "m1",
      sender: "a",
      text: "bye",
      timestamp: Date.now(),
      roomId: id,
    });

    const res = await DELETE(
      rq("DELETE", `/api/room?roomId=${id}`, undefined, "x-auth-token=tok-a"),
    );
    expect(res.status).toBe(200);

    expect(await redis.exists(`meta:${id}`)).toBe(0);
    expect(await redis.exists(`messages:${id}`)).toBe(0);
    expect(await redis.exists(`connected:${id}`)).toBe(0);

    const calls = (realtime as unknown as { calls: Array<{ event: string }> })
      .calls;
    expect(calls.some((c) => c.event === "chat.destroy")).toBe(true);
  });
});