import { useEffect, useRef, useState } from "react";
import { StatusIndicator } from "../../components/StatusIndicator";

const statusDisplayText: Record<
  "ONLINE" | "IDLE" | "DND" | "OFFLINE",
  string
> = {
  ONLINE: "Online",
  IDLE: "Idle",
  DND: "DND",
  OFFLINE: "Offline",
};

interface UserProfilePopoverProps {
  user: {
    _id: string;
    name?: string;
    imageUrl?: string;
    status?: "ONLINE" | "IDLE" | "DND" | "OFFLINE";
    clerkId?: string;
  };
  children: React.ReactNode;
  side?: "left" | "right";
}

export function UserProfilePopover({
  user,
  children,
  side = "right",
}: UserProfilePopoverProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const status = user.status ?? "OFFLINE";
  const displayName = user.name?.trim() || "Unknown user";
  const initial = displayName.charAt(0).toUpperCase() || "?";

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const node = e.target as Node;
      if (
        triggerRef.current?.contains(node) ||
        popoverRef.current?.contains(node)
      ) {
        return;
      }
      setOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const sideClasses =
    side === "right"
      ? "left-full top-0 ml-2"
      : "right-full top-0 mr-2";

  return (
    <div className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex cursor-pointer border-0 bg-transparent p-0 text-left"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        {children}
      </button>

      {open ? (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={`Profile: ${displayName}`}
          className={`absolute z-50 w-72 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-[#232428] ${sideClasses}`}
        >
          <div className="h-16 shrink-0 rounded-t-xl bg-indigo-500" />
          <div className="relative px-4 pb-4 pt-0">
            <div className="relative -mt-8 inline-block">
              <div className="relative h-16 w-16 overflow-hidden rounded-full bg-zinc-600 ring-4 ring-white dark:ring-[#232428]">
                {user.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-white">
                    {initial}
                  </div>
                )}
                <StatusIndicator status={status} />
              </div>
            </div>
            <div className="mt-2 font-bold text-lg text-zinc-900 dark:text-zinc-100">
              {displayName}
            </div>
            <p className="text-sm text-muted-foreground">
              {statusDisplayText[status]}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
