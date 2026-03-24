import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireServerMembership, requireServerModerator } from "./lib/auth";

export const list = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    await requireServerMembership(ctx, args.serverId);

    return await ctx.db
      .query("channels")
      .withIndex("by_server_id", (q) => q.eq("serverId", args.serverId))
      .collect();
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
    if (args.name !== undefined) updates.name = args.name;
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
  },
});
