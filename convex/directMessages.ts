import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import {
  requireCurrentUser,
  requireCurrentUserForMutation,
  requireDirectConversationMembership,
} from "./lib/auth";
import { resolveUsersById } from "./lib/messages";
import { getPresenceStatus, resolvePresenceByUserIds } from "./lib/presence";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireCurrentUser(ctx);

    const memberships = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .take(100);

    const conversationDocs = (await Promise.all(
      memberships.map((membership) => ctx.db.get(membership.directConversationId)),
    )).filter(isDefined);
    const fallbackOtherUsers = await Promise.all(
      conversationDocs.map((directConversation) =>
        resolveOtherUserSummary(ctx, directConversation, user._id),
      ),
    );
    const presenceMap = await resolvePresenceByUserIds(
      ctx,
      fallbackOtherUsers
        .map((otherUser) => otherUser?._id)
        .filter((userId): userId is Id<"users"> => userId !== undefined),
    );

    const conversations = conversationDocs.map((directConversation, index) => {
      const otherUser = fallbackOtherUsers[index];
      return {
        _creationTime: directConversation._creationTime,
        _id: directConversation._id,
        lastMessageTime: directConversation.lastMessageTime ?? null,
        otherUser: otherUser
          ? {
              ...otherUser,
              status: getPresenceStatus(otherUser, presenceMap),
            }
          : null,
      };
    });

    return conversations
      .sort(
        (left, right) =>
          (right.lastMessageTime ?? right._creationTime) -
          (left.lastMessageTime ?? left._creationTime),
      );
  },
});

export const createOrGet = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { user } = await requireCurrentUserForMutation(ctx);
    if (args.userId === user._id) {
      throw new Error("Cannot start a direct conversation with yourself");
    }

    const otherUser = await ctx.db.get(args.userId);
    if (!otherUser) {
      throw new Error("User not found");
    }

    const userMemberships = await ctx.db
      .query("members")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .take(100);
    
    const otherUserMemberships = await ctx.db
      .query("members")
      .withIndex("by_user_id", (q) => q.eq("userId", otherUser._id))
      .take(100);

    const sharedServer = userMemberships.some(m1 => 
      otherUserMemberships.some(m2 => m1.serverId === m2.serverId)
    );

    if (!sharedServer) {
      throw new Error("You must share a server with this user to direct message them");
    }

    const pairKey = buildPairKey(user._id, otherUser._id);
    const existing = await ctx.db
      .query("directConversations")
      .withIndex("by_pair_key", (q) => q.eq("pairKey", pairKey))
      .unique();

    if (existing) {
      return existing._id;
    }

    const directConversationId = await ctx.db.insert("directConversations", {
      pairKey,
      topLevelMessageCount: 0,
      leftUserClerkId: user.clerkId,
      leftUserId: user._id,
      leftUserImageUrl: user.imageUrl,
      leftUserName: user.name,
      rightUserClerkId: otherUser.clerkId,
      rightUserId: otherUser._id,
      rightUserImageUrl: otherUser.imageUrl,
      rightUserName: otherUser.name,
    });

    await ctx.db.insert("directConversationMembers", {
      directConversationId,
      userId: user._id,
    });
    await ctx.db.insert("directConversationMembers", {
      directConversationId,
      userId: otherUser._id,
    });

    return directConversationId;
  },
});

export const get = query({
  args: {
    directConversationId: v.id("directConversations"),
  },
  handler: async (ctx, args) => {
    const { user, directConversation } = await requireDirectConversationMembership(
      ctx,
      args.directConversationId,
    );
    const otherUser = await resolveOtherUserSummary(ctx, directConversation, user._id);
    const presenceMap = await resolvePresenceByUserIds(
      ctx,
      otherUser ? [otherUser._id] : [],
    );

    return {
      ...directConversation,
      otherUser: otherUser
        ? {
            ...otherUser,
            status: getPresenceStatus(otherUser, presenceMap),
          }
        : null,
    };
  },
});

export const listMembers = query({
  args: {
    directConversationId: v.id("directConversations"),
  },
  handler: async (ctx, args) => {
    await requireDirectConversationMembership(ctx, args.directConversationId);
    return await listConversationMembers(ctx, args.directConversationId);
  },
});

async function listConversationMembers(
  ctx: QueryCtx,
  directConversationId: Id<"directConversations">,
) {
  const directConversation = await ctx.db.get(directConversationId);
  if (directConversation) {
    const summarizedMembers = getConversationMemberSummaries(directConversation);
    if (summarizedMembers.length === 2) {
      const presenceMap = await resolvePresenceByUserIds(
        ctx,
        summarizedMembers.map((member) => member._id),
      );
      return summarizedMembers.map((member) => ({
        ...member,
        status: getPresenceStatus(member, presenceMap),
      }));
    }
  }

  const members = await ctx.db
    .query("directConversationMembers")
    .withIndex("by_direct_conversation_id", (q) =>
      q.eq("directConversationId", directConversationId),
    )
    .take(10);

  const users = await resolveUsersById(
    ctx,
    members.map((member) => member.userId),
  );
  const presenceMap = await resolvePresenceByUserIds(
    ctx,
    members.map((member) => member.userId),
  );

  return members
    .map((member) => users.get(member.userId) ?? null)
    .filter(isDefined)
    .map((member) => ({
      _id: member._id,
      clerkId: member.clerkId,
      imageUrl: member.imageUrl,
      name: member.name,
      status: getPresenceStatus(member, presenceMap),
    }));
}

function getConversationMemberSummaries(
  directConversation: Doc<"directConversations">,
) {
  if (
    !directConversation.leftUserId ||
    !directConversation.leftUserName ||
    !directConversation.leftUserImageUrl ||
    !directConversation.leftUserClerkId ||
    !directConversation.rightUserId ||
    !directConversation.rightUserName ||
    !directConversation.rightUserImageUrl ||
    !directConversation.rightUserClerkId
  ) {
    return [];
  }

  return [
    {
      _id: directConversation.leftUserId,
      clerkId: directConversation.leftUserClerkId,
      imageUrl: directConversation.leftUserImageUrl,
      name: directConversation.leftUserName,
    },
    {
      _id: directConversation.rightUserId,
      clerkId: directConversation.rightUserClerkId,
      imageUrl: directConversation.rightUserImageUrl,
      name: directConversation.rightUserName,
    },
  ];
}

async function resolveOtherUserSummary(
  ctx: QueryCtx,
  directConversation: Doc<"directConversations">,
  currentUserId: Id<"users">,
) {
  const summarizedMembers = getConversationMemberSummaries(directConversation);
  if (summarizedMembers.length === 2) {
    return summarizedMembers.find((member) => member._id !== currentUserId) ?? null;
  }

  const members = await listConversationMembers(ctx, directConversation._id);
  return members.find((member) => member._id !== currentUserId) ?? null;
}

function buildPairKey(leftUserId: Id<"users">, rightUserId: Id<"users">) {
  return [leftUserId, rightUserId].sort().join(":");
}

function isDefined<T>(value: T | null): value is T {
  return value !== null;
}
