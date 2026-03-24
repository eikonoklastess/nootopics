import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { UserIdentity } from "convex/server";

type ReaderCtx = QueryCtx | MutationCtx;
type MembershipRole = Doc<"members">["role"];
export type ConversationTarget =
  | {
      channelId: Id<"channels">;
      directConversationId?: undefined;
    }
  | {
      channelId?: undefined;
      directConversationId: Id<"directConversations">;
    };

async function findUserByIdentity(ctx: ReaderCtx, identity: UserIdentity) {
  const byTokenIdentifier = await ctx.db
    .query("users")
    .withIndex("by_token_identifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();

  if (byTokenIdentifier) {
    return byTokenIdentifier;
  }

  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

export async function requireIdentity(ctx: ReaderCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized");
  }
  return identity;
}

export async function requireCurrentUser(ctx: ReaderCtx) {
  const identity = await requireIdentity(ctx);
  const user = await findUserByIdentity(ctx, identity);
  if (!user) {
    throw new Error("User not found");
  }
  return { identity, user };
}

export async function requireCurrentUserForMutation(ctx: MutationCtx) {
  const { identity, user } = await requireCurrentUser(ctx);

  if (
    user.tokenIdentifier !== identity.tokenIdentifier ||
    user.clerkId !== identity.subject
  ) {
    await ctx.db.patch(user._id, {
      tokenIdentifier: identity.tokenIdentifier,
      clerkId: identity.subject,
    });

    return {
      identity,
      user: {
        ...user,
        tokenIdentifier: identity.tokenIdentifier,
        clerkId: identity.subject,
      },
    };
  }

  return { identity, user };
}

export async function requireServerMembership(
  ctx: ReaderCtx,
  serverId: Id<"servers">,
) {
  const { user } = await requireCurrentUser(ctx);
  const server = await ctx.db.get(serverId);
  if (!server) {
    throw new Error("Server not found");
  }

  const member = await ctx.db
    .query("members")
    .withIndex("by_server_id_and_user_id", (q) =>
      q.eq("serverId", serverId).eq("userId", user._id),
    )
    .unique();

  if (!member) {
    throw new Error("Forbidden");
  }

  return { user, server, member };
}

export async function requireServerModerator(
  ctx: ReaderCtx,
  serverId: Id<"servers">,
) {
  const access = await requireServerMembership(ctx, serverId);
  if (!isPrivilegedRole(access.member.role)) {
    throw new Error("Forbidden");
  }
  return access;
}

export async function requireChannelMembership(
  ctx: ReaderCtx,
  channelId: Id<"channels">,
) {
  const channel = await ctx.db.get(channelId);
  if (!channel) {
    throw new Error("Channel not found");
  }

  const access = await requireServerMembership(ctx, channel.serverId);
  return { ...access, channel };
}

export async function requireDirectConversationMembership(
  ctx: ReaderCtx,
  directConversationId: Id<"directConversations">,
) {
  const { user } = await requireCurrentUser(ctx);
  const directConversation = await ctx.db.get(directConversationId);
  if (!directConversation) {
    throw new Error("Direct conversation not found");
  }

  const conversationMember = await ctx.db
    .query("directConversationMembers")
    .withIndex("by_user_id_and_direct_conversation_id", (q) =>
      q.eq("userId", user._id).eq("directConversationId", directConversationId),
    )
    .unique();

  if (!conversationMember) {
    throw new Error("Forbidden");
  }

  return { user, directConversation, conversationMember };
}

export async function requireConversationAccess(
  ctx: ReaderCtx,
  target: ConversationTarget,
) {
  if ("channelId" in target && target.channelId !== undefined) {
    const access = await requireChannelMembership(ctx, target.channelId);
    return {
      ...access,
      kind: "channel" as const,
    };
  }

  if (
    "directConversationId" in target &&
    target.directConversationId !== undefined
  ) {
    const access = await requireDirectConversationMembership(
      ctx,
      target.directConversationId,
    );
    return {
      ...access,
      kind: "direct" as const,
    };
  }

  throw new Error("Conversation target is required");
}

export async function requireMessageAccess(
  ctx: ReaderCtx,
  messageId: Id<"messages">,
) {
  const message = await ctx.db.get(messageId);
  if (!message) {
    throw new Error("Message not found");
  }

  const access = message.channelId
    ? await requireConversationAccess(ctx, { channelId: message.channelId })
    : message.directConversationId
      ? await requireConversationAccess(ctx, {
          directConversationId: message.directConversationId,
        })
      : null;

  if (!access) {
    throw new Error("Message is missing its parent conversation");
  }

  return { ...access, message };
}

export async function requireThreadParentAccess(
  ctx: ReaderCtx,
  threadId: Id<"messages">,
) {
  const access = await requireMessageAccess(ctx, threadId);
  if (access.message.threadId) {
    throw new Error("Thread replies cannot be used as thread roots");
  }
  return access;
}

export async function requireMessageOwner(
  ctx: ReaderCtx,
  messageId: Id<"messages">,
) {
  const access = await requireMessageAccess(ctx, messageId);
  if (access.message.userId !== access.user._id) {
    throw new Error("Forbidden");
  }
  return access;
}

export function isPrivilegedRole(role: MembershipRole) {
  return role === "ADMIN" || role === "MODERATOR";
}
