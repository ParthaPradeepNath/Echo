// AUTH MIDDLEWARE

import { redis } from "@/lib/redis";
import Elysia from "elysia";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export const authMiddleware = new Elysia({ name: "auth" })
  .derive({ as: "scoped" }, async ({ query, cookie }) => {
    const roomId = query.roomId;
    const token = cookie["x-auth-token"]?.value as string | undefined;

    if (!roomId || !token) {
      throw new AuthError("Missing roomId or token.");
    }

    const connected = await redis.lrange(`connected:${roomId}`, 0, -1);

    if (!connected.includes(token)) {
      throw new AuthError("Invalid token");
    }

    return { auth: { roomId, token, connected } };
  });
