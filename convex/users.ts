import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  requireCurrentUser,
  requireCurrentUserForMutation,
  requireServerMembership,
} from "./lib/auth";

const notificationSettingsValidator = v.object({
  desktop: v.union(v.literal("ALL"), v.literal("MENTIONS"), v.literal("NONE")),
});

// List all members of a server (for @mention autocomplete)
export const listByServer = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    await requireServerMembership(ctx, args.serverId);

    const members = await ctx.db
      .query("members")
      .withIndex("by_server_id", (q) => q.eq("serverId", args.serverId))
      .take(100);

    return await Promise.all(
      members.map(async (member) => {
        const user = await ctx.db.get(member.userId);
        return user
          ? {
              _id: user._id,
              name: user.name,
              imageUrl: user.imageUrl,
              clerkId: user.clerkId,
              memberId: member._id,
              role: member.role,
            }
          : null;
      }),
    ).then((rows) => rows.filter(Boolean));
  },
});

export const storeUser = mutation({
  args: {
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Called storeUser without authentication present");

    const finalName = args.name ?? identity.name ?? "Unknown User";
    const finalImageUrl = args.imageUrl ?? identity.pictureUrl ?? "";

    const user = await ctx.db
      .query("users")
      .withIndex("by_token_identifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    const legacyUser =
      user ??
      (await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .unique());

    if (legacyUser !== null) {
      if (
        legacyUser.name !== finalName ||
        legacyUser.imageUrl !== finalImageUrl ||
        legacyUser.email !== (identity.email ?? "") ||
        legacyUser.clerkId !== identity.subject ||
        legacyUser.tokenIdentifier !== identity.tokenIdentifier
      ) {
        await ctx.db.patch(legacyUser._id, {
          clerkId: identity.subject,
          tokenIdentifier: identity.tokenIdentifier,
          name: finalName,
          email: identity.email ?? "",
          imageUrl: finalImageUrl,
        });
      }
      return legacyUser._id;
    }

    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      tokenIdentifier: identity.tokenIdentifier,
      name: finalName,
      email: identity.email ?? "",
      imageUrl: finalImageUrl,
      notificationSettings: {
        desktop: "ALL",
      },
    });
  },
});

export const listDirectMessageCandidates = query({
  args: {},
  handler: async (ctx) => {
    const { user: currentUser } = await requireCurrentUser(ctx);

    const users = await ctx.db.query("users").take(100);
    return users
      .filter((user) => user._id !== currentUser._id)
      .map((user) => ({
        _id: user._id,
        clerkId: user.clerkId,
        imageUrl: user.imageUrl,
        name: user.name,
      }));
  },
});

export const current = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireCurrentUser(ctx);
    return user;
  },
});

export const updateStatus = mutation({
  args: {
    status: v.union(v.literal("ONLINE"), v.literal("IDLE"), v.literal("DND"), v.literal("OFFLINE")),
  },
  handler: async (ctx, args) => {
    const { user } = await requireCurrentUserForMutation(ctx);

    await ctx.db.patch(user._id, {
      status: args.status,
      lastSeen: Date.now(),
    });
  },
});

export const updateSettings = mutation({
  args: {
    notificationSettings: notificationSettingsValidator,
  },
  handler: async (ctx, args) => {
    const { user } = await requireCurrentUserForMutation(ctx);
    await ctx.db.patch(user._id, {
      notificationSettings: args.notificationSettings,
    });
  },
});
