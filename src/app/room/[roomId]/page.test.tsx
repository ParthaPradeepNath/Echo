// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { clientMock, usernameMock, pushMock } = vi.hoisted(() => {
    const messages: Record<string, unknown>[] = [];
    const postCalls: Array<{ body: unknown; opts: unknown }> = [];

    return {
      clientMock: {
        room: {
          ttl: {
            get: vi.fn(async () => ({ data: { ttl: 600 } })),
          },
          delete: vi.fn(async () => ({ status: 200 })),
        },
        messages: {
          get: vi.fn(async () => ({ data: { messages } })),
          post: vi.fn(async (body: unknown, opts: unknown) => {
            postCalls.push({ body, opts });
            return { status: 200 };
          }),
        },
        _messages: messages,
        _postCalls: postCalls,
      },
      usernameMock: "anon-tester",
      pushMock: vi.fn(),
    };
  },
);

vi.mock("@/lib/client", () => ({ client: clientMock }));
vi.mock("@/hooks/use-username", () => ({
  useUsername: () => ({ username: usernameMock }),
}));
vi.mock("@/lib/realtime-client", () => ({
  useRealtime: () => {},
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ roomId: "test-room" }),
  useRouter: () => ({ push: pushMock }),
}));

import Page from "./page";

const user = userEvent.setup();

const renderPage = () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <Page />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  clientMock._messages.length = 0;
  clientMock._postCalls.length = 0;
  clientMock.messages.post.mockClear();
  vi.clearAllMocks();
});

describe("room page layout", () => {
  it("shows empty-state text when there are no messages", async () => {
    renderPage();
    expect(
      await screen.findByText(/No messages yet/),
    ).toBeInTheDocument();
  });

  it("renders own messages right-aligned with 'You' label", async () => {
    clientMock._messages.push({
      id: "m1",
      sender: "anon-tester",
      text: "hi from me",
      timestamp: Date.now(),
      roomId: "test-room",
    });

    renderPage();
    const youLabel = await screen.findByText("You");
    const bubble = youLabel.closest(".justify-end");
    expect(bubble).not.toBeNull();
    expect(screen.getByText("hi from me")).toBeInTheDocument();
  });

  it("renders other users' messages left-aligned", async () => {
    clientMock._messages.push({
      id: "m2",
      sender: "beta",
      text: "hi from beta",
      timestamp: Date.now(),
      roomId: "test-room",
    });

    renderPage();
    const label = await screen.findByText("beta");
    const bubble = label.closest(".justify-start");
    expect(bubble).not.toBeNull();
    expect(screen.getByText("hi from beta")).toBeInTheDocument();
  });
});

describe("sending a message", () => {
  it("clears input and calls messages.post with the correct payload", async () => {
    renderPage();
    await screen.findByText(/No messages yet/);

    const input = screen.getByPlaceholderText("Type message...");
    const sendBtn = screen.getByRole("button", { name: "SEND" });

    await user.type(input, "yo!");
    await user.click(sendBtn);

    await waitFor(() => {
      expect(clientMock.messages.post).toHaveBeenCalledTimes(1);
    });

    expect(clientMock._postCalls[0]).toEqual({
      body: { sender: "anon-tester", text: "yo!" },
      opts: { query: { roomId: "test-room" } },
    });

    expect(input).toHaveValue("");
  });

  it("clears input on Enter key", async () => {
    renderPage();
    await screen.findByText(/No messages yet/);

    const input = screen.getByPlaceholderText("Type message...");
    await user.type(input, "quick");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(clientMock.messages.post).toHaveBeenCalledTimes(1);
    });
    expect(input).toHaveValue("");
  });
});