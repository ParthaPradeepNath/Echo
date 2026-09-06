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

  const meta = await redis.hgetall<{ connected: string[]; createdAt: number }>(
    `meta:${roomId}`,
  );

  if (!meta) {
    return NextResponse.redirect(new URL("/?error=room-not-found", req.url));
  }

  const existingToken = req.cookies.get("x-auth-token")?.value;

  // USER IS ALLOWED TO JOIN ROOM
  if (existingToken && meta.connected.includes(existingToken)) {
    return NextResponse.next();
  }

  // USER IS NOT ALLOWED TO JOIN
  if (meta.connected.length >= 2) {
    return NextResponse.redirect(new URL("/?error=room-full", req.url));
  }

  const response = NextResponse.next();

  // generated the token
  const token = nanoid();

  // attached a auth token to this response which is only strictly attached to our website only in the users browser
  response.cookies.set("x-auth-token", token, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  await redis.hset(`meta:${roomId}`, {
    connected: [...meta.connected, token], // 1st , 2nd user meta connected
  });

  return response;

  // OVERVIEW: CHECK IF USER IS ALLOWED TO JOIN ROOM
  // IF THEY ARE: LET THEM PASS
  // IF THET ARE NOT: SEND THEM BACK TO LOBBY
};

export const config = {
  matcher: "/room/:path*",
};
