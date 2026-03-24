import { UserButton } from "@clerk/clerk-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAppStore } from "../store/useAppStore";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { NextToUserButtonSettings } from "../features/chat/NextToUserButtonSettings";

export function NavigationSidebar() {
  const { activeServerId, activeSpace, setActiveServerId, showDirectMessages } =
    useAppStore();
  const servers = useQuery(api.servers.list);
  const createServer = useMutation(api.servers.create);
  const joinServer = useMutation(api.servers.join);
  const directUnreadCounts =
    (useQuery(api.readPositions.getDirectUnreadCounts) as
      | Record<string, number>
      | undefined) ?? {};
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const totalDirectUnread = Object.values(directUnreadCounts).reduce(
    (sum, count) => sum + count,
    0,
  );

  const handleCreateServer = async () => {
    if (newServerName.trim()) {
      const serverId = await createServer({ name: newServerName });
      setActiveServerId(serverId);
      setNewServerName("");
      setIsDialogOpen(false);
    }
  };

  const handleJoinServer = async () => {
    if (inviteCode.trim()) {
      try {
        const serverId = await joinServer({ inviteCode: inviteCode.trim() });
        setActiveServerId(serverId);
        setInviteCode("");
        setIsDialogOpen(false);
      } catch (error) {
        console.error("Failed to join server:", error);
      }
    }
  };

  return (
    <div className="flex flex-col items-center h-full text-primary w-full bg-[#E3E5E8] dark:bg-[#1E1F22] py-3 shadow-md z-50">
      {/* Clerk Profile */}
      <div className="pt-2 flex flex-col items-center hover:opacity-80 transition cursor-pointer">
         <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: "h-[48px] w-[48px] shadow-sm" } }} />
         <NextToUserButtonSettings />
      </div>

      <div className="h-[2px] bg-zinc-300 dark:bg-zinc-700 w-10 mx-auto rounded-md my-4" />

      {/* Render Servers */}
      <div className="flex-1 w-full flex flex-col items-center gap-y-4 overflow-y-auto hide-scrollbar">
        <Tooltip delayDuration={50}>
          <TooltipTrigger>
            <div
              onClick={showDirectMessages}
              className="relative group flex items-center justify-center cursor-pointer"
            >
              <div
                className={`absolute -left-3 bg-primary rounded-r-full transition-all w-[4px] ${
                  activeSpace === "direct"
                    ? "h-[36px]"
                    : "h-[8px] group-hover:h-[20px]"
                }`}
              />
              <div
                className={`relative h-[48px] w-[48px] rounded-[24px] group-hover:rounded-[16px] transition-all duration-200 overflow-hidden flex items-center justify-center font-bold text-lg shadow-sm ${
                  activeSpace === "direct"
                    ? "bg-emerald-500 text-white rounded-[16px]"
                    : "bg-white dark:bg-[#313338] text-zinc-700 dark:text-zinc-200 group-hover:bg-emerald-500 group-hover:text-white"
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7.5 8.25h9m-9 3H16.5m-12 6.75l2.858-2.858a3 3 0 012.121-.879h7.271A2.25 2.25 0 0019 13.013V6.75A2.25 2.25 0 0016.75 4.5h-9A2.25 2.25 0 005.5 6.75v8.25A2.25 2.25 0 007.75 17.25h.75z"
                  />
                </svg>
                {totalDirectUnread > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-md">
                    {totalDirectUnread > 99 ? "99+" : totalDirectUnread}
                  </span>
                )}
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-semibold">
            Direct Messages
          </TooltipContent>
        </Tooltip>

        {servers?.map((server: any) => (
          <Tooltip key={server._id} delayDuration={50}>
            <TooltipTrigger>
              <div onClick={() => setActiveServerId(server._id)} className="relative group flex items-center justify-center cursor-pointer">
                <div className={`absolute -left-3 bg-primary rounded-r-full transition-all w-[4px] ${activeSpace === "server" && activeServerId === server._id ? "h-[36px]" : "h-[8px] group-hover:h-[20px]"}`} />
                <div 
                  className={`h-[48px] w-[48px] rounded-[24px] group-hover:rounded-[16px] transition-all duration-200 overflow-hidden flex items-center justify-center font-bold text-lg shadow-sm ${activeSpace === "server" && activeServerId === server._id ? "bg-indigo-500 text-white rounded-[16px]" : "bg-white dark:bg-[#313338] text-zinc-700 dark:text-zinc-200 group-hover:bg-indigo-500 group-hover:text-white"}`}
                >
                  {server.imageUrl ? (
                    <img src={server.imageUrl} alt={server.name} className="object-cover w-full h-full" />
                  ) : (
                    server.name.charAt(0).toUpperCase()
                  )}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-semibold">{server.name}</TooltipContent>
          </Tooltip>
        ))}

        {/* Create Server Action */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <Tooltip delayDuration={50}>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <div className="relative group flex items-center justify-center cursor-pointer mt-2">
                  <div className="h-[48px] w-[48px] rounded-[24px] group-hover:rounded-[16px] transition-all duration-200 overflow-hidden flex items-center justify-center bg-white dark:bg-[#313338] text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white shadow-sm border border-transparent dark:border-zinc-800">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  </div>
                </div>
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-semibold">Add a Server</TooltipContent>
          </Tooltip>

          <DialogContent className="bg-white dark:bg-[#313338] text-black dark:text-white border-none shadow-2xl max-w-md p-6 sm:rounded-[24px]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-center text-zinc-900 dark:text-zinc-50">Add a Server</DialogTitle>
            </DialogHeader>
            <div className="text-center text-zinc-500 dark:text-zinc-400 text-sm mb-4">
              Create a new community or join an existing one using an invite code.
            </div>
            <div className="space-y-6 mt-2">
              <div className="space-y-3 bg-zinc-50 dark:bg-[#1E1F22]/50 p-4 rounded-xl border border-zinc-200/50 dark:border-zinc-800">
                <h3 className="font-bold text-zinc-700 dark:text-zinc-300 tracking-wide text-sm flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> Create a Server
                </h3>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase text-zinc-500 dark:text-zinc-400">Server Name</label>
                  <Input 
                    value={newServerName} 
                    onChange={(e) => setNewServerName(e.target.value)} 
                    className="bg-white dark:bg-[#1E1F22] border border-zinc-300 dark:border-zinc-900 focus-visible:ring-indigo-500 text-zinc-900 dark:text-zinc-200 h-10 px-4 placeholder:text-zinc-400" 
                    placeholder="Enter server name..." 
                  />
                </div>
                <Button onClick={handleCreateServer} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold transition h-10 shadow-sm hover:-translate-y-0.5 mt-2">
                  Create
                </Button>
              </div>

              <div className="space-y-3 bg-zinc-50 dark:bg-[#1E1F22]/50 p-4 rounded-xl border border-zinc-200/50 dark:border-zinc-800">
                <h3 className="font-bold text-zinc-700 dark:text-zinc-300 tracking-wide text-sm flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Join a Server
                </h3>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase text-zinc-500 dark:text-zinc-400">Invite Code</label>
                  <Input 
                    value={inviteCode} 
                    onChange={(e) => setInviteCode(e.target.value)} 
                    className="bg-white dark:bg-[#1E1F22] border border-zinc-300 dark:border-zinc-900 focus-visible:ring-emerald-500 text-zinc-900 dark:text-zinc-200 h-10 px-4 placeholder:text-zinc-400 font-mono text-xs" 
                    placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000" 
                  />
                </div>
                <Button onClick={handleJoinServer} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold transition h-10 shadow-sm hover:-translate-y-0.5 mt-2">
                  Join
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
