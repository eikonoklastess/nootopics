import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import {
  requireCurrentUser,
  requireCurrentUserForMutation,
  requireDirectConversationMembership,
} from "./lib/auth";
import { resolveUsersById } from "./lib/messages";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireCurrentUser(ctx);

    const memberships = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .take(100);

    const conversations = await Promise.all(
      memberships.map(async (membership) => {
        const directConversation = await ctx.db.get(membership.directConversationId);
        if (!directConversation) {
          return null;
        }

        const members = await ctx.db
          .query("directConversationMembers")
          .withIndex("by_direct_conversation_id", (q) =>
            q.eq("directConversationId", directConversation._id),
          )
          .take(10);
        const users = await resolveUsersById(
          ctx,
          members.map((member) => member.userId),
        );
        const otherUser =
          members
            .map((member) => users.get(member.userId) ?? null)
            .find((candidate) => candidate?._id !== user._id) ?? null;

        return {
          _creationTime: directConversation._creationTime,
          _id: directConversation._id,
          lastMessageTime: directConversation.lastMessageTime ?? null,
          otherUser: otherUser
            ? {
                _id: otherUser._id,
                clerkId: otherUser.clerkId,
                imageUrl: otherUser.imageUrl,
                name: otherUser.name,
                status: otherUser.status,
              }
            : null,
        };
      }),
    );

    return conversations
      .filter(isDefined)
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
    const members = await listConversationMembers(ctx, directConversation._id);
    const otherUser = members.find((member) => member._id !== user._id) ?? null;

    return {
      ...directConversation,
      otherUser,
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

  return members
    .map((member) => users.get(member.userId) ?? null)
    .filter(isDefined)
    .map((member) => ({
      _id: member._id,
      clerkId: member.clerkId,
      imageUrl: member.imageUrl,
      name: member.name,
      status: member.status,
    }));
}

function buildPairKey(leftUserId: Id<"users">, rightUserId: Id<"users">) {
  return [leftUserId, rightUserId].sort().join(":");
}

function isDefined<T>(value: T | null): value is T {
  return value !== null;
}
