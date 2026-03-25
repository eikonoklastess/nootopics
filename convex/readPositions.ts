import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import {
  requireConversationAccess,
  requireCurrentUser,
  requireServerMembership,
} from "./lib/auth";
import {
  computeUnreadCountFromCounters,
  countUnreadTopLevelMessagesSince,
  getTopLevelMessageCount,
  type MessageLocation,
} from "./lib/messages";

const conversationArgs = {
  channelId: v.optional(v.id("channels")),
  directConversationId: v.optional(v.id("directConversations")),
};

export const markAsRead = mutation({
  args: conversationArgs,
  handler: async (ctx, args) => {
    const access = await requireConversationAccess(ctx, getConversationTarget(args));
    const location = getMessageLocation(access);

    const existing =
      access.kind === "channel"
        ? await ctx.db
            .query("readPositions")
            .withIndex("by_user_id_and_channel_id", (q) =>
              q.eq("userId", access.user._id).eq("channelId", access.channel._id),
            )
            .unique()
        : await ctx.db
            .query("readPositions")
            .withIndex("by_user_id_and_direct_conversation_id", (q) =>
              q
                .eq("userId", access.user._id)
                .eq("directConversationId", access.directConversation._id),
            )
            .unique();

    const now = Date.now();
    const currentTopLevelMessageCount =
      access.kind === "channel"
        ? await getTopLevelMessageCount(ctx, location, access.channel)
        : await getTopLevelMessageCount(ctx, location, access.directConversation);

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastReadTime: now,
        lastReadTopLevelMessageCount: currentTopLevelMessageCount,
      });
      return;
    }

    await ctx.db.insert("readPositions", {
      userId: access.user._id,
      lastReadTime: now,
      lastReadTopLevelMessageCount: currentTopLevelMessageCount,
      ...(access.kind === "channel"
        ? { channelId: access.channel._id }
        : { directConversationId: access.directConversation._id }),
    });
  },
});

export const getUnreadCounts = query({
  args: {
    serverId: v.id("servers"),
  },
  handler: async (ctx, args) => {
    let user;
    try {
      ({ user } = await requireServerMembership(ctx, args.serverId));
    } catch {
      return {};
    }

    const channels = await ctx.db
      .query("channels")
      .withIndex("by_server_id", (q) => q.eq("serverId", args.serverId))
      .collect();

    const counts: Record<string, number> = {};

    for (const channel of channels) {
      const readPosition = await ctx.db
        .query("readPositions")
        .withIndex("by_user_id_and_channel_id", (q) =>
          q.eq("userId", user._id).eq("channelId", channel._id)
        )
        .unique();

      const unreadFromCounters = computeUnreadCountFromCounters(
        channel.topLevelMessageCount,
        readPosition?.lastReadTopLevelMessageCount,
      );

      const unreadCount =
        unreadFromCounters ??
        (await countUnreadTopLevelMessagesSince(
          ctx,
          { kind: "channel", channelId: channel._id },
          readPosition?.lastReadTime ?? 0,
        ));

      if (unreadCount > 0) {
        counts[channel._id] = unreadCount;
      }
    }

    return counts;
  },
});

export const getDirectUnreadCounts = query({
  args: {},
  handler: async (ctx) => {
    let user;
    try {
      ({ user } = await requireCurrentUser(ctx));
    } catch {
      return {};
    }

    const memberships = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    const counts: Record<string, number> = {};

    for (const membership of memberships) {
      const directConversation = await ctx.db.get(membership.directConversationId);
      if (!directConversation) {
        continue;
      }

      const readPosition = await ctx.db
        .query("readPositions")
        .withIndex("by_user_id_and_direct_conversation_id", (q) =>
          q.eq("userId", user._id).eq("directConversationId", directConversation._id)
        )
        .unique();

      const unreadFromCounters = computeUnreadCountFromCounters(
        directConversation.topLevelMessageCount,
        readPosition?.lastReadTopLevelMessageCount,
      );
      const unreadCount =
        unreadFromCounters ??
        (await countUnreadTopLevelMessagesSince(
          ctx,
          {
            kind: "direct",
            directConversationId: directConversation._id,
          },
          readPosition?.lastReadTime ?? 0,
        ));

      if (unreadCount > 0) {
        counts[directConversation._id] = unreadCount;
      }
    }

    return counts;
  },
});

export const getLastReadTime = query({
  args: conversationArgs,
  handler: async (ctx, args) => {
    let access;
    try {
      access = await requireConversationAccess(ctx, getConversationTarget(args));
    } catch {
      return 0;
    }

    const position =
      access.kind === "channel"
        ? await ctx.db
            .query("readPositions")
            .withIndex("by_user_id_and_channel_id", (q) =>
              q.eq("userId", access.user._id).eq("channelId", access.channel._id)
            )
            .unique()
        : await ctx.db
            .query("readPositions")
            .withIndex("by_user_id_and_direct_conversation_id", (q) =>
              q
                .eq("userId", access.user._id)
                .eq("directConversationId", access.directConversation._id)
            )
            .unique();

    return position?.lastReadTime ?? 0;
  },
});

function getConversationTarget(args: {
  channelId?: Id<"channels">;
  directConversationId?: Id<"directConversations">;
}) {
  if (args.channelId && args.directConversationId) {
    throw new Error("Choose either a channel or direct conversation");
  }
  if (args.channelId) {
    return { channelId: args.channelId } as const;
  }
  if (args.directConversationId) {
    return { directConversationId: args.directConversationId } as const;
  }
  throw new Error("Conversation target is required");
}

function getMessageLocation(
  access: Awaited<ReturnType<typeof requireConversationAccess>>,
): MessageLocation {
  return access.kind === "channel"
    ? { kind: "channel", channelId: access.channel._id }
    : {
        kind: "direct",
        directConversationId: access.directConversation._id,
      };
}
