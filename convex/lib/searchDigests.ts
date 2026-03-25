import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

type MessageDoc = Doc<"messages">;

function getFileFlags(files: MessageDoc["files"]) {
  const attachments = files ?? [];
  return {
    hasFiles: attachments.length > 0,
    hasImage: attachments.some((file) => file.type.startsWith("image/")),
    hasVideo: attachments.some((file) => file.type.startsWith("video/")),
    hasAudio: attachments.some((file) => file.type.startsWith("audio/")),
  };
}

export async function upsertMessageSearchDigest(
  ctx: MutationCtx,
  message: MessageDoc,
) {
  if (!message.serverId || !message.channelId) {
    return;
  }

  const flags = getFileFlags(message.files);
  const digest = {
    channelId: message.channelId,
    content: message.content,
    createdAt: message._creationTime,
    deleted: message.deleted,
    hasReplies: (message.replyCount ?? 0) > 0,
    isReply: Boolean(message.threadId),
    messageId: message._id,
    serverId: message.serverId,
    userId: message.userId,
    ...flags,
  };

  const existing = await ctx.db
    .query("messageSearchDigests")
    .withIndex("by_message_id", (q) => q.eq("messageId", message._id))
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, digest);
    return;
  }

  await ctx.db.insert("messageSearchDigests", digest);
}
