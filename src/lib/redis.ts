import { Redis } from "@upstash/redis";

// Fetching credentials from redis
export const redis = Redis.fromEnv();
