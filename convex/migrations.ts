import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import {
  countThreadReplies,
  countTopLevelMessages,
  getParentMessageId,
} from "./lib/messages";

export const runBackfill = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.migrations.backfillMessagesBatch, {
      paginationOpts: { cursor: null, numItems: 100 },
    });
    await ctx.scheduler.runAfter(0, internal.migrations.backfillChannelsBatch, {
      paginationOpts: { cursor: null, numItems: 50 },
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
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(message._id, patch);
      }
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
