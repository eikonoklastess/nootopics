import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireServerMembership, requireServerModerator } from "./lib/auth";

export const list = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    await requireServerMembership(ctx, args.serverId);
    return await ctx.db
      .query("categories")
      .withIndex("by_server_id", (q) => q.eq("serverId", args.serverId))
      .collect();
  },
});

export const create = mutation({
  args: {
    serverId: v.id("servers"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await requireServerModerator(ctx, args.serverId);
    const categoryId = await ctx.db.insert("categories", {
      serverId: args.serverId,
      name: args.name,
    });
    return categoryId;
  },
});

export const update = mutation({
  args: {
    categoryId: v.id("categories"),
    name: v.optional(v.string()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.categoryId);
    if (!category) throw new Error("Category not found");
    await requireServerModerator(ctx, category.serverId);
    
    const updates: Partial<typeof category> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.order !== undefined) updates.order = args.order;
    
    await ctx.db.patch(args.categoryId, updates);
  },
});

export const remove = mutation({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.categoryId);
    if (!category) throw new Error("Category not found");
    await requireServerModerator(ctx, category.serverId);
    
    // update all channels in this category to lose their category
    const channels = await ctx.db
      .query("channels")
      .withIndex("by_server_id", (q) => q.eq("serverId", category.serverId))
      .filter((q) => q.eq(q.field("categoryId"), args.categoryId))
      .collect();
      
    for (const channel of channels) {
      await ctx.db.patch(channel._id, { categoryId: undefined });
    }

    await ctx.db.delete(args.categoryId);
  },
});
