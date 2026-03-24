import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireServerMembership, requireServerModerator } from "./lib/auth";

export const generateUploadUrl = mutation({
  args: {
    serverId: v.id("servers"),
  },
  handler: async (ctx, args) => {
    await requireServerModerator(ctx, args.serverId);
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    serverId: v.id("servers"),
    storageId: v.id("_storage"),
    format: v.union(v.literal("png"), v.literal("gif")),
  },
  handler: async (ctx, args) => {
    await requireServerModerator(ctx, args.serverId);

    // Basic validation on name to prevent regex breaking
    const cleanName = args.name.replace(/[^a-zA-Z0-9_]/g, "");
    if (!cleanName) {
      throw new Error("Invalid emoji name");
    }

    const emojiId = await ctx.db.insert("emojis", {
      name: cleanName,
      serverId: args.serverId,
      storageId: args.storageId,
      format: args.format,
    });
    return emojiId;
  },
});

export const list = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    await requireServerMembership(ctx, args.serverId);

    const emojis = await ctx.db
      .query("emojis")
      .withIndex("by_server_id", (q) => q.eq("serverId", args.serverId))
      .take(200);

    return await Promise.all(
      emojis.map(async (emoji) => ({
        ...emoji,
        url: await ctx.storage.getUrl(emoji.storageId),
      })),
    );
  },
});

export const remove = mutation({
  args: { emojiId: v.id("emojis"), serverId: v.id("servers") },
  handler: async (ctx, args) => {
    await requireServerModerator(ctx, args.serverId);
    const emoji = await ctx.db.get(args.emojiId);
    
    if (!emoji || emoji.serverId !== args.serverId) {
      throw new Error("Emoji not found or permission denied");
    }

    await ctx.storage.delete(emoji.storageId);
    await ctx.db.delete(emoji._id);
  },
});
