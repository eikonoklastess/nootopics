import { describe, expect, it } from "vitest";
import {
  isPrivilegedRole,
  requireServerMembership,
  requireThreadParentAccess,
} from "./auth";

type MockDoc = { _id: string; [key: string]: unknown };

class MockQuery {
  constructor(private rows: MockDoc[]) {}

  withIndex(
    _indexName: string,
    builder: (q: { eq: (field: string, value: unknown) => unknown }) => unknown,
  ) {
    const conditions: Array<[string, unknown]> = [];
    const q = {
      eq: (field: string, value: unknown) => {
        conditions.push([field, value]);
        return q;
      },
    };
    builder(q);
    return new MockQuery(
      this.rows.filter((row) =>
        conditions.every(([field, value]) => row[field] === value),
      ),
    );
  }

  async unique() {
    return this.rows[0] ?? null;
  }
}

function createMockCtx({
  identity,
  tables,
}: {
  identity: { subject: string; tokenIdentifier: string } | null;
  tables: Record<string, MockDoc[]>;
}) {
  const docMap = new Map<string, MockDoc>();
  for (const rows of Object.values(tables)) {
    for (const row of rows) {
      docMap.set(row._id, row);
    }
  }

  return {
    auth: {
      getUserIdentity: async () => identity,
    },
    db: {
      get: async (id: string) => docMap.get(id) ?? null,
      query: (table: string) => new MockQuery(tables[table] ?? []),
    },
  };
}

describe("auth helpers", () => {
  it("returns true for admin and moderator roles", () => {
    expect(isPrivilegedRole("ADMIN")).toBe(true);
    expect(isPrivilegedRole("MODERATOR")).toBe(true);
  });

  it("returns false for guest roles", () => {
    expect(isPrivilegedRole("GUEST")).toBe(false);
  });

  it("resolves the current user from tokenIdentifier and verifies membership", async () => {
    const ctx = createMockCtx({
      identity: { subject: "clerk-subject", tokenIdentifier: "token-123" },
      tables: {
        users: [
          {
            _id: "user_1",
            clerkId: "legacy-subject",
            tokenIdentifier: "token-123",
          },
        ],
        servers: [{ _id: "server_1" }],
        members: [
          {
            _id: "member_1",
            serverId: "server_1",
            userId: "user_1",
            role: "ADMIN",
          },
        ],
      },
    });

    const access = await requireServerMembership(ctx as never, "server_1" as never);

    expect(access.user._id).toBe("user_1");
    expect(access.member.role).toBe("ADMIN");
    expect(access.server._id).toBe("server_1");
  });

  it("rejects access when the user is not a member of the server", async () => {
    const ctx = createMockCtx({
      identity: { subject: "clerk-subject", tokenIdentifier: "token-123" },
      tables: {
        users: [
          {
            _id: "user_1",
            clerkId: "legacy-subject",
            tokenIdentifier: "token-123",
          },
        ],
        servers: [{ _id: "server_1" }],
        members: [],
      },
    });

    await expect(
      requireServerMembership(ctx as never, "server_1" as never),
    ).rejects.toThrow("Forbidden");
  });

  it("rejects thread roots that are already replies", async () => {
    const ctx = createMockCtx({
      identity: { subject: "clerk-subject", tokenIdentifier: "token-123" },
      tables: {
        users: [
          {
            _id: "user_1",
            clerkId: "legacy-subject",
            tokenIdentifier: "token-123",
          },
        ],
        servers: [{ _id: "server_1" }],
        channels: [{ _id: "channel_1", serverId: "server_1" }],
        members: [
          {
            _id: "member_1",
            serverId: "server_1",
            userId: "user_1",
            role: "ADMIN",
          },
        ],
        messages: [
          {
            _id: "message_1",
            channelId: "channel_1",
            userId: "user_1",
            threadId: "parent_1",
          },
        ],
      },
    });

    await expect(
      requireThreadParentAccess(ctx as never, "message_1" as never),
    ).rejects.toThrow("Thread replies cannot be used as thread roots");
  });
});
