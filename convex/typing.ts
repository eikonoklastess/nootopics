import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireConversationAccess } from "./lib/auth";
import { resolveUsersById } from "./lib/messages";

const TYPING_TIMEOUT_MS = 3000;
const conversationArgs = {
  channelId: v.optional(v.id("channels")),
  directConversationId: v.optional(v.id("directConversations")),
};

export const heartbeat = mutation({
  args: conversationArgs,
  handler: async (ctx, args) => {
    const access = await requireConversationAccess(ctx, getConversationTarget(args));

    const existing =
      access.kind === "channel"
        ? await ctx.db
            .query("typing")
            .withIndex("by_channel_id_and_user_id", (q) =>
              q.eq("channelId", access.channel._id).eq("userId", access.user._id),
            )
            .unique()
        : await ctx.db
            .query("typing")
            .withIndex("by_direct_conversation_id_and_user_id", (q) =>
              q
                .eq("directConversationId", access.directConversation._id)
                .eq("userId", access.user._id),
            )
            .unique();

    const expiresAt = Date.now() + TYPING_TIMEOUT_MS;

    if (existing) {
      await ctx.db.patch(existing._id, { expiresAt });
      return;
    }

    await ctx.db.insert("typing", {
      userId: access.user._id,
      expiresAt,
      ...(access.kind === "channel"
        ? { channelId: access.channel._id }
        : { directConversationId: access.directConversation._id }),
    });
  },
});

export const stop = mutation({
  args: conversationArgs,
  handler: async (ctx, args) => {
    let access;
    try {
      access = await requireConversationAccess(ctx, getConversationTarget(args));
    } catch {
      return;
    }

    const existing =
      access.kind === "channel"
        ? await ctx.db
            .query("typing")
            .withIndex("by_channel_id_and_user_id", (q) =>
              q.eq("channelId", access.channel._id).eq("userId", access.user._id),
            )
            .unique()
        : await ctx.db
            .query("typing")
            .withIndex("by_direct_conversation_id_and_user_id", (q) =>
              q
                .eq("directConversationId", access.directConversation._id)
                .eq("userId", access.user._id),
            )
            .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const list = query({
  args: conversationArgs,
  handler: async (ctx, args) => {
    let access;
    try {
      access = await requireConversationAccess(ctx, getConversationTarget(args));
    } catch {
      return [];
    }

    const now = Date.now();
    const typingRecords =
      access.kind === "channel"
        ? await ctx.db
            .query("typing")
            .withIndex("by_channel_id", (q) => q.eq("channelId", access.channel._id))
            .take(20)
        : await ctx.db
            .query("typing")
            .withIndex("by_direct_conversation_id", (q) =>
              q.eq("directConversationId", access.directConversation._id),
            )
            .take(20);

    const activeRecords = typingRecords.filter(
      (record) => record.expiresAt >= now && record.userId !== access.user._id,
    );
    const users = await resolveUsersById(
      ctx,
      activeRecords.map((record) => record.userId),
    );

    const activeTypers: { imageUrl: string; name: string }[] = [];
    for (const record of activeRecords) {
      const user = users.get(record.userId);
      if (user) {
        activeTypers.push({ name: user.name, imageUrl: user.imageUrl });
      }
    }

    return activeTypers;
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
