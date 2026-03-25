import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireServerMembership, requireServerModerator } from "./lib/auth";
import { normalizeName } from "./lib/normalize";

export const list = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    await requireServerMembership(ctx, args.serverId);

    return await ctx.db
      .query("channels")
      .withIndex("by_server_id", (q) => q.eq("serverId", args.serverId))
      .take(100);
  },
});

export const create = mutation({
  args: {
    serverId: v.id("servers"),
    name: v.string(),
    type: v.union(v.literal("TEXT"), v.literal("AUDIO")),
    categoryId: v.optional(v.id("categories")),
  },
  handler: async (ctx, args) => {
    await requireServerModerator(ctx, args.serverId);

    const channelId = await ctx.db.insert("channels", {
      serverId: args.serverId,
      name: args.name,
      type: args.type,
      topLevelMessageCount: 0,
      categoryId: args.categoryId,
      normalizedName: normalizeName(args.name),
    });
    return channelId;
  },
});

export const update = mutation({
  args: {
    channelId: v.id("channels"),
    name: v.optional(v.string()),
    categoryId: v.optional(v.union(v.id("categories"), v.null())),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");
    await requireServerModerator(ctx, channel.serverId);

    const updates: Partial<typeof channel> = {};
    if (args.name !== undefined) {
      updates.name = args.name;
      updates.normalizedName = normalizeName(args.name);
    }
    if (args.categoryId !== undefined) updates.categoryId = args.categoryId === null ? undefined : args.categoryId;
    if (args.order !== undefined) updates.order = args.order;

    await ctx.db.patch(args.channelId, updates);
  },
});

export const remove = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");
    await requireServerModerator(ctx, channel.serverId);

    await ctx.db.delete(args.channelId);
    await ctx.scheduler.runAfter(0, internal.channels.cleanupRemovedChannelData, {
      channelId: args.channelId,
    });
  },
});

const MESSAGE_BATCH_SIZE = 50;
const RELATED_DOC_BATCH_SIZE = 100;

export const cleanupRemovedChannelData = internalMutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_channel_id", (q) => q.eq("channelId", args.channelId))
      .take(MESSAGE_BATCH_SIZE);
    for (const message of messages) {
      for (const file of message.files ?? []) {
        await ctx.storage.delete(file.storageId);
      }
      
      const reactions = await ctx.db
        .query("reactions")
        .withIndex("by_message_id", (q) => q.eq("messageId", message._id))
        .collect();
      for (const reaction of reactions) {
        await ctx.db.delete(reaction._id);
      }

      await ctx.db.delete(message._id);
    }

    const typingRows = await ctx.db
      .query("typing")
      .withIndex("by_channel_id", (q) => q.eq("channelId", args.channelId))
      .take(RELATED_DOC_BATCH_SIZE);
    for (const row of typingRows) {
      await ctx.db.delete(row._id);
    }

    const readPositions = await ctx.db
      .query("readPositions")
      .withIndex("by_channel_id", (q) => q.eq("channelId", args.channelId))
      .take(RELATED_DOC_BATCH_SIZE);
    for (const row of readPositions) {
      await ctx.db.delete(row._id);
    }

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_channel_id", (q) => q.eq("channelId", args.channelId))
      .take(RELATED_DOC_BATCH_SIZE);
    for (const row of notifications) {
      await ctx.db.delete(row._id);
    }

    if (
      messages.length === MESSAGE_BATCH_SIZE ||
      typingRows.length === RELATED_DOC_BATCH_SIZE ||
      readPositions.length === RELATED_DOC_BATCH_SIZE ||
      notifications.length === RELATED_DOC_BATCH_SIZE
    ) {
      await ctx.scheduler.runAfter(0, internal.channels.cleanupRemovedChannelData, {
        channelId: args.channelId,
      });
    }
  },
});
