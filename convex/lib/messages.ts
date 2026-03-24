import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type ReaderCtx = QueryCtx | MutationCtx;
type MessageDoc = Doc<"messages">;
export type MessageLocation =
  | {
      kind: "channel";
      channelId: Id<"channels">;
    }
  | {
      kind: "direct";
      directConversationId: Id<"directConversations">;
    };
type ConversationMetricsDoc =
  | Pick<Doc<"channels">, "topLevelMessageCount">
  | Pick<Doc<"directConversations">, "topLevelMessageCount">;

export async function listTopLevelMessages(
  ctx: ReaderCtx,
  location: MessageLocation,
  limit: number,
) {
  return location.kind === "channel"
    ? await ctx.db
        .query("messages")
        .withIndex("by_channel_id_and_parent_message_id", (q) =>
          q.eq("channelId", location.channelId).eq("parentMessageId", null),
        )
        .order("desc")
        .take(limit)
    : await ctx.db
        .query("messages")
        .withIndex("by_direct_conversation_id_and_parent_message_id", (q) =>
          q
            .eq("directConversationId", location.directConversationId)
            .eq("parentMessageId", null),
        )
        .order("desc")
        .take(limit);
}

export async function listTopLevelMessagesAround(
  ctx: ReaderCtx,
  location: MessageLocation,
  targetMessageId: Id<"messages">,
  newerLimit: number,
  olderLimit: number,
) {
  const targetMessage = await ctx.db.get(targetMessageId);
  if (!targetMessage || !isTopLevelMessage(targetMessage)) {
    return [];
  }

  const matchesLocation =
    location.kind === "channel"
      ? targetMessage.channelId === location.channelId
      : targetMessage.directConversationId === location.directConversationId;
  if (!matchesLocation) {
    return [];
  }

  const indexedTopLevelMessages =
    location.kind === "channel"
      ? ctx.db
          .query("messages")
          .withIndex("by_channel_id_and_parent_message_id", (q) =>
            q.eq("channelId", location.channelId).eq("parentMessageId", null),
          )
          .order("desc")
      : ctx.db
          .query("messages")
          .withIndex("by_direct_conversation_id_and_parent_message_id", (q) =>
            q
              .eq("directConversationId", location.directConversationId)
              .eq("parentMessageId", null),
          )
          .order("desc");

  const newer: MessageDoc[] = [];
  const older: MessageDoc[] = [];
  let target: MessageDoc | null = null;
  let foundTarget = false;
  for await (const message of indexedTopLevelMessages) {
    if (!foundTarget) {
      if (message._id === targetMessageId) {
        target = message;
        foundTarget = true;
        continue;
      }

      newer.push(message);
      if (newer.length > newerLimit) {
        newer.shift();
      }
      continue;
    }

    older.push(message);
    if (older.length >= olderLimit) {
      break;
    }
  }

  if (!target) {
    return [];
  }

  return [...newer, target, ...older];
}

export async function countTopLevelMessages(
  ctx: ReaderCtx,
  location: MessageLocation,
) {
  let count = 0;
  const indexedTopLevelMessages =
    location.kind === "channel"
      ? ctx.db
          .query("messages")
          .withIndex("by_channel_id_and_parent_message_id", (q) =>
            q.eq("channelId", location.channelId).eq("parentMessageId", null),
          )
      : ctx.db
          .query("messages")
          .withIndex("by_direct_conversation_id_and_parent_message_id", (q) =>
            q
              .eq("directConversationId", location.directConversationId)
              .eq("parentMessageId", null),
          );

  for await (const _message of indexedTopLevelMessages) {
    count += 1;
  }

  return count;
}

export async function countUnreadTopLevelMessagesSince(
  ctx: ReaderCtx,
  location: MessageLocation,
  lastReadTime: number,
) {
  let count = 0;

  const indexedTopLevelMessages =
    location.kind === "channel"
      ? ctx.db
          .query("messages")
          .withIndex("by_channel_id_and_parent_message_id", (q) =>
            q.eq("channelId", location.channelId).eq("parentMessageId", null),
          )
          .order("desc")
      : ctx.db
          .query("messages")
          .withIndex("by_direct_conversation_id_and_parent_message_id", (q) =>
            q
              .eq("directConversationId", location.directConversationId)
              .eq("parentMessageId", null),
          )
          .order("desc");

  for await (const message of indexedTopLevelMessages) {
    if (message._creationTime <= lastReadTime) {
      break;
    }
    count += 1;
  }

  return count;
}

export function computeUnreadCountFromCounters(
  channelTopLevelMessageCount: number | undefined,
  lastReadTopLevelMessageCount: number | undefined,
) {
  if (
    channelTopLevelMessageCount === undefined ||
    lastReadTopLevelMessageCount === undefined
  ) {
    return null;
  }

  return Math.max(channelTopLevelMessageCount - lastReadTopLevelMessageCount, 0);
}

export async function getTopLevelMessageCount(
  ctx: ReaderCtx,
  location: MessageLocation,
  conversation: ConversationMetricsDoc,
) {
  return conversation.topLevelMessageCount ?? countTopLevelMessages(ctx, location);
}

export async function countThreadReplies(
  ctx: ReaderCtx,
  threadId: Id<"messages">,
) {
  let count = 0;

  for await (const _message of ctx.db
    .query("messages")
    .withIndex("by_thread_id", (q) => q.eq("threadId", threadId))) {
    count += 1;
  }

  return count;
}

export async function getReplyCount(ctx: ReaderCtx, message: MessageDoc) {
  return message.replyCount ?? countThreadReplies(ctx, message._id);
}

export function getParentMessageId(message: Pick<MessageDoc, "threadId" | "parentMessageId">) {
  if (message.parentMessageId !== undefined) {
    return message.parentMessageId;
  }
  return message.threadId ?? null;
}

export function isTopLevelMessage(
  message: Pick<MessageDoc, "parentMessageId" | "threadId">,
) {
  return getParentMessageId(message) === null;
}

export async function resolveUsersById(
  ctx: ReaderCtx,
  userIds: Id<"users">[],
) {
  const uniqueIds = [...new Set(userIds)];
  const users = await Promise.all(uniqueIds.map((userId) => ctx.db.get(userId)));
  const userMap = new Map<Id<"users">, Doc<"users">>();

  for (const user of users) {
    if (user) {
      userMap.set(user._id, user);
    }
  }

  return userMap;
}

export async function resolveMessageFiles(
  ctx: ReaderCtx,
  files: MessageDoc["files"],
) {
  if (!files || files.length === 0) {
    return undefined;
  }

  return await Promise.all(
    files.map(async (file) => ({
      ...file,
      url: await ctx.storage.getUrl(file.storageId),
    })),
  );
}
