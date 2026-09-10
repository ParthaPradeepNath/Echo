"use client";

import { useUsername } from "@/hooks/use-username";
import { client } from "@/lib/client";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const Page = () => {
  return (
    <Suspense>
      <Lobby />
    </Suspense>
  );
};

export default Page;

function Lobby() {
  const { username } = useUsername();
  const router = useRouter();

  const searchParams = useSearchParams();
  const wasDestroyed = searchParams.get("destroyed") === "true";
  const error = searchParams.get("error");

  const { mutate: createRoom } = useMutation({
    mutationFn: async () => {
      const res = await client.room.create.post();

      if (res.status === 200) {
        router.push(`/room/${res.data?.roomId}`);
      }
    },
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {wasDestroyed && (
          <div className="border border-red-900 bg-red-950/50 p-4 text-center">
            <p className="text-sm font-bold text-red-500">ROOM DESTROYED</p>
            <p className="mt-1 text-xs text-zinc-500">
              All messages were permanently deleted.
            </p>
          </div>
        )}
        {error === "room-not-found" && (
          <div className="border border-red-900 bg-red-950/50 p-4 text-center">
            <p className="text-sm font-bold text-red-500">ROOM NOT FOUND</p>
            <p className="mt-1 text-xs text-zinc-500">
              This room may have expired or never existed.
            </p>
          </div>
        )}
        {error === "room-full" && (
          <div className="border border-red-900 bg-red-950/50 p-4 text-center">
            <p className="text-sm font-bold text-red-500">ROOM FULL</p>
            <p className="mt-1 text-xs text-zinc-500">
              This room has reached its maximum capacity.
            </p>
          </div>
        )}

        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-green-500">
            {">"}echo
          </h1>
          <p className="text-sm text-zinc-500">
            A private, self-destructing chat room.
          </p>
        </div>
        <div className="border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-md">
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="flex items-center text-zinc-500">
                Your Identity
              </label>

              <div className="flex items-center gap-3">
                <div className="flex-1 border border-zinc-800 bg-zinc-950 p-3 font-mono text-sm text-zinc-400">
                  {username}
                </div>
              </div>
            </div>

            <button
              onClick={() => createRoom()}
              className="mt-2 w-full cursor-pointer bg-zinc-100 p-3 text-sm font-bold text-black transition-colors hover:bg-zinc-50 hover:text-black disabled:opacity-50"
            >
              CREATE SECURE ROOM
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
