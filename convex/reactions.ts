import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireCurrentUserForMutation, requireMessageAccess } from "./lib/auth";
import type { Doc, Id } from "./_generated/dataModel";

type GroupedReaction = {
  emoji: string;
  count: number;
  userIds: string[];
};

export const list = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const { message } = await requireMessageAccess(ctx, args.messageId);
    return message.reactionSummary ?? [];
  },
});

export const toggle = mutation({
  args: {
    messageId: v.id("messages"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireCurrentUserForMutation(ctx);
    const { message } = await requireMessageAccess(ctx, args.messageId);

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
      await ctx.db.patch(args.messageId, {
        reactionSummary: applyReactionChange(
          message.reactionSummary,
          args.emoji,
          user._id,
          "remove",
        ),
      });
    } else {
      await ctx.db.insert("reactions", {
        messageId: args.messageId,
        userId: user._id,
        emoji: args.emoji,
      });
      await ctx.db.patch(args.messageId, {
        reactionSummary: applyReactionChange(
          message.reactionSummary,
          args.emoji,
          user._id,
          "add",
        ),
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
        const { message } = await requireMessageAccess(ctx, messageId);
        result[messageId] = message.reactionSummary ?? [];
      } catch {
        continue;
      }
    }
    return result;
  },
});

function applyReactionChange(
  currentSummary: Doc<"messages">["reactionSummary"],
  emoji: string,
  userId: Id<"users">,
  mode: "add" | "remove",
) {
  const nextSummary = [...(currentSummary ?? [])];
  const existingIndex = nextSummary.findIndex((entry) => entry.emoji === emoji);

  if (mode === "add") {
    if (existingIndex === -1) {
      nextSummary.push({
        emoji,
        count: 1,
        userIds: [userId],
      });
      return nextSummary;
    }

    const entry = nextSummary[existingIndex];
    if (entry.userIds.includes(userId)) {
      return nextSummary;
    }

    nextSummary[existingIndex] = {
      ...entry,
      count: entry.count + 1,
      userIds: [...entry.userIds, userId],
    };
    return nextSummary;
  }

  if (existingIndex === -1) {
    return nextSummary;
  }

  const entry = nextSummary[existingIndex];
  const nextUserIds = entry.userIds.filter((existingUserId) => existingUserId !== userId);
  if (nextUserIds.length === 0) {
    nextSummary.splice(existingIndex, 1);
    return nextSummary;
  }

  nextSummary[existingIndex] = {
    ...entry,
    count: nextUserIds.length,
    userIds: nextUserIds,
  };
  return nextSummary;
}
