import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { query } from "./_generated/server";
import { requireServerMembership } from "./lib/auth";
import { getReplyCount, resolveUsersById } from "./lib/messages";

const hasFilterValidator = v.union(
  v.literal("file"),
  v.literal("image"),
  v.literal("video"),
  v.literal("audio"),
  v.literal("thread"),
  v.literal("reply"),
);

type SearchableMessage = Doc<"messages">;
type HasFilter = "file" | "image" | "video" | "audio" | "thread" | "reply";
type ServerSearchMessage = SearchableMessage & { channelId: Id<"channels"> };

export const searchMessages = query({
  args: {
    serverId: v.id("servers"),
    searchText: v.string(),
    authorName: v.optional(v.string()),
    channelName: v.optional(v.string()),
    has: v.optional(hasFilterValidator),
    before: v.optional(v.number()),
    after: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireServerMembership(ctx, args.serverId);

    const limit = Math.max(1, Math.min(args.limit ?? 20, 25));
    const channels = await ctx.db
      .query("channels")
      .withIndex("by_server_id", (q) => q.eq("serverId", args.serverId))
      .take(100);
    const channelFilter = normalizeName(args.channelName);
    const allowedChannels = channelFilter
      ? channels.filter((channel) => normalizeName(channel.name).includes(channelFilter))
      : channels;

    if (allowedChannels.length === 0) {
      return [];
    }

    const allowedChannelIds = new Set<Id<"channels">>(
      allowedChannels.map((channel) => channel._id),
    );
    const channelNames = new Map(
      channels.map((channel) => [channel._id, channel.name] as const),
    );

    const members = await ctx.db
      .query("members")
      .withIndex("by_server_id", (q) => q.eq("serverId", args.serverId))
      .take(100);
    const memberUsers = (await Promise.all(
      members.map((member) => ctx.db.get(member.userId)),
    )).filter(isDefined);
    const authorFilter = normalizeName(args.authorName);
    const allowedAuthorIds = authorFilter
      ? new Set<Id<"users">>(
          memberUsers
            .filter((user) => normalizeName(user.name).includes(authorFilter))
            .map((user) => user._id),
        )
      : null;

    if (authorFilter && allowedAuthorIds?.size === 0) {
      return [];
    }

    const searchText = args.searchText.trim();
    const candidates =
      searchText.length > 0
        ? await ctx.db
            .query("messages")
            .withSearchIndex("search_content", (q) =>
              q.search("content", searchText).eq("serverId", args.serverId),
            )
            .take(Math.max(limit * 6, 120))
        : await listRecentServerMessages(ctx, args.serverId, Math.max(limit * 6, 180), 600);

    const results: ServerSearchMessage[] = [];

    for (const message of candidates) {
      if (!message.channelId) {
        continue;
      }
      const serverMessage = message as ServerSearchMessage;
      if (
        !(await matchesSearchFilters(ctx, serverMessage, {
          allowedAuthorIds,
          allowedChannelIds,
          before: args.before ?? null,
          after: args.after ?? null,
          has: args.has ?? null,
        }))
      ) {
        continue;
      }

      results.push(serverMessage);
      if (results.length >= limit) {
        break;
      }
    }

    const users = await resolveUsersById(
      ctx,
      results.map((message) => message.userId),
    );

    return await Promise.all(
      results.map(async (message) => {
        const user = users.get(message.userId);
        return {
          _creationTime: message._creationTime,
          _id: message._id,
          anchorMessageId: message.threadId ?? message._id,
          channelId: message.channelId,
          channelName: channelNames.get(message.channelId) ?? "unknown-channel",
          content: message.content,
          deleted: message.deleted,
          hasFiles: Boolean(message.files && message.files.length > 0),
          isThreadReply: Boolean(message.threadId),
          replyCount: await getReplyCount(ctx, message),
          threadReplyMessageId: message.threadId ? message._id : null,
          user: user
            ? {
                clerkId: user.clerkId,
                imageUrl: user.imageUrl,
                name: user.name,
                status: user.status,
              }
            : null,
        };
      }),
    );
  },
});

async function listRecentServerMessages(
  ctx: QueryCtx,
  serverId: Id<"servers">,
  limit: number,
  scanLimit: number,
) {
  const messages: SearchableMessage[] = [];
  let scanned = 0;

  for await (const message of ctx.db
    .query("messages")
    .withIndex("by_server_id", (q) => q.eq("serverId", serverId))
    .order("desc")) {
    messages.push(message);
    scanned += 1;
    if (messages.length >= limit || scanned >= scanLimit) {
      break;
    }
  }

  return messages;
}

async function matchesSearchFilters(
  ctx: QueryCtx,
  message: ServerSearchMessage,
  filters: {
    after: number | null;
    allowedAuthorIds: Set<Id<"users">> | null;
    allowedChannelIds: Set<Id<"channels">>;
    before: number | null;
    has: HasFilter | null;
  },
) {
  if (!filters.allowedChannelIds.has(message.channelId)) {
    return false;
  }
  if (filters.allowedAuthorIds && !filters.allowedAuthorIds.has(message.userId)) {
    return false;
  }
  if (filters.before !== null && message._creationTime > filters.before) {
    return false;
  }
  if (filters.after !== null && message._creationTime < filters.after) {
    return false;
  }
  if (filters.has && !(await matchesHasFilter(ctx, message, filters.has))) {
    return false;
  }
  return true;
}

async function matchesHasFilter(
  ctx: QueryCtx,
  message: SearchableMessage,
  has: HasFilter,
) {
  const files = message.files ?? [];

  switch (has) {
    case "file":
      return files.length > 0;
    case "image":
      return files.some((file) => file.type.startsWith("image/"));
    case "video":
      return files.some((file) => file.type.startsWith("video/"));
    case "audio":
      return files.some((file) => file.type.startsWith("audio/"));
    case "thread":
      return (await getReplyCount(ctx, message)) > 0;
    case "reply":
      return Boolean(message.threadId);
  }
}

function normalizeName(value: string | undefined) {
  return value?.trim().toLowerCase().replace(/^#/, "") ?? "";
}

function isDefined<T>(value: T | null): value is T {
  return value !== null;
}
