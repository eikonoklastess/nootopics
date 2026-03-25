import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import {
  countThreadReplies,
  countTopLevelMessages,
  getParentMessageId,
} from "./lib/messages";
import { buildMessagePreview, normalizeName } from "./lib/normalize";
import { upsertMessageSearchDigest } from "./lib/searchDigests";

export const runBackfill = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.migrations.backfillMessagesBatch, {
      paginationOpts: { cursor: null, numItems: 100 },
    });
    await ctx.scheduler.runAfter(0, internal.migrations.backfillChannelsBatch, {
      paginationOpts: { cursor: null, numItems: 50 },
    });
    await ctx.scheduler.runAfter(0, internal.migrations.backfillMembersBatch, {
      paginationOpts: { cursor: null, numItems: 100 },
    });
    await ctx.scheduler.runAfter(0, internal.migrations.backfillDirectConversationsBatch, {
      paginationOpts: { cursor: null, numItems: 100 },
    });
    await ctx.scheduler.runAfter(0, internal.migrations.backfillNotificationsBatch, {
      paginationOpts: { cursor: null, numItems: 100 },
    });
    await ctx.scheduler.runAfter(0, internal.migrations.backfillPresenceBatch, {
      paginationOpts: { cursor: null, numItems: 100 },
    });
  },
});

export const backfillMessagesBatch = internalMutation({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("messages").paginate(args.paginationOpts);

    for (const message of page.page) {
      const patch: {
        parentMessageId?: ReturnType<typeof getParentMessageId>;
        replyCount?: number;
        reactionSummary?: Doc<"messages">["reactionSummary"];
        serverId?: typeof message.serverId;
      } = {};
      const parentMessageId = getParentMessageId(message);

      if (message.parentMessageId === undefined) {
        patch.parentMessageId = parentMessageId;
      }
      if (message.replyCount === undefined) {
        patch.replyCount = message.threadId ? 0 : await countThreadReplies(ctx, message._id);
      }
      if (message.serverId === undefined && message.channelId) {
        const channel = await ctx.db.get(message.channelId);
        if (channel) {
          patch.serverId = channel.serverId;
        }
      }
      if (message.reactionSummary === undefined) {
        const reactions = await ctx.db
          .query("reactions")
          .withIndex("by_message_id", (q) => q.eq("messageId", message._id))
          .take(100);
        patch.reactionSummary = buildReactionSummary(reactions);
      }
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(message._id, patch);
      }
      await upsertMessageSearchDigest(ctx, {
        ...message,
        ...patch,
      } as Doc<"messages">);
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillMessagesBatch, {
        paginationOpts: {
          cursor: page.continueCursor,
          numItems: args.paginationOpts.numItems,
        },
      });
    }
  },
});

export const backfillChannelsBatch = internalMutation({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("channels").paginate(args.paginationOpts);

    for (const channel of page.page) {
      const latestMessage = await ctx.db
        .query("messages")
        .withIndex("by_channel_id", (q) => q.eq("channelId", channel._id))
        .order("desc")
        .take(1);

      await ctx.db.patch(channel._id, {
        topLevelMessageCount:
          channel.topLevelMessageCount ??
          (await countTopLevelMessages(ctx, {
            kind: "channel",
            channelId: channel._id,
          })),
        lastMessageTime:
          channel.lastMessageTime ?? latestMessage[0]?._creationTime ?? channel.lastMessageTime,
        normalizedName: channel.normalizedName ?? normalizeName(channel.name),
      });
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillChannelsBatch, {
        paginationOpts: {
          cursor: page.continueCursor,
          numItems: args.paginationOpts.numItems,
        },
      });
    }
  },
});

export const backfillMembersBatch = internalMutation({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("members").paginate(args.paginationOpts);

    for (const member of page.page) {
      const user = await ctx.db.get(member.userId);
      if (!user) {
        continue;
      }

      const normalizedUserName = normalizeName(user.name);
      if (
        member.userClerkId === user.clerkId &&
        member.userImageUrl === user.imageUrl &&
        member.userName === user.name &&
        member.userNameNormalized === normalizedUserName
      ) {
        continue;
      }

      await ctx.db.patch(member._id, {
        userClerkId: user.clerkId,
        userImageUrl: user.imageUrl,
        userName: user.name,
        userNameNormalized: normalizedUserName,
      });
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillMembersBatch, {
        paginationOpts: {
          cursor: page.continueCursor,
          numItems: args.paginationOpts.numItems,
        },
      });
    }
  },
});

export const backfillDirectConversationsBatch = internalMutation({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("directConversations").paginate(args.paginationOpts);

    for (const directConversation of page.page) {
      const members = await ctx.db
        .query("directConversationMembers")
        .withIndex("by_direct_conversation_id", (q) =>
          q.eq("directConversationId", directConversation._id),
        )
        .take(10);
      if (members.length < 2) {
        continue;
      }

      const leftUser = await ctx.db.get(members[0].userId);
      const rightUser = await ctx.db.get(members[1].userId);
      if (!leftUser || !rightUser) {
        continue;
      }

      await ctx.db.patch(directConversation._id, {
        leftUserClerkId: directConversation.leftUserClerkId ?? leftUser.clerkId,
        leftUserId: directConversation.leftUserId ?? leftUser._id,
        leftUserImageUrl: directConversation.leftUserImageUrl ?? leftUser.imageUrl,
        leftUserName: directConversation.leftUserName ?? leftUser.name,
        rightUserClerkId: directConversation.rightUserClerkId ?? rightUser.clerkId,
        rightUserId: directConversation.rightUserId ?? rightUser._id,
        rightUserImageUrl: directConversation.rightUserImageUrl ?? rightUser.imageUrl,
        rightUserName: directConversation.rightUserName ?? rightUser.name,
      });
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillDirectConversationsBatch, {
        paginationOpts: {
          cursor: page.continueCursor,
          numItems: args.paginationOpts.numItems,
        },
      });
    }
  },
});

export const backfillNotificationsBatch = internalMutation({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("notifications").paginate(args.paginationOpts);

    for (const notification of page.page) {
      const message = await ctx.db.get(notification.messageId);
      const author = message ? await ctx.db.get(message.userId) : null;
      if (!message || !author) {
        continue;
      }

      await ctx.db.patch(notification._id, {
        authorName: notification.authorName ?? author.name,
        messagePreview: notification.messagePreview ?? buildMessagePreview(message.content),
      });
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillNotificationsBatch, {
        paginationOpts: {
          cursor: page.continueCursor,
          numItems: args.paginationOpts.numItems,
        },
      });
    }
  },
});

export const backfillPresenceBatch = internalMutation({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("users").paginate(args.paginationOpts);

    for (const user of page.page) {
      if (user.status === undefined && user.lastSeen === undefined) {
        continue;
      }

      const existingPresence = await ctx.db
        .query("presence")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .unique();
      if (existingPresence) {
        continue;
      }

      await ctx.db.insert("presence", {
        lastSeen: user.lastSeen ?? user._creationTime,
        status: user.status ?? "OFFLINE",
        userId: user._id,
      });
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillPresenceBatch, {
        paginationOpts: {
          cursor: page.continueCursor,
          numItems: args.paginationOpts.numItems,
        },
      });
    }
  },
});

function buildReactionSummary(
  reactions: Array<{ emoji: string; userId: Doc<"reactions">["userId"] }>,
) {
  const grouped = new Map<
    string,
    { emoji: string; count: number; userIds: Id<"users">[] }
  >();
  for (const reaction of reactions) {
    const existing = grouped.get(reaction.emoji);
    if (existing) {
      existing.userIds.push(reaction.userId);
      existing.count = existing.userIds.length;
      continue;
    }
    grouped.set(reaction.emoji, {
      emoji: reaction.emoji,
      count: 1,
      userIds: [reaction.userId],
    });
  }
  return [...grouped.values()];
}
