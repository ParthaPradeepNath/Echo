"use client";

import { useUsername } from "@/hooks/use-username";
import { client } from "@/lib/client";
import { useRealtime } from "@/lib/realtime-client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function formatTimeRemaining(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${mins}:${sec.toString().padStart(2, "0")}`;
}

const Page = () => {
  const params = useParams();
  const roomId = params.roomId as string;

  const router = useRouter();

  const { username } = useUsername();
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const [copyStatus, setCopyStatus] = useState("COPY");
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: ttlData } = useQuery({
    queryKey: ["ttl", roomId],
    queryFn: async () => {
      const res = await client.room.ttl.get({
        query: { roomId },
      });
      return res.data;
    },
  });

  const deadlineRef = useRef<number | null>(null);

  useEffect(() => {
    if (ttlData?.ttl === undefined || deadlineRef.current !== null) return;

    deadlineRef.current = Date.now() + ttlData.ttl * 1000;

    const interval = setInterval(() => {
      if (deadlineRef.current === null) return;
      const remaining = Math.max(
        0,
        Math.ceil((deadlineRef.current - Date.now()) / 1000),
      );
      setTimeRemaining(remaining);

      if (remaining === 0) {
        clearInterval(interval);
        router.push("/?destroyed=true");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [ttlData, router]);

  const { data: messages, refetch } = useQuery({
    queryKey: ["messages", roomId],
    queryFn: async () => {
      const res = await client.messages.get({ query: { roomId } });
      return res.data;
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const { mutate: sendMessage, isPending } = useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      await client.messages.post(
        { sender: username, text },
        { query: { roomId } },
      );
      setInput("");
    },
  });

  useRealtime({
    channels: [roomId],
    events: ["chat.message", "chat.destroy"],
    onData: ({ event }) => {
      if (event === "chat.message") {
        refetch();
      }

      if (event === "chat.destroy") {
        router.push("/?destroyed=true");
      }
    },
  });

  const { mutate: destroyRoom } = useMutation({
    mutationFn: async () => {
      await client.room.delete(null, { query: { roomId } });
    },
  });

  const copyLink = () => {
    const url = window.location.href; // where the user is currently is
    navigator.clipboard.writeText(url); // copies the url to clipboard
    setCopyStatus("COPIED!");

    setTimeout(() => setCopyStatus("COPY"), 2000);
  };

  return (
    <main className="flex h-screen max-h-screen flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/30 p-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-zinc-500 uppercase">Room ID</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-green-500">{roomId}</span>
              <button
                onClick={copyLink}
                className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
              >
                {copyStatus}
              </button>
            </div>
          </div>

          <div className="h-8 w-px bg-zinc-800" />

          <div className="flex flex-col">
            <span className="text-xs text-zinc-500 uppercase">
              Self-Destruct
            </span>
            <span
              className={`flex items-center gap-2 text-sm font-bold ${
                timeRemaining !== null && timeRemaining < 60
                  ? "text-red-500"
                  : "text-amber-500"
              }`}
            >
              {timeRemaining !== null
                ? formatTimeRemaining(timeRemaining)
                : "--:--"}
            </span>
          </div>
        </div>

        <button
          onClick={() => destroyRoom()}
          className="group flex items-center gap-2 rounded bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-400 transition-all hover:bg-red-600 hover:text-white disabled:opacity-50"
        >
          <span className="group-hover:animate-pulse">💣</span>
          DESTROY NOW
        </button>
      </header>

      {/* MESSAGES */}
      <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-4">
        {messages?.messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="font-mono text-sm text-zinc-600">
              No messages yet, Start the conversation.
            </p>
          </div>
        )}
        {messages?.messages.map((msg) => (
          <div key={msg.id} className="flex flex-col items-start">
            <div className="group max-w-[80%]">
              <div className="mb-1 flex items-baseline gap-3">
                <span
                  className={`text-xs font-bold ${
                    msg.sender === username ? "text-green-500" : "text-blue-500"
                  }`}
                >
                  {msg.sender === username ? "You" : msg.sender}
                </span>
                <span className="text-[10px] text-zinc-600">
                  {format(msg.timestamp, "hh:mm a")}
                </span>
              </div>
              <p className="text-sm leading-relaxed break-all text-zinc-300">
                {msg.text}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-zinc-800 bg-zinc-900/30 p-4">
        <div className="flex gap-4">
          <div className="group relative flex-1">
            <span className="absolute top-1/2 left-4 -translate-y-1/2 animate-pulse text-green-500">
              {">"}
            </span>
            <input
              autoFocus
              ref={inputRef}
              type="text"
              value={input}
              onKeyDown={(e) => {
                if (e.key === "Enter" && input.trim()) {
                  // SEND MESSAGE LOGIC HERE
                  sendMessage({ text: input });
                  inputRef.current?.focus(); // input should stay focused after sending in the input box
                }
              }}
              placeholder="Type message..."
              onChange={(e) => setInput(e.target.value)}
              className="w-full border border-zinc-800 bg-black py-3 pr-4 pl-8 text-sm text-zinc-100 transition-colors placeholder:text-zinc-700 focus:border-zinc-700 focus:outline-none"
            />
          </div>

          <button
            onClick={() => {
              sendMessage({ text: input });
              inputRef.current?.focus();
            }}
            disabled={!input.trim() || isPending}
            className="cursor-pointer bg-zinc-800 px-6 text-sm font-bold text-zinc-400 transition-all hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            SEND
          </button>
        </div>
      </div>
    </main>
  );
};

export default Page;
