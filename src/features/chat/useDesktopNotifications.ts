import { useEffect, useRef } from "react";
import type { NotificationItem } from "./NotificationsPanel";

export function useDesktopNotifications(notifications: NotificationItem[]) {
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const notification of notifications) {
      seen.current.add(String(notification._id));
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    if (Notification.permission === "default") {
      void Notification.requestPermission();
      return;
    }
    if (Notification.permission !== "granted") {
      return;
    }

    for (const notification of notifications) {
      const key = String(notification._id);
      if (notification.read || seen.current.has(key)) {
        continue;
      }

      const title =
        notification.type === "MENTION"
          ? `${notification.authorName} mentioned you`
          : `New direct message from ${notification.authorName}`;
      try {
        new Notification(title, {
          body: notification.messageContent || "Open chat to view the message",
        });
      } catch (error) {
        // Mobile browsers (like Chrome on Android) throw an Illegal Constructor error
        // because they require a Service Worker to show notifications.
        if (navigator.serviceWorker) {
          navigator.serviceWorker.ready.then((registration) => {
            if (registration) {
              void registration.showNotification(title, {
                body: notification.messageContent || "Open chat to view the message",
              });
            }
          }).catch((swError) => {
            console.warn("Could not show desktop notification via Service Worker:", swError);
          });
        } else {
          console.warn("Could not show desktop notification:", error);
        }
      }
      seen.current.add(key);
    }
  }, [notifications]);
}
