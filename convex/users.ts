import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import {
  requireCurrentUser,
  requireCurrentUserForMutation,
  requireServerMembership,
} from "./lib/auth";
import { resolveUsersById } from "./lib/messages";
import { normalizeName } from "./lib/normalize";
import { getLastSeen, getPresenceStatus, resolvePresenceByUserIds } from "./lib/presence";

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
    const presenceMap = await resolvePresenceByUserIds(
      ctx,
      members.map((member) => member.userId),
    );
    const fallbackUsers = await resolveUsersById(
      ctx,
      members
        .filter((member) =>
          !member.userClerkId || !member.userImageUrl || !member.userName,
        )
        .map((member) => member.userId),
    );

    return members
      .map((member) => {
        const fallbackUser = fallbackUsers.get(member.userId);
        const name = member.userName ?? fallbackUser?.name;
        const imageUrl = member.userImageUrl ?? fallbackUser?.imageUrl;
        const clerkId = member.userClerkId ?? fallbackUser?.clerkId;
        if (!name || !imageUrl || !clerkId) {
          return null;
        }

        return {
          _id: member.userId,
          clerkId,
          imageUrl,
          memberId: member._id,
          name,
          role: member.role,
          status: getPresenceStatus(
            fallbackUser ?? { _id: member.userId, status: undefined },
            presenceMap,
          ),
        };
      })
      .filter((row) => row !== null);
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
      let nextUser = legacyUser;
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
        nextUser = {
          ...legacyUser,
          clerkId: identity.subject,
          email: identity.email ?? "",
          imageUrl: finalImageUrl,
          name: finalName,
          tokenIdentifier: identity.tokenIdentifier,
        };
        await syncUserDerivedData(ctx, nextUser);
      }
      return nextUser._id;
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

    const memberships = await ctx.db
      .query("members")
      .withIndex("by_user_id", (q) => q.eq("userId", currentUser._id))
      .take(100);
    const candidateIds = new Set<typeof currentUser._id>();

    for (const membership of memberships) {
      const serverMembers = await ctx.db
        .query("members")
        .withIndex("by_server_id", (q) => q.eq("serverId", membership.serverId))
        .take(200);
      for (const serverMember of serverMembers) {
        if (serverMember.userId !== currentUser._id) {
          candidateIds.add(serverMember.userId);
        }
      }
    }

    const memberRows = (await Promise.all(
      [...candidateIds].slice(0, 100).map(async (candidateId) => {
        const row = await ctx.db
          .query("members")
          .withIndex("by_user_id", (q) => q.eq("userId", candidateId))
          .take(1);
        return row[0] ?? null;
      }),
    )).filter((row): row is NonNullable<typeof row> => row !== null);
    const fallbackUsers = await resolveUsersById(
      ctx,
      memberRows
        .filter((member) =>
          !member.userClerkId || !member.userImageUrl || !member.userName,
        )
        .map((member) => member.userId),
    );

    return memberRows
      .map((member) => ({
        _id: member.userId,
        clerkId: member.userClerkId ?? fallbackUsers.get(member.userId)?.clerkId ?? "",
        imageUrl: member.userImageUrl ?? fallbackUsers.get(member.userId)?.imageUrl ?? "",
        name: member.userName ?? fallbackUsers.get(member.userId)?.name ?? "Unknown User",
      }))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((user) => user);
  },
});

export const current = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireCurrentUser(ctx);
    const presenceMap = await resolvePresenceByUserIds(ctx, [user._id]);
    return {
      ...user,
      lastSeen: getLastSeen(user, presenceMap),
      status: getPresenceStatus(user, presenceMap),
    };
  },
});

export const updateStatus = mutation({
  args: {
    status: v.union(v.literal("ONLINE"), v.literal("IDLE"), v.literal("DND"), v.literal("OFFLINE")),
  },
  handler: async (ctx, args) => {
    const { user } = await requireCurrentUserForMutation(ctx);
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();
    const lastSeen = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastSeen,
        status: args.status,
      });
      return;
    }

    await ctx.db.insert("presence", {
      lastSeen,
      status: args.status,
      userId: user._id,
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

async function syncUserDerivedData(
  ctx: MutationCtx,
  user: Pick<Doc<"users">, "_id" | "clerkId" | "imageUrl" | "name">,
) {
  const normalizedUserName = normalizeName(user.name);
  const members = await ctx.db
    .query("members")
    .withIndex("by_user_id", (q) => q.eq("userId", user._id))
    .take(200);

  for (const member of members) {
    if (
      member.userClerkId === user.clerkId &&
      member.userImageUrl === user.imageUrl &&
      member.userName === user.name &&
      member.userNameNormalized === normalizedUserName
    ) {
      continue;
    }

    await ctx.db.patch(member._id, {
      userClerkId: user.clerkId,
      userImageUrl: user.imageUrl,
      userName: user.name,
      userNameNormalized: normalizedUserName,
    });
  }

  const leftConversations = await ctx.db
    .query("directConversations")
    .withIndex("by_left_user_id", (q) => q.eq("leftUserId", user._id))
    .take(200);
  for (const conversation of leftConversations) {
    if (
      conversation.leftUserClerkId === user.clerkId &&
      conversation.leftUserImageUrl === user.imageUrl &&
      conversation.leftUserName === user.name
    ) {
      continue;
    }

    await ctx.db.patch(conversation._id, {
      leftUserClerkId: user.clerkId,
      leftUserImageUrl: user.imageUrl,
      leftUserName: user.name,
    });
  }

  const rightConversations = await ctx.db
    .query("directConversations")
    .withIndex("by_right_user_id", (q) => q.eq("rightUserId", user._id))
    .take(200);
  for (const conversation of rightConversations) {
    if (
      conversation.rightUserClerkId === user.clerkId &&
      conversation.rightUserImageUrl === user.imageUrl &&
      conversation.rightUserName === user.name
    ) {
      continue;
    }

    await ctx.db.patch(conversation._id, {
      rightUserClerkId: user.clerkId,
      rightUserImageUrl: user.imageUrl,
      rightUserName: user.name,
    });
  }
}
