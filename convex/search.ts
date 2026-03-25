import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { query } from "./_generated/server";
import { requireServerMembership } from "./lib/auth";
import { getReplyCount, resolveUsersById } from "./lib/messages";
import { normalizeName } from "./lib/normalize";

const hasFilterValidator = v.union(
  v.literal("file"),
  v.literal("image"),
  v.literal("video"),
  v.literal("audio"),
  v.literal("thread"),
  v.literal("reply"),
);

type HasFilter = "file" | "image" | "video" | "audio" | "thread" | "reply";
type SearchDigest = Doc<"messageSearchDigests">;

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
    const channelFilter = normalizeName(args.channelName);
    const authorFilter = normalizeName(args.authorName);

    const allowedChannelIds = channelFilter
      ? await resolveAllowedChannelIds(ctx, args.serverId, channelFilter)
      : null;
    if (allowedChannelIds && allowedChannelIds.size === 0) {
      return [];
    }

    const allowedAuthorIds = authorFilter
      ? await resolveAllowedAuthorIds(ctx, args.serverId, authorFilter)
      : null;
    if (allowedAuthorIds && allowedAuthorIds.size === 0) {
      return [];
    }

    const searchText = args.searchText.trim();
    const candidates =
      searchText.length > 0
        ? await ctx.db
            .query("messageSearchDigests")
            .withSearchIndex("search_content", (q) =>
              q.search("content", searchText).eq("serverId", args.serverId),
            )
            .take(Math.max(limit * 8, 120))
        : await listRecentSearchDigests(ctx, args.serverId, Math.max(limit * 8, 180), 300);

    const filtered = candidates.filter((digest) =>
      matchesSearchFilters(digest, {
        after: args.after ?? null,
        allowedAuthorIds,
        allowedChannelIds,
        before: args.before ?? null,
        has: args.has ?? null,
      }),
    );
    const results = filtered.slice(0, limit);

    const messages = (await Promise.all(
      results.map(async (digest) => {
        const message = await ctx.db.get(digest.messageId);
        return message && message.channelId ? ({ digest, message } as const) : null;
      }),
    )).filter((row): row is NonNullable<typeof row> => row !== null);

    const users = await resolveUsersById(
      ctx,
      messages.map(({ message }) => message.userId),
    );
    const channels = await Promise.all(
      [...new Set(messages.map(({ message }) => message.channelId!))].map(async (channelId) => {
        const channel = await ctx.db.get(channelId);
        return channel ? ([channelId, channel.name] as const) : null;
      }),
    );
    const channelNames = new Map(
      channels.filter((entry): entry is NonNullable<typeof entry> => entry !== null),
    );

    return await Promise.all(
      messages.map(async ({ digest, message }) => {
        const user = users.get(message.userId);
        return {
          _creationTime: message._creationTime,
          _id: message._id,
          anchorMessageId: message.threadId ?? message._id,
          channelId: message.channelId!,
          channelName: channelNames.get(message.channelId!) ?? "unknown-channel",
          content: message.content,
          deleted: message.deleted,
          hasFiles: digest.hasFiles,
          isThreadReply: digest.isReply,
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

async function listRecentSearchDigests(
  ctx: QueryCtx,
  serverId: Id<"servers">,
  limit: number,
  scanLimit: number,
) {
  const digests: SearchDigest[] = [];
  let scanned = 0;

  for await (const digest of ctx.db
    .query("messageSearchDigests")
    .withIndex("by_server_id_and_created_at", (q) => q.eq("serverId", serverId))
    .order("desc")) {
    digests.push(digest);
    scanned += 1;
    if (digests.length >= limit || scanned >= scanLimit) {
      break;
    }
  }

  return digests;
}

function matchesSearchFilters(
  digest: SearchDigest,
  filters: {
    after: number | null;
    allowedAuthorIds: Set<Id<"users">> | null;
    allowedChannelIds: Set<Id<"channels">> | null;
    before: number | null;
    has: HasFilter | null;
  },
) {
  if (filters.allowedChannelIds && !filters.allowedChannelIds.has(digest.channelId)) {
    return false;
  }
  if (filters.allowedAuthorIds && !filters.allowedAuthorIds.has(digest.userId)) {
    return false;
  }
  if (filters.before !== null && digest.createdAt > filters.before) {
    return false;
  }
  if (filters.after !== null && digest.createdAt < filters.after) {
    return false;
  }
  if (filters.has && !matchesHasFilter(digest, filters.has)) {
    return false;
  }
  return true;
}

function matchesHasFilter(digest: SearchDigest, has: HasFilter) {
  switch (has) {
    case "file":
      return digest.hasFiles;
    case "image":
      return digest.hasImage;
    case "video":
      return digest.hasVideo;
    case "audio":
      return digest.hasAudio;
    case "thread":
      return digest.hasReplies;
    case "reply":
      return digest.isReply;
  }
}

async function resolveAllowedChannelIds(
  ctx: QueryCtx,
  serverId: Id<"servers">,
  channelFilter: string,
) {
  const matches = await queryChannelsByPrefix(ctx, serverId, channelFilter);
  const rows =
    matches.length > 0
      ? matches
      : (await ctx.db
          .query("channels")
          .withIndex("by_server_id", (q) => q.eq("serverId", serverId))
          .take(100))
          .filter((channel) => normalizeName(channel.name).includes(channelFilter));

  return new Set<Id<"channels">>(rows.map((channel) => channel._id));
}

async function resolveAllowedAuthorIds(
  ctx: QueryCtx,
  serverId: Id<"servers">,
  authorFilter: string,
) {
  const matches = await queryMembersByPrefix(ctx, serverId, authorFilter);
  const rows =
    matches.length > 0
      ? matches
      : (await ctx.db
          .query("members")
          .withIndex("by_server_id", (q) => q.eq("serverId", serverId))
          .take(100))
          .filter((member) => normalizeName(member.userName).includes(authorFilter));

  return new Set<Id<"users">>(rows.map((member) => member.userId));
}

async function queryChannelsByPrefix(
  ctx: QueryCtx,
  serverId: Id<"servers">,
  prefix: string,
) {
  const upperBound = `${prefix}\uffff`;
  return await ctx.db
    .query("channels")
    .withIndex("by_server_id_and_normalized_name", (q) =>
      q.eq("serverId", serverId).gte("normalizedName", prefix).lte("normalizedName", upperBound),
    )
    .take(50);
}

async function queryMembersByPrefix(
  ctx: QueryCtx,
  serverId: Id<"servers">,
  prefix: string,
) {
  const upperBound = `${prefix}\uffff`;
  return await ctx.db
    .query("members")
    .withIndex("by_server_id_and_user_name_normalized", (q) =>
      q.eq("serverId", serverId)
        .gte("userNameNormalized", prefix)
        .lte("userNameNormalized", upperBound),
    )
    .take(50);
}
