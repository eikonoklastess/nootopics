import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  requireCurrentUser,
  requireCurrentUserForMutation,
  requireServerMembership,
  requireServerModerator,
} from "./lib/auth";

export const create = mutation({
  args: {
    name: v.string(),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireCurrentUserForMutation(ctx);

    const inviteCode = crypto.randomUUID();

    const serverId = await ctx.db.insert("servers", {
      name: args.name,
      imageUrl: args.imageUrl,
      ownerId: user._id,
      inviteCode,
    });

    await ctx.db.insert("members", {
      userId: user._id,
      serverId,
      role: "ADMIN",
    });

    await ctx.db.insert("channels", {
      name: "general",
      serverId,
      type: "TEXT",
    });

    return serverId;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    let user;
    try {
      ({ user } = await requireCurrentUser(ctx));
    } catch {
      return [];
    }

    const memberships = await ctx.db
      .query("members")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    const servers = await Promise.all(
      memberships.map((membership) => ctx.db.get(membership.serverId)),
    );

    return servers.filter(Boolean);
  },
});

export const join = mutation({
  args: {
    inviteCode: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireCurrentUserForMutation(ctx);

    const server = await ctx.db
      .query("servers")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", args.inviteCode))
      .unique();

    if (!server) {
      throw new Error("Server not found or invalid invite code");
    }

    const existingMember = await ctx.db
      .query("members")
      .withIndex("by_server_id_and_user_id", (q) =>
        q.eq("serverId", server._id).eq("userId", user._id)
      )
      .unique();

    if (existingMember) {
      return server._id;
    }

    await ctx.db.insert("members", {
      userId: user._id,
      serverId: server._id,
      role: "GUEST",
    });

    return server._id;
  },
});

export const get = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    const { server } = await requireServerMembership(ctx, args.serverId);
    return server;
  },
});

export const update = mutation({
  args: {
    serverId: v.id("servers"),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireServerModerator(ctx, args.serverId);
    const updates: { imageUrl?: string; name?: string } = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.imageUrl !== undefined) updates.imageUrl = args.imageUrl;
    
    await ctx.db.patch(args.serverId, updates);
  },
});

export const updateMemberRole = mutation({
  args: {
    serverId: v.id("servers"),
    memberId: v.id("members"),
    role: v.union(v.literal("ADMIN"), v.literal("MODERATOR"), v.literal("GUEST")),
  },
  handler: async (ctx, args) => {
    const access = await requireServerModerator(ctx, args.serverId);
    const targetMembership = await ctx.db.get(args.memberId);
    if (!targetMembership || targetMembership.serverId !== args.serverId) {
      throw new Error("Member not found");
    }

    if (targetMembership.userId === access.server.ownerId && args.role !== "ADMIN") {
      throw new Error("Cannot change the server owner's role");
    }

    if (targetMembership.role === "ADMIN" && args.role !== "ADMIN") {
      const adminMemberships = await ctx.db
        .query("members")
        .withIndex("by_server_id", (q) => q.eq("serverId", args.serverId))
        .collect();
      const adminCount = adminMemberships.filter((member) => member.role === "ADMIN").length;
      if (adminCount <= 1) {
        throw new Error("A server must keep at least one admin");
      }
    }

    await ctx.db.patch(args.memberId, { role: args.role });
  },
});

export const leave = mutation({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    const { user } = await requireCurrentUserForMutation(ctx);

    const member = await ctx.db
      .query("members")
      .withIndex("by_server_id_and_user_id", (q) =>
        q.eq("serverId", args.serverId).eq("userId", user._id),
      )
      .unique();

    if (!member) {
      throw new Error("You are not a member of this server");
    }

    if (member.role === "ADMIN") {
      throw new Error("Server admins cannot leave. Transfer ownership first.");
    }

    await ctx.db.delete(member._id);
  },
});

export const remove = mutation({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    const { user } = await requireCurrentUserForMutation(ctx);

    const server = await ctx.db.get(args.serverId);
    if (!server) {
      throw new Error("Server not found");
    }

    if (server.ownerId !== user._id) {
      throw new Error("Only the server owner can delete this server");
    }

    const members = await ctx.db
      .query("members")
      .withIndex("by_server_id", (q) => q.eq("serverId", args.serverId))
      .take(500);
    for (const member of members) {
      await ctx.db.delete(member._id);
    }

    const channels = await ctx.db
      .query("channels")
      .withIndex("by_server_id", (q) => q.eq("serverId", args.serverId))
      .take(500);
    for (const channel of channels) {
      await ctx.db.delete(channel._id);
      await ctx.scheduler.runAfter(0, internal.channels.cleanupRemovedChannelData, {
        channelId: channel._id,
      });
    }

    const categories = await ctx.db
      .query("categories")
      .withIndex("by_server_id", (q) => q.eq("serverId", args.serverId))
      .take(500);
    for (const category of categories) {
      await ctx.db.delete(category._id);
    }

    const emojis = await ctx.db
      .query("emojis")
      .withIndex("by_server_id", (q) => q.eq("serverId", args.serverId))
      .take(500);
    for (const emoji of emojis) {
      await ctx.storage.delete(emoji.storageId);
      await ctx.db.delete(emoji._id);
    }

    await ctx.db.delete(args.serverId);
  },
});
