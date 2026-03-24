const statusLabels = {
  ONLINE: "Online",
  IDLE: "Idle",
  DND: "Do Not Disturb",
  OFFLINE: "Offline",
} as const;

const statusColors = {
  ONLINE: "bg-emerald-500",
  IDLE: "bg-amber-400",
  DND: "bg-rose-500",
  OFFLINE: "bg-zinc-500/50",
} as const;

export function StatusIndicator({ status }: { status?: "ONLINE" | "IDLE" | "OFFLINE" | "DND" }) {
  const activeStatus = status || "OFFLINE";

  return (
    <div
      className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-[2.5px] ring-white dark:ring-[#313338] ${statusColors[activeStatus]}`}
      role="status"
      aria-label={statusLabels[activeStatus]}
      title={statusLabels[activeStatus]}
    />
  );
}
