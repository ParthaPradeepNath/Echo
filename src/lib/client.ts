import { treaty } from "@elysiajs/eden";
import type { App } from "../app/api/[[...slugs]]/route";

// remove trailing slash if present
const PUBLIC_API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

// in the browser use the current origin (deployed app) unless NEXT_PUBLIC_API_URL is set
const apiUrl =
  typeof window !== "undefined"
    ? PUBLIC_API || window.location.origin
    : PUBLIC_API || "http://localhost:3000";

export const client = treaty<App>(apiUrl).api;
