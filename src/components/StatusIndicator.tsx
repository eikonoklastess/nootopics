export function StatusIndicator({ status }: { status?: "ONLINE" | "IDLE" | "OFFLINE" | "DND" }) {
  // If no status is set yet, we assume OFFLINE
  const activeStatus = status || "OFFLINE";

  // Different colors for different states
  const colors = {
    ONLINE: "bg-emerald-500",
    IDLE: "bg-amber-400",
    DND: "bg-rose-500",
    OFFLINE: "bg-zinc-500/50", // Faded grey for offline
  };

  return (
    <div 
      className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-[2.5px] ring-white dark:ring-[#313338] ${colors[activeStatus]}`} 
    />
  );
}
