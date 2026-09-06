/**
 * CORS Configuration for the Elysia API
 * Handles cross-origin requests based on environment
 */

export function getCorsConfig() {
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
  ];

  // Add production domain if available
  if (process.env.NEXT_PUBLIC_API_URL) {
    const url = new URL(process.env.NEXT_PUBLIC_API_URL);
    allowedOrigins.push(url.origin);
  }

  // Add vercel domain if deployed
  if (process.env.VERCEL_URL) {
    allowedOrigins.push(`https://${process.env.VERCEL_URL}`);
  }

  // In production, use strict origin checking. In dev, allow any
  const origin =
    process.env.NODE_ENV === "production"
      ? allowedOrigins // Array: only these origins
      : true; // true: allows all origins (only for development)

  return {
    origin,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    credentials: true, // allow cookies/auth headers
    headers: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length", "X-JSON-Response-Size"],
    maxAge: 3600, // cache preflight for 1 hour
  };
}
