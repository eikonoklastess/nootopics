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
      .take(100);

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
        .take(100);
      const adminCount = adminMemberships.filter((member) => member.role === "ADMIN").length;
      if (adminCount <= 1) {
        throw new Error("A server must keep at least one admin");
      }
    }

    await ctx.db.patch(args.memberId, { role: args.role });
  },
});
