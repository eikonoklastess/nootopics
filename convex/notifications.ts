import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireCurrentUser, requireCurrentUserForMutation } from "./lib/auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireCurrentUser(ctx);
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(50);

    return await Promise.all(
      notifications.map(async (notification) => {
        const message = await ctx.db.get(notification.messageId);
        const author = message ? await ctx.db.get(message.userId) : null;
        return {
          ...notification,
          messageContent: message?.content ?? "",
          authorName: author?.name ?? "Unknown User",
        };
      }),
    );
  },
});

export const markRead = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const { user } = await requireCurrentUserForMutation(ctx);
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      return;
    }
    if (notification.userId !== user._id) {
      throw new Error("Forbidden");
    }

    if (!notification.read) {
      await ctx.db.patch(notification._id, {
        read: true,
      });
    }
  },
});
