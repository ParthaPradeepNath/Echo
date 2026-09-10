import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// In-memory Redis mock shared by every test via the mocked "@/lib/redis".
// The MockRedis class is defined inline (no imports) so it can live inside
// vi.hoisted, which executes before the module graph resolves.
const mocks = vi.hoisted(() => {
  class MockRedis {
    store = new Map<string, unknown>();
    expiries = new Map<string, number>();

    reset() {
      this.store.clear();
      this.expiries.clear();
    }

    private isAlive(key: string) {
      return this.store.has(key);
    }

    async hset(key: string, fields: Record<string, unknown>) {
      const prev = (this.store.get(key) as Record<string, unknown>) ?? {};
      this.store.set(key, { ...prev, ...fields });
      return 1;
    }

    async hgetall<T = Record<string, unknown>>(key: string): Promise<T | null> {
      const v = this.store.get(key);
      return v == null ? null : (v as T);
    }

    async hget(key: string, field: string): Promise<unknown> {
      const h = this.store.get(key) as Record<string, unknown> | undefined;
      return h?.[field];
    }

    async rpush(key: string, ...values: unknown[]) {
      const list = [...((this.store.get(key) as unknown[]) ?? [])];
      list.push(...values);
      this.store.set(key, list);
      return list.length;
    }

    async lrange<T = string>(key: string, start: number, stop: number) {
      const list = (this.store.get(key) as T[]) ?? [];
      const end = stop === -1 ? list.length - 1 : stop;
      return list.slice(start, end + 1);
    }

    async llen(key: string) {
      return ((this.store.get(key) as unknown[]) ?? []).length;
    }

    async exists(...keys: string[]) {
      return keys.filter((k) => this.isAlive(k)).length;
    }

    async del(...keys: string[]) {
      let count = 0;
      for (const k of keys) {
        if (this.store.delete(k)) count++;
      }
      return count;
    }

    async expire(key: string, seconds: number) {
      this.expiries.set(key, Date.now() + seconds * 1000);
      return 1;
    }

    async ttl(key: string) {
      if (!this.isAlive(key)) return -2;
      const exp = this.expiries.get(key);
      if (exp == null) return -1;
      return Math.max(1, Math.round((exp - Date.now()) / 1000));
    }
  }

  const instance = new MockRedis();

  // Realtime mock records every emit so tests can assert on chat.message/destroy.
  const realtimeCalls: Array<{
    channel: string;
    event: string;
    data: unknown;
  }> = [];
  const realtime = {
    calls: realtimeCalls,
    channel: (channel: string) => {
      const emit = async (event: string, data: unknown) => {
        realtimeCalls.push({ channel, event, data });
        return true;
      };
      return { emit };
    },
  };

  return { instance, realtime };
});

vi.mock("@/lib/redis", () => ({ redis: mocks.instance }));
vi.mock("@/lib/realtime", () => ({ realtime: mocks.realtime }));

if (typeof Element !== "undefined") {
  Element.prototype.scrollIntoView = () => {};
}