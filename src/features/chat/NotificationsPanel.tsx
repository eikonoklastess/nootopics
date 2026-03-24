import type { Id } from "../../../convex/_generated/dataModel";

export interface NotificationItem {
  _id: Id<"notifications">;
  _creationTime: number;
  read: boolean;
  type: "MENTION" | "DIRECT_MESSAGE";
  messageId: Id<"messages">;
  serverId?: Id<"servers">;
  channelId?: Id<"channels">;
  directConversationId?: Id<"directConversations">;
  authorName: string;
  messageContent: string;
}

interface NotificationsPanelProps {
  notifications: NotificationItem[];
  onSelect: (notification: NotificationItem) => void;
  onClose: () => void;
}

export function NotificationsPanel({
  notifications,
  onSelect,
  onClose,
}: NotificationsPanelProps) {
  return (
    <div className="absolute right-4 top-14 z-40 w-full max-w-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1E1F22] shadow-xl">
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
        <h3 className="font-semibold">Notifications</h3>
        <button
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 && (
          <div className="px-4 py-6 text-sm text-zinc-500">No notifications yet.</div>
        )}
        {notifications.map((notification) => (
          <button
            className="block w-full border-b border-zinc-100 dark:border-zinc-900 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
            key={notification._id}
            onClick={() => onSelect(notification)}
            type="button"
          >
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span
                className={`h-2 w-2 rounded-full ${notification.read ? "bg-zinc-400" : "bg-rose-500"}`}
              />
              <span>
                {notification.type === "MENTION" ? "Mention" : "Direct message"}
              </span>
            </div>
            <p className="mt-1 text-sm font-medium">
              {notification.authorName}
              <span className="ml-1 font-normal text-zinc-600 dark:text-zinc-300">
                {notification.messageContent || "sent a message"}
              </span>
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
