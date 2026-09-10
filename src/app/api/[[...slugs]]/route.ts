import { redis } from "@/lib/redis";
import { Elysia } from "elysia";
import { nanoid } from "nanoid";
import { authMiddleware, AuthError } from "./auth";
import { z } from "zod";
import { Message, realtime } from "@/lib/realtime";
import { getCorsConfig } from "@/lib/cors";
import cors from "@elysiajs/cors";

const ROOM_TTL_SECONDS = 60 * 10; // 10min

const rooms = new Elysia({ prefix: "/room" })
  .post("/create", async () => {
    try {
      const roomId = nanoid();

      await redis.hset(`meta:${roomId}`, {
        createdAt: Date.now(),
      });

      await redis.expire(`meta:${roomId}`, ROOM_TTL_SECONDS);

      return { roomId };
    } catch (error) {
      // This will print the REAL error to your VS Code terminal
      console.error("FAILED TO CREATE ROOM:", error);
      throw error;
    }
  })
  .use(authMiddleware)
  .get(
    "/ttl",
    async ({ auth }) => {
      const ttl = await redis.ttl(`meta:${auth.roomId}`);
      return { ttl: ttl > 0 ? ttl : 0 };
    },
    { query: z.object({ roomId: z.string() }) },
  )
  .delete(
    "/",
    async ({ auth }) => {
      await realtime
        .channel(auth.roomId)
        .emit("chat.destroy", { isDestroyed: true });
      // to make the API fast, otherwise one by one await executes
      await Promise.all([
        redis.del(`meta:${auth.roomId}`),
        redis.del(`messages:${auth.roomId}`),
        redis.del(`connected:${auth.roomId}`),
        redis.del(`history:${auth.roomId}`),
      ]);
    },
    { query: z.object({ roomId: z.string() }) },
  );

const messages = new Elysia({ prefix: "/messages" })
  .use(authMiddleware)
  .post(
    "/",
    async ({ body, auth }) => {
      const { sender, text } = body;
      const { roomId } = auth;

      const roomExists = await redis.exists(`meta:${roomId}`);

      if (!roomExists) {
        throw new Error("Room does not exist");
      }

      const message: Message = {
        id: nanoid(),
        sender,
        text,
        timestamp: Date.now(),
        roomId,
      };

      // add message t history
      await redis.rpush(`messages:${roomId}`, {
        ...message,
        token: auth.token,
      });
      await realtime.channel(roomId).emit("chat.message", message);

      // housekeeping(ttl - time to live in redis)
      const remaining = await redis.ttl(`meta:${roomId}`);

      if (remaining > 0) {
        await redis.expire(`messages:${roomId}`, remaining);
      }
    },
    {
      query: z.object({ roomId: z.string() }),
      body: z.object({
        sender: z.string().max(100),
        text: z.string().max(1000),
      }),
    },
  )
  .get(
    "/",
    async ({ auth }) => {
      const messages = await redis.lrange<Message>(
        `messages:${auth.roomId}`,
        0,
        -1,
      );

      return {
        messages: messages.map((m) => ({
          ...m,
          token: m.token === auth.token ? auth.token : undefined,
        })),
      };
    },
    {
      query: z.object({ roomId: z.string() }),
    },
  );

const app = new Elysia({ prefix: "/api" })
  .onError(({ code, set, error }) => {
    if (error instanceof AuthError) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    console.error("API ERROR:", code, error);
  })
  .use(cors(getCorsConfig()))
  .use(rooms)
  .use(messages);

export const GET = app.fetch;
export const POST = app.fetch;
export const DELETE = app.fetch;

export type App = typeof app;
