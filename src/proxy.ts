import { NextRequest, NextResponse } from "next/server";
import { redis } from "./lib/redis";
import { nanoid } from "nanoid";

export const proxy = async (req: NextRequest) => {
  const pathname = req.nextUrl.pathname;

  const roomMatch = pathname.match(/^\/room\/([^/]+)$/);
  if (!roomMatch) {
    return NextResponse.redirect(new URL("/", req.url)); // redirect to home if not matching room pattern
  }

  const roomId = roomMatch[1];

  const meta = await redis.hgetall<{ createdAt: number }>(`meta:${roomId}`);

  if (!meta) {
    return NextResponse.redirect(new URL("/?error=room-not-found", req.url));
  }

  const existingToken = req.cookies.get("x-auth-token")?.value;

  // Check if user already has a valid token in the connected list
  if (existingToken) {
    const connected = await redis.lrange(`connected:${roomId}`, 0, -1);
    if (connected.includes(existingToken)) {
      return NextResponse.next();
    }
  }

  // Reject early if the room is already at capacity
  const count = await redis.llen(`connected:${roomId}`);
  if (count >= 2) {
    return NextResponse.redirect(new URL("/?error=room-full", req.url));
  }

  // Issue a fresh token and register this participant
  const token = nanoid();
  await redis.rpush(`connected:${roomId}`, token);

  const response = NextResponse.next();

  response.cookies.set("x-auth-token", token, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  return response;

  // OVERVIEW: CHECK IF USER IS ALLOWED TO JOIN ROOM
  // IF THEY ARE: LET THEM PASS
  // IF THET ARE NOT: SEND THEM BACK TO LOBBY
};

export const config = {
  matcher: "/room/:path*",
};
