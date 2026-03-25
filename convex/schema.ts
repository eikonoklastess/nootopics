import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    tokenIdentifier: v.optional(v.string()),
    name: v.string(),
    email: v.string(),
    imageUrl: v.string(),
    status: v.optional(v.union(v.literal("ONLINE"), v.literal("IDLE"), v.literal("DND"), v.literal("OFFLINE"))),
    lastSeen: v.optional(v.number()),
    notificationSettings: v.optional(
      v.object({
        desktop: v.union(
          v.literal("ALL"),
          v.literal("MENTIONS"),
          v.literal("NONE"),
        ),
      }),
    ),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_token_identifier", ["tokenIdentifier"]),

  servers: defineTable({
    name: v.string(),
    imageUrl: v.optional(v.string()),
    ownerId: v.id("users"),
    inviteCode: v.string(),
  }).index("by_invite_code", ["inviteCode"]),

  members: defineTable({
    userId: v.id("users"),
    serverId: v.id("servers"),
    role: v.union(v.literal("ADMIN"), v.literal("MODERATOR"), v.literal("GUEST")),
    userClerkId: v.optional(v.string()),
    userName: v.optional(v.string()),
    userImageUrl: v.optional(v.string()),
    userNameNormalized: v.optional(v.string()),
  })
    .index("by_user_id", ["userId"])
    .index("by_server_id", ["serverId"])
    .index("by_server_id_and_user_id", ["serverId", "userId"])
    .index("by_server_id_and_user_name_normalized", ["serverId", "userNameNormalized"]),

  categories: defineTable({
    name: v.string(),
    serverId: v.id("servers"),
    order: v.optional(v.number()),
  }).index("by_server_id", ["serverId"]),

  channels: defineTable({
    name: v.string(),
    serverId: v.id("servers"),
    type: v.union(v.literal("TEXT"), v.literal("AUDIO")),
    categoryId: v.optional(v.id("categories")),
    order: v.optional(v.number()),
    topLevelMessageCount: v.optional(v.number()),
    lastMessageTime: v.optional(v.number()),
    normalizedName: v.optional(v.string()),
  })
    .index("by_server_id", ["serverId"])
    .index("by_server_id_and_category_id", ["serverId", "categoryId"])
    .index("by_server_id_and_normalized_name", ["serverId", "normalizedName"]),

  directConversations: defineTable({
    pairKey: v.string(),
    topLevelMessageCount: v.optional(v.number()),
    lastMessageTime: v.optional(v.number()),
    leftUserId: v.optional(v.id("users")),
    leftUserName: v.optional(v.string()),
    leftUserImageUrl: v.optional(v.string()),
    leftUserClerkId: v.optional(v.string()),
    rightUserId: v.optional(v.id("users")),
    rightUserName: v.optional(v.string()),
    rightUserImageUrl: v.optional(v.string()),
    rightUserClerkId: v.optional(v.string()),
  })
    .index("by_pair_key", ["pairKey"])
    .index("by_left_user_id", ["leftUserId"])
    .index("by_right_user_id", ["rightUserId"]),

  directConversationMembers: defineTable({
    directConversationId: v.id("directConversations"),
    userId: v.id("users"),
  })
    .index("by_direct_conversation_id", ["directConversationId"])
    .index("by_user_id", ["userId"])
    .index("by_user_id_and_direct_conversation_id", ["userId", "directConversationId"]),

  messages: defineTable({
    content: v.string(),
    channelId: v.optional(v.id("channels")),
    directConversationId: v.optional(v.id("directConversations")),
    serverId: v.optional(v.id("servers")),
    userId: v.id("users"),
    deleted: v.boolean(),
    isEdited: v.optional(v.boolean()),
    parentMessageId: v.optional(v.union(v.id("messages"), v.null())),
    threadId: v.optional(v.id("messages")),
    replyCount: v.optional(v.number()),
    files: v.optional(v.array(v.object({
      storageId: v.id("_storage"),
      name: v.string(),
      type: v.string(),
      size: v.number(),
    }))),
    pinned: v.optional(v.boolean()),
    reactionSummary: v.optional(v.array(v.object({
      emoji: v.string(),
      count: v.number(),
      userIds: v.array(v.id("users")),
    }))),
  })
    .index("by_channel_id", ["channelId"])
    .index("by_channel_id_and_pinned", ["channelId", "pinned"])
    .index("by_channel_id_and_parent_message_id", ["channelId", "parentMessageId"])
    .index("by_direct_conversation_id", ["directConversationId"])
    .index("by_direct_conversation_id_and_pinned", ["directConversationId", "pinned"])
    .index("by_direct_conversation_id_and_parent_message_id", ["directConversationId", "parentMessageId"])
    .index("by_server_id", ["serverId"])
    .index("by_thread_id", ["threadId"])
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["serverId"],
    }),

  typing: defineTable({
    channelId: v.optional(v.id("channels")),
    directConversationId: v.optional(v.id("directConversations")),
    userId: v.id("users"),
    expiresAt: v.number(),
  })
    .index("by_channel_id", ["channelId"])
    .index("by_channel_id_and_user_id", ["channelId", "userId"])
    .index("by_direct_conversation_id", ["directConversationId"])
    .index("by_direct_conversation_id_and_user_id", ["directConversationId", "userId"]),

  readPositions: defineTable({
    userId: v.id("users"),
    channelId: v.optional(v.id("channels")),
    directConversationId: v.optional(v.id("directConversations")),
    lastReadTime: v.number(),
    lastReadTopLevelMessageCount: v.optional(v.number()),
  })
    .index("by_user_id", ["userId"])
    .index("by_channel_id", ["channelId"])
    .index("by_user_id_and_channel_id", ["userId", "channelId"])
    .index("by_user_id_and_direct_conversation_id", ["userId", "directConversationId"]),

  emojis: defineTable({
    name: v.string(),
    serverId: v.id("servers"),
    storageId: v.id("_storage"),
    format: v.union(v.literal("png"), v.literal("gif")),
  }).index("by_server_id", ["serverId"]),

  reactions: defineTable({
    messageId: v.id("messages"),
    userId: v.id("users"),
    emoji: v.string(),
  })
    .index("by_message_id", ["messageId"])
    .index("by_message_id_and_emoji", ["messageId", "emoji"])
    .index("by_message_id_and_user_id_and_emoji", [
      "messageId",
      "userId",
      "emoji",
    ]),

  notifications: defineTable({
    userId: v.id("users"),
    messageId: v.id("messages"),
    serverId: v.optional(v.id("servers")),
    channelId: v.optional(v.id("channels")),
    directConversationId: v.optional(v.id("directConversations")),
    type: v.union(v.literal("MENTION"), v.literal("DIRECT_MESSAGE")),
    read: v.boolean(),
    authorName: v.optional(v.string()),
    messagePreview: v.optional(v.string()),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_id_and_read", ["userId", "read"])
    .index("by_channel_id", ["channelId"])
    .index("by_direct_conversation_id", ["directConversationId"])
    .index("by_message_id", ["messageId"]),

  presence: defineTable({
    userId: v.id("users"),
    status: v.union(v.literal("ONLINE"), v.literal("IDLE"), v.literal("DND"), v.literal("OFFLINE")),
    lastSeen: v.number(),
  }).index("by_user_id", ["userId"]),

  messageSearchDigests: defineTable({
    messageId: v.id("messages"),
    serverId: v.id("servers"),
    channelId: v.id("channels"),
    userId: v.id("users"),
    content: v.string(),
    createdAt: v.number(),
    hasFiles: v.boolean(),
    hasImage: v.boolean(),
    hasVideo: v.boolean(),
    hasAudio: v.boolean(),
    hasReplies: v.boolean(),
    isReply: v.boolean(),
    deleted: v.boolean(),
  })
    .index("by_message_id", ["messageId"])
    .index("by_server_id_and_created_at", ["serverId", "createdAt"])
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: [
        "serverId",
        "channelId",
        "userId",
        "hasFiles",
        "hasImage",
        "hasVideo",
        "hasAudio",
        "hasReplies",
        "isReply",
      ],
    }),
});
