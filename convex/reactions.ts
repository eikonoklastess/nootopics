import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireCurrentUser, requireCurrentUserForMutation, requireMessageAccess } from "./lib/auth";
import type { Id } from "./_generated/dataModel";

type GroupedReaction = {
  emoji: string;
  count: number;
  userIds: string[];
};

function groupReactionsByEmoji(
  reactions: Array<{ emoji: string; userId: Id<"users"> }>,
): GroupedReaction[] {
  const map = new Map<string, string[]>();
  for (const r of reactions) {
    const list = map.get(r.emoji);
    if (list) {
      list.push(r.userId);
    } else {
      map.set(r.emoji, [r.userId]);
    }
  }
  return Array.from(map, ([emoji, userIds]) => ({
    emoji,
    count: userIds.length,
    userIds,
  }));
}

export const list = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    await requireMessageAccess(ctx, args.messageId);
    const reactions = await ctx.db
      .query("reactions")
      .withIndex("by_message_id", (q) => q.eq("messageId", args.messageId))
      .take(500);
    return groupReactionsByEmoji(reactions);
  },
});

export const toggle = mutation({
  args: {
    messageId: v.id("messages"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireCurrentUserForMutation(ctx);
    await requireMessageAccess(ctx, args.messageId);

    const existing = await ctx.db
      .query("reactions")
      .withIndex("by_message_id_and_user_id_and_emoji", (q) =>
        q
          .eq("messageId", args.messageId)
          .eq("userId", user._id)
          .eq("emoji", args.emoji),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    } else {
      await ctx.db.insert("reactions", {
        messageId: args.messageId,
        userId: user._id,
        emoji: args.emoji,
      });
    }
  },
});

export const listForMessages = query({
  args: { messageIds: v.array(v.id("messages")) },
  handler: async (ctx, args) => {
    const result: Record<string, GroupedReaction[]> = {};
    for (const messageId of args.messageIds) {
      try {
        await requireMessageAccess(ctx, messageId);
      } catch {
        continue;
      }
      const reactions = await ctx.db
        .query("reactions")
        .withIndex("by_message_id", (q) => q.eq("messageId", messageId))
        .take(100);
      result[messageId] = groupReactionsByEmoji(reactions);
    }
    return result;
  },
});
