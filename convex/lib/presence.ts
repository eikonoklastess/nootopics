import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type ReaderCtx = QueryCtx | MutationCtx;
type PresenceStatus = Doc<"presence">["status"];
type UserDoc = Doc<"users">;

export type PresenceMap = Map<Id<"users">, Doc<"presence">>;

export async function resolvePresenceByUserIds(
  ctx: ReaderCtx,
  userIds: Id<"users">[],
) {
  const uniqueIds = [...new Set(userIds)];
  const presenceEntries = await Promise.all(
    uniqueIds.map(async (userId) => {
      const presence = await ctx.db
        .query("presence")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .unique();
      return presence ? ([userId, presence] as const) : null;
    }),
  );

  const presenceMap: PresenceMap = new Map();
  for (const entry of presenceEntries) {
    if (entry) {
      presenceMap.set(entry[0], entry[1]);
    }
  }
  return presenceMap;
}

export function getPresenceStatus(
  user: Pick<UserDoc, "_id" | "status">,
  presenceMap: PresenceMap,
): PresenceStatus | UserDoc["status"] {
  return presenceMap.get(user._id)?.status ?? user.status;
}

export function getLastSeen(
  user: Pick<UserDoc, "_id" | "lastSeen">,
  presenceMap: PresenceMap,
) {
  return presenceMap.get(user._id)?.lastSeen ?? user.lastSeen;
}
