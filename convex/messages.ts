import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import {
  requireConversationAccess,
  requireCurrentUserForMutation,
  requireMessageOwner,
  requireServerModerator,
} from "./lib/auth";
import {
  getReplyCount,
  getTopLevelMessageCount,
  listTopLevelMessages,
  listTopLevelMessagesAround,
  type MessageLocation,
  resolveMessageFiles,
  resolveUsersById,
} from "./lib/messages";

const conversationArgs = {
  channelId: v.optional(v.id("channels")),
  directConversationId: v.optional(v.id("directConversations")),
};

// Generate a signed upload URL for Convex file storage
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireCurrentUserForMutation(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const list = query({
  args: conversationArgs,
  handler: async (ctx, args) => {
    const access = await requireConversationAccess(ctx, getConversationTarget(args));
    const topLevel = await listTopLevelMessages(ctx, getMessageLocation(access), 50);
    return await serializeTopLevelMessages(ctx, topLevel);
  },
});

export const listAround = query({
  args: {
    ...conversationArgs,
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const access = await requireConversationAccess(ctx, getConversationTarget(args));
    const location = getMessageLocation(access);

    const topLevel = await listTopLevelMessagesAround(
      ctx,
      location,
      args.messageId,
      20,
      20,
    );

    if (topLevel.length === 0) {
      return await serializeTopLevelMessages(
        ctx,
        await listTopLevelMessages(ctx, location, 50),
      );
    }

    return await serializeTopLevelMessages(ctx, topLevel);
  },
});

export const send = mutation({
  args: {
    ...conversationArgs,
    content: v.string(),
    mentions: v.optional(v.array(v.id("users"))),
    files: v.optional(v.array(v.object({
      storageId: v.id("_storage"),
      name: v.string(),
      type: v.string(),
      size: v.number(),
    }))),
  },
  handler: async (ctx, args) => {
    const access = await requireConversationAccess(ctx, getConversationTarget(args));
    const now = Date.now();
    const location = getMessageLocation(access);

    const messageId = await ctx.db.insert("messages", {
      userId: access.user._id,
      content: args.content,
      deleted: false,
      isEdited: false,
      parentMessageId: null,
      replyCount: 0,
      files: args.files,
      ...(access.kind === "channel"
        ? {
            channelId: access.channel._id,
            serverId: access.channel.serverId,
          }
        : {
            directConversationId: access.directConversation._id,
          }),
    });

    if (access.kind === "channel") {
      const topLevelMessageCount = await getTopLevelMessageCount(
        ctx,
        location,
        access.channel,
      );
      await ctx.db.patch(access.channel._id, {
        topLevelMessageCount: topLevelMessageCount + 1,
        lastMessageTime: now,
      });

      const validMentionedUserIds = await getValidMentionedUserIdsForServer(
        ctx,
        access.channel.serverId,
        Array.from(new Set(args.mentions ?? [])).filter(
          (userId) => userId !== access.user._id,
        ),
      );
      for (const userId of validMentionedUserIds) {
        const mentionedUser = await ctx.db.get(userId);
        if (!mentionedUser) {
          continue;
        }

        const desktopSetting = mentionedUser.notificationSettings?.desktop ?? "ALL";
        if (desktopSetting === "NONE") {
          continue;
        }

        await ctx.db.insert("notifications", {
          userId,
          messageId,
          serverId: access.channel.serverId,
          channelId: access.channel._id,
          type: "MENTION",
          read: false,
        });
      }
    } else {
      const topLevelMessageCount = await getTopLevelMessageCount(
        ctx,
        location,
        access.directConversation,
      );
      await ctx.db.patch(access.directConversation._id, {
        topLevelMessageCount: topLevelMessageCount + 1,
        lastMessageTime: now,
      });

      const members = await ctx.db
        .query("directConversationMembers")
        .withIndex("by_direct_conversation_id", (q) =>
          q.eq("directConversationId", access.directConversation._id),
        )
        .take(10);

      for (const member of members) {
        if (member.userId === access.user._id) {
          continue;
        }

        const recipient = await ctx.db.get(member.userId);
        if (!recipient) {
          continue;
        }

        const desktopSetting = recipient.notificationSettings?.desktop ?? "ALL";
        if (desktopSetting !== "ALL") {
          continue;
        }

        await ctx.db.insert("notifications", {
          userId: member.userId,
          messageId,
          directConversationId: access.directConversation._id,
          type: "DIRECT_MESSAGE",
          read: false,
        });
      }
    }

    return messageId;
  },
});

export const pin = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    // Check if the user is part of the conversation this message belongs to
    // We can fetch the message and then requireConversationAccess
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    if (message.channelId) {
      await requireChannelModerationForMessage(ctx, message);
    } else if (message.directConversationId) {
      await requireConversationAccess(ctx, { directConversationId: message.directConversationId });
    } else {
      throw new Error("Message is missing its parent conversation");
    }

    if (message.deleted) {
      throw new Error("Cannot pin a deleted message");
    }

    await ctx.db.patch(args.messageId, {
      pinned: true,
    });
  },
});

export const unpin = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    if (message.channelId) {
      await requireChannelModerationForMessage(ctx, message);
    } else if (message.directConversationId) {
      await requireConversationAccess(ctx, { directConversationId: message.directConversationId });
    } else {
      throw new Error("Message is missing its parent conversation");
    }

    await ctx.db.patch(args.messageId, {
      pinned: false,
    });
  },
});

export const listPinned = query({
  args: conversationArgs,
  handler: async (ctx, args) => {
    const access = await requireConversationAccess(ctx, getConversationTarget(args));
    
    let pinnedMessages;
    
    if (access.kind === "channel") {
      pinnedMessages = await ctx.db
        .query("messages")
        .withIndex("by_channel_id_and_pinned", (q) =>
          q.eq("channelId", access.channel._id).eq("pinned", true)
        )
        .order("desc")
        .take(100);
    } else {
      pinnedMessages = await ctx.db
        .query("messages")
        .withIndex("by_direct_conversation_id_and_pinned", (q) =>
          q
            .eq("directConversationId", access.directConversation._id)
            .eq("pinned", true)
        )
        .order("desc")
        .take(100);
    }
    
    return await serializeTopLevelMessages(ctx, pinnedMessages);
  },
});

export const edit = mutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const { message } = await requireMessageOwner(ctx, args.messageId);

    if (message.deleted) {
      throw new Error("Deleted messages cannot be edited");
    }
    if (message.content === args.content) {
      return;
    }

    await ctx.db.patch(args.messageId, {
      content: args.content,
      isEdited: true,
    });
  },
});

export const remove = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const { message } = await requireMessageOwner(ctx, args.messageId);

    if (message.deleted) {
      return;
    }

    if (message.files) {
      for (const file of message.files) {
        await ctx.storage.delete(file.storageId);
      }
    }

    await ctx.db.patch(args.messageId, {
      content: "",
      deleted: true,
      isEdited: false,
      files: [],
    });
  },
});

async function serializeTopLevelMessages(
  ctx: QueryCtx,
  topLevel: Doc<"messages">[],
) {
  const users = await resolveUsersById(
    ctx,
    topLevel.map((message) => message.userId),
  );

  return await Promise.all(
    topLevel.map(async (message) => {
      return {
        ...message,
        user: users.get(message.userId) ?? null,
        files: await resolveMessageFiles(ctx, message.files),
        replyCount: await getReplyCount(ctx, message),
      };
    }),
  );
}

function getConversationTarget(args: {
  channelId?: Doc<"messages">["channelId"];
  directConversationId?: Doc<"messages">["directConversationId"];
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

async function getValidMentionedUserIdsForServer(
  ctx: QueryCtx | MutationCtx,
  serverId: Id<"servers">,
  userIds: Id<"users">[],
) {
  if (userIds.length === 0) {
    return [];
  }

  const serverMembers = await ctx.db
    .query("members")
    .withIndex("by_server_id", (q) => q.eq("serverId", serverId))
    .take(200);
  const validUserIds = new Set(serverMembers.map((member) => member.userId));

  return userIds.filter((userId) => validUserIds.has(userId));
}

async function requireChannelModerationForMessage(
  ctx: MutationCtx,
  message: Doc<"messages">,
) {
  if (!message.channelId) {
    throw new Error("Message is not in a channel");
  }

  if (message.serverId) {
    await requireServerModerator(ctx, message.serverId);
    return;
  }

  const channel = await ctx.db.get(message.channelId);
  if (!channel) {
    throw new Error("Channel not found");
  }
  await requireServerModerator(ctx, channel.serverId);
}
