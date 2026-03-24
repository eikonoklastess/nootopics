import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireThreadParentAccess } from "./lib/auth";
import { countThreadReplies, resolveUsersById } from "./lib/messages";

const conversationArgs = {
  channelId: v.optional(v.id("channels")),
  directConversationId: v.optional(v.id("directConversations")),
};

export const listReplies = query({
  args: { threadId: v.id("messages") },
  handler: async (ctx, args) => {
    await requireThreadParentAccess(ctx, args.threadId);

    const replies = await ctx.db
      .query("messages")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .take(100);

    const users = await resolveUsersById(
      ctx,
      replies.map((reply) => reply.userId),
    );

    return await Promise.all(
      replies.map(async (message) => ({
        ...message,
        user: users.get(message.userId) ?? null,
      })),
    );
  },
});

export const reply = mutation({
  args: {
    ...conversationArgs,
    threadId: v.id("messages"),
    content: v.string(),
    files: v.optional(v.array(v.object({
      storageId: v.id("_storage"),
      name: v.string(),
      type: v.string(),
      size: v.number(),
    }))),
  },
  handler: async (ctx, args) => {
    const access = await requireThreadParentAccess(ctx, args.threadId);
    const parentChannelId = access.message.channelId;
    const parentDirectConversationId = access.message.directConversationId;

    if (
      args.channelId !== parentChannelId ||
      args.directConversationId !== parentDirectConversationId
    ) {
      throw new Error("Thread replies must stay in the parent conversation");
    }

    const replyId = await ctx.db.insert("messages", {
      userId: access.user._id,
      content: args.content,
      deleted: false,
      isEdited: false,
      parentMessageId: args.threadId,
      replyCount: 0,
      threadId: args.threadId,
      files: args.files,
      ...(parentChannelId
        ? {
            channelId: parentChannelId,
            serverId: access.message.serverId,
          }
        : {
            directConversationId: parentDirectConversationId,
          }),
    });

    const currentReplyCount =
      access.message.replyCount ?? (await countThreadReplies(ctx, access.message._id));
    await ctx.db.patch(access.message._id, {
      replyCount: currentReplyCount + 1,
    });

    if (access.kind === "channel") {
      await ctx.db.patch(access.channel._id, {
        lastMessageTime: Date.now(),
      });
    } else {
      await ctx.db.patch(access.directConversation._id, {
        lastMessageTime: Date.now(),
      });
    }

    return replyId;
  },
});

export const getReplyCounts = query({
  args: { messageIds: v.array(v.id("messages")) },
  handler: async (ctx, args) => {
    const counts: Record<string, number> = {};
    for (const msgId of args.messageIds) {
      await requireThreadParentAccess(ctx, msgId);
      const count = await countThreadReplies(ctx, msgId);
      if (count > 0) {
        counts[msgId] = count;
      }
    }
    return counts;
  },
});
