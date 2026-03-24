import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUser } from "@clerk/clerk-react";

export function usePresence(idleTimeoutMs = 10000) {
  const { isSignedIn } = useUser();
  const updateStatus = useMutation(api.users.updateStatus);
  const statusRef = useRef<"ONLINE" | "IDLE" | "OFFLINE">("OFFLINE");
  const idleTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;

    // Helper to send the status ONLY if it changed
    const setPresenceInfo = (newStatus: "ONLINE" | "IDLE" | "OFFLINE") => {
      if (statusRef.current !== newStatus) {
        statusRef.current = newStatus;
        updateStatus({ status: newStatus }).catch(console.error);
      }
    };

    const handleActivity = () => {
      // If we move the mouse, we are definitively ONLINE
      setPresenceInfo("ONLINE");
      
      // Reset the idle timer back to 0
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        setPresenceInfo("IDLE");
      }, idleTimeoutMs);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // If we switch tabs, we are IDLE automatically
        setPresenceInfo("IDLE");
        if (idleTimer.current) clearTimeout(idleTimer.current);
      } else {
        handleActivity();
      }
    };

    // Initialize as ONLINE immediately
    handleActivity();

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("mousedown", handleActivity);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("mousedown", handleActivity);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      
      // Tell the DB we are OFFLINE upon actual unmount (like closing the page)
      // Because statusRef is not a dependency, this return block ONLY runs exactly once per mount!
      updateStatus({ status: "OFFLINE" }).catch(() => {});
    };
  }, [isSignedIn, idleTimeoutMs, updateStatus]); 
}
