import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { useAppStore } from "../store/useAppStore";
import type {
  DirectConversationSummary,
  ServerEmoji,
  ServerMember,
} from "../features/chat/types";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Input } from "./ui/input";
import { ServerSettingsModal } from "./ServerSettingsModal";
import { ChannelSettingsModal } from "./ChannelSettingsModal";
import type { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

export function ServerSidebar() {
  const {
    activeSpace,
    activeServerId,
    activeChannelId,
    activeDirectConversationId,
    setActiveServerId,
    setActiveChannelId,
    setActiveDirectConversationId,
  } = useAppStore();

  const server =
    useQuery(
      api.servers.get,
      activeSpace === "server" && activeServerId
        ? { serverId: activeServerId }
        : "skip",
    ) ?? null;
  const channels =
    useQuery(
      api.channels.list,
      activeSpace === "server" && activeServerId
        ? { serverId: activeServerId }
        : "skip",
    ) ?? [];
  const categories =
    useQuery(
      api.categories.list,
      activeSpace === "server" && activeServerId
        ? { serverId: activeServerId }
        : "skip",
    ) ?? [];
  const createCategory = useMutation(api.categories.create);
  const unreadCounts =
    (useQuery(
      api.readPositions.getUnreadCounts,
      activeSpace === "server" && activeServerId
        ? { serverId: activeServerId }
        : "skip",
    ) as Record<string, number> | undefined) ?? {};
  const directConversations =
    (useQuery(
      api.directMessages.list,
      activeSpace === "direct" ? {} : "skip",
    ) as DirectConversationSummary[] | undefined) ?? [];
  const directUnreadCounts =
    (useQuery(
      api.readPositions.getDirectUnreadCounts,
      activeSpace === "direct" ? {} : "skip",
    ) as Record<string, number> | undefined) ?? {};
  const directCandidates =
    (useQuery(
      api.users.listDirectMessageCandidates,
      activeSpace === "direct" ? {} : "skip",
    ) as ServerMember[] | undefined) ?? [];
  const serverEmojis =
    (useQuery(
      api.emojis.list,
      activeSpace === "server" && activeServerId ? { serverId: activeServerId } : "skip",
    ) as ServerEmoji[] | undefined) ?? [];

  const currentUser = useQuery(api.users.current);

  const createChannel = useMutation(api.channels.create);
  const createDirectConversation = useMutation(api.directMessages.createOrGet);
  const leaveServer = useMutation(api.servers.leave);
  const deleteServer = useMutation(api.servers.remove);

  const [isChannelDialogOpen, setIsChannelDialogOpen] = useState(false);
  const [isDirectDialogOpen, setIsDirectDialogOpen] = useState(false);
  const [isEmojiDialogOpen, setIsEmojiDialogOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [directSearch, setDirectSearch] = useState("");
  const [newEmojiName, setNewEmojiName] = useState("");
  const [emojiFile, setEmojiFile] = useState<File | null>(null);
  const [isUploadingEmoji, setIsUploadingEmoji] = useState(false);
  const [emojiError, setEmojiError] = useState<string | null>(null);

  const generateUploadUrl = useMutation(api.emojis.generateUploadUrl);
  const createEmoji = useMutation(api.emojis.create);

  const [isServerSettingsOpen, setIsServerSettingsOpen] = useState(false);
  const [isServerDropdownOpen, setIsServerDropdownOpen] = useState(false);
  const [settingsChannelId, setSettingsChannelId] = useState<Id<"channels"> | null>(null);
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleCreateCategory = async () => {
    if (!activeServerId || !newCategoryName.trim()) return;
    await createCategory({ serverId: activeServerId, name: newCategoryName });
    setNewCategoryName("");
    setIsCreateCategoryOpen(false);
  };
  
  const toggleCategory = (categoryId: string) => {
    const next = new Set(collapsedCategories);
    if (next.has(categoryId)) next.delete(categoryId);
    else next.add(categoryId);
    setCollapsedCategories(next);
  };

  const isServerOwner = server && currentUser && server.ownerId === currentUser._id;

  const handleLeaveServer = async () => {
    if (!activeServerId) return;
    try {
      await leaveServer({ serverId: activeServerId });
      setActiveServerId(null);
      toast.success("You left the server");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to leave server");
    }
  };

  const handleDeleteServer = async () => {
    if (!activeServerId) return;
    try {
      await deleteServer({ serverId: activeServerId });
      setActiveServerId(null);
      toast.success("Server deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete server");
    }
  };

  const handleCreateChannel = async () => {
    if (!activeServerId || !newChannelName.trim()) {
      return;
    }

    await createChannel({
      serverId: activeServerId,
      name: newChannelName.toLowerCase().replace(/\s+/g, "-"),
      type: "TEXT",
    });
    setNewChannelName("");
    setIsChannelDialogOpen(false);
  };

  const handleUploadEmoji = async () => {
    if (!activeServerId || !newEmojiName.trim() || !emojiFile) return;
    
    setIsUploadingEmoji(true);
    setEmojiError(null);
    try {
      const uploadUrl = await generateUploadUrl({ serverId: activeServerId });
      const result = await fetch(uploadUrl, {
        method: "POST",
        body: emojiFile,
        headers: { "Content-Type": emojiFile.type }
      });
      if (!result.ok) {
        throw new Error("Emoji upload failed.");
      }
      const { storageId } = await result.json();
      if (!storageId) {
        throw new Error("Emoji upload failed.");
      }

      await createEmoji({
        serverId: activeServerId,
        name: newEmojiName.replace(/[^a-zA-Z0-9_]/g, ""),
        storageId,
        format: emojiFile.type === "image/gif" ? "gif" : "png"
      });
      setIsEmojiDialogOpen(false);
      setNewEmojiName("");
      setEmojiFile(null);
    } catch (error) {
      setEmojiError(
        error instanceof Error ? error.message : "Failed to upload emoji.",
      );
    } finally {
      setIsUploadingEmoji(false);
    }
  };

  const handleStartDirectConversation = async (userId: ServerMember["_id"]) => {
    const directConversationId = await createDirectConversation({ userId });
    setActiveDirectConversationId(directConversationId);
    setIsDirectDialogOpen(false);
    setDirectSearch("");
  };

  if (activeSpace === "direct") {
    const filteredCandidates = directCandidates.filter((candidate) =>
      candidate.name.toLowerCase().includes(directSearch.trim().toLowerCase()),
    );

    return (
      <div className="flex flex-col h-full text-primary w-full dark:bg-[#2B2D31] bg-[#F2F3F5] shadow-sm">
        <div className="w-full text-md font-bold px-4 flex items-center justify-between h-[60px] border-neutral-200 dark:border-zinc-900 border-b shadow-sm z-10">
          <div>
            <div className="truncate dark:text-zinc-100">Direct Messages</div>
            <div className="text-[10px] uppercase font-bold text-zinc-500 mt-0.5">
              Private conversations
            </div>
          </div>

          <Dialog open={isDirectDialogOpen} onOpenChange={setIsDirectDialogOpen}>
            <DialogTrigger asChild>
              <button className="cursor-pointer hover:text-zinc-800 dark:hover:text-zinc-200 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </DialogTrigger>

            <DialogContent className="bg-white dark:bg-[#313338] text-black dark:text-white border-none shadow-xl max-w-md p-6">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">Start a DM</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                <Input
                  value={directSearch}
                  onChange={(event) => setDirectSearch(event.target.value)}
                  className="bg-zinc-100 dark:bg-[#1E1F22] border-none focus-visible:ring-emerald-500 text-zinc-900 dark:text-zinc-200"
                  placeholder="Search users"
                />

                <div className="max-h-80 overflow-y-auto space-y-1">
                  {filteredCandidates.map((candidate) => (
                    <button
                      key={candidate._id}
                      type="button"
                      onClick={() => void handleStartDirectConversation(candidate._id)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                    >
                      <img
                        src={candidate.imageUrl}
                        alt={candidate.name}
                        className="w-9 h-9 rounded-full object-cover bg-zinc-200 dark:bg-zinc-700"
                      />
                      <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                        {candidate.name}
                      </span>
                    </button>
                  ))}

                  {filteredCandidates.length === 0 && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 px-1 py-6 text-center">
                      No users found.
                    </p>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex-1 overflow-y-auto px-2 mt-4 space-y-[2px] hide-scrollbar">
          {directConversations.length === 0 ? (
            <div className="px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">
              Start a DM to begin a private conversation.
            </div>
          ) : (
            directConversations.map((conversation) => (
              <button
                type="button"
                key={conversation._id}
                onClick={() => setActiveDirectConversationId(conversation._id)}
                className={`group px-2 py-2 rounded-md flex items-center gap-x-3 w-full hover:bg-zinc-700/10 dark:hover:bg-zinc-700/50 transition cursor-pointer text-left ${
                  activeDirectConversationId === conversation._id
                    ? "bg-zinc-700/20 dark:bg-zinc-700/50 text-emerald-600 dark:text-white"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                <img
                  src={conversation.otherUser?.imageUrl}
                  alt={conversation.otherUser?.name ?? "Direct message"}
                  className="w-8 h-8 rounded-full object-cover bg-zinc-200 dark:bg-zinc-700"
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`line-clamp-1 font-semibold text-[15px] transition group-hover:text-zinc-600 dark:group-hover:text-zinc-300 ${
                      activeDirectConversationId === conversation._id
                        ? "text-zinc-800 dark:text-zinc-100"
                        : ""
                    }`}
                  >
                    {conversation.otherUser?.name ?? "Unknown user"}
                  </p>
                </div>
                {directUnreadCounts[conversation._id] > 0 &&
                  activeDirectConversationId !== conversation._id && (
                    <span className="min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-black bg-emerald-500 text-white rounded-full px-1">
                      {directUnreadCounts[conversation._id] > 99
                        ? "99+"
                        : directUnreadCounts[conversation._id]}
                    </span>
                  )}
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  if (!activeServerId) {
    return (
      <div className="flex flex-col h-full text-primary w-full dark:bg-[#2B2D31] bg-[#F2F3F5] items-center justify-center p-4 text-center text-zinc-500">
        <div className="flex flex-col items-center">
          <svg className="w-16 h-16 mb-4 text-zinc-400 opacity-50" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          <p className="font-semibold">Select a server or open Direct Messages.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full text-primary w-full dark:bg-[#2B2D31] bg-[#F2F3F5] shadow-sm relative pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div 
        className="w-full text-md font-bold px-4 flex flex-col justify-center h-[60px] border-neutral-200 dark:border-zinc-900 border-b hover:bg-zinc-700/10 dark:hover:bg-zinc-700/50 transition cursor-pointer shadow-sm z-20"
        onClick={() => setIsServerDropdownOpen(!isServerDropdownOpen)}
      >
        <div className="flex items-center justify-between dark:text-zinc-100">
          <span className="truncate">{server?.name || "Server"}</span>
          <svg className={`w-4 h-4 opacity-70 shrink-0 transition-transform ${isServerDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
        {server?.inviteCode && (
          <div className="text-[10px] uppercase font-bold text-zinc-500 flex items-center gap-1 mt-0.5" onClick={(e) => e.stopPropagation()}>
            <span className="text-indigo-500 dark:text-indigo-400">Invite:</span> <span className="font-mono bg-black/5 dark:bg-black/20 px-1 rounded select-all cursor-text">{server.inviteCode}</span>
          </div>
        )}
      </div>

      {isServerDropdownOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsServerDropdownOpen(false)} />
          <div className="absolute top-[64px] left-2 right-2 bg-white dark:bg-[#111214] rounded-md shadow-lg border border-neutral-200 dark:border-zinc-800 p-2 z-40 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <button className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-indigo-500 hover:text-white rounded transition mb-1 text-indigo-500 dark:text-indigo-400" onClick={() => { setIsServerDropdownOpen(false); setIsServerSettingsOpen(true); }}>
              <span>Server Settings</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
            <div className="h-px bg-neutral-200 dark:bg-zinc-800 my-1" />
            <button className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-indigo-500 hover:text-white rounded transition mb-1" onClick={() => { setIsServerDropdownOpen(false); setIsCreateCategoryOpen(true); }}>
              <span>Create Category</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
            </button>
            <button className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-indigo-500 hover:text-white rounded transition" onClick={() => { setIsServerDropdownOpen(false); setIsChannelDialogOpen(true); }}>
              <span>Create Channel</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
            </button>
            {isServerOwner && (
              <>
                <div className="h-px bg-neutral-200 dark:bg-zinc-800 my-1" />
                <button className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-rose-500 hover:text-white rounded transition text-rose-500 dark:text-rose-400" onClick={() => { setIsServerDropdownOpen(false); setIsDeleteDialogOpen(true); }}>
                  <span>Delete Server</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </>
            )}
            <div className="h-px bg-neutral-200 dark:bg-zinc-800 my-1" />
            <button className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-rose-500 hover:text-white rounded transition text-rose-500 dark:text-rose-400" onClick={() => { setIsServerDropdownOpen(false); setIsLeaveDialogOpen(true); }}>
              <span>Leave Server</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </>
      )}

      <ServerSettingsModal serverId={activeServerId} isOpen={isServerSettingsOpen} onClose={() => setIsServerSettingsOpen(false)} />
      <ChannelSettingsModal channelId={settingsChannelId} serverId={activeServerId} isOpen={!!settingsChannelId} onClose={() => setSettingsChannelId(null)} />

      <AlertDialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
        <AlertDialogContent className="bg-white dark:bg-[#313338] text-black dark:text-white border-none">
          <AlertDialogHeader>
            <AlertDialogTitle>Leave '{server?.name}'</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave this server? You won't be able to rejoin unless you are re-invited.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void handleLeaveServer()}>
              Leave Server
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-white dark:bg-[#313338] text-black dark:text-white border-none">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete '{server?.name}'</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this server? This action cannot be undone. All channels, categories, and members will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void handleDeleteServer()}>
              Delete Server
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex-1 overflow-y-auto px-2 mt-4 space-y-[2px] hide-scrollbar">
        <Dialog open={isChannelDialogOpen} onOpenChange={setIsChannelDialogOpen}>
          <div className="flex items-center justify-between px-2 pb-2 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            <span>Text Channels</span>
            <DialogTrigger asChild>
              <button className="cursor-pointer hover:text-zinc-800 dark:hover:text-zinc-200 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              </button>
            </DialogTrigger>
          </div>

          <DialogContent className="bg-white dark:bg-[#313338] text-black dark:text-white border-none shadow-xl max-w-md p-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Create Channel</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-zinc-600 dark:text-zinc-400">Channel Name</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-zinc-500 text-lg">#</span>
                  <Input
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    className="pl-8 bg-zinc-100 dark:bg-[#1E1F22] border-none focus-visible:ring-indigo-500 text-zinc-900 dark:text-zinc-200"
                    placeholder="new-channel"
                  />
                </div>
              </div>
              <Button onClick={() => void handleCreateChannel()} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold transition">
                Create Channel
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Uncategorized Channels */}
        {channels.filter((channel) => !channel.categoryId).map((channel) => (
          <button
            type="button"
            key={channel._id}
            onClick={() => setActiveChannelId(channel._id)}
            className={`group px-2 py-2 rounded-md flex items-center gap-x-2 w-full hover:bg-zinc-700/10 dark:hover:bg-zinc-700/50 transition cursor-pointer text-left ${activeChannelId === channel._id ? "bg-zinc-700/20 dark:bg-zinc-700/50 text-indigo-600 dark:text-white" : "text-zinc-500 dark:text-zinc-400"}`}
          >
            <span className="opacity-70 text-lg">#</span>
            <p className={`line-clamp-1 font-semibold text-[15px] transition group-hover:text-zinc-600 dark:group-hover:text-zinc-300 flex-1 ${activeChannelId === channel._id ? "text-zinc-800 dark:text-zinc-100" : ""}`}>
              {channel.name}
            </p>
            {unreadCounts[channel._id] > 0 && activeChannelId !== channel._id && (
              <span className="min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-black bg-indigo-500 text-white rounded-full px-1">
                {unreadCounts[channel._id] > 99 ? "99+" : unreadCounts[channel._id]}
              </span>
            )}
            <button type="button" onClick={(e) => { e.stopPropagation(); setSettingsChannelId(channel._id); }} className="hidden group-hover:block group-focus-within:block ml-auto opacity-70 hover:opacity-100" aria-label="Channel settings">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
          </button>
        ))}

        {/* Categories */}
        {categories.map((category) => {
          const isCollapsed = collapsedCategories.has(category._id);
          const categoryChannels = channels.filter((channel) => channel.categoryId === category._id);
          return (
            <div key={category._id} className="mt-4">
              <div 
                className="flex items-center justify-between px-2 pb-1 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition"
                onClick={() => toggleCategory(category._id)}
              >
                <div className="flex items-center gap-1">
                  <svg className={`w-3 h-3 transition-transform ${isCollapsed ? "-rotate-90" : "rotate-0"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  <span>{category.name}</span>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsChannelDialogOpen(true); }}
                  className="hover:text-zinc-100 transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                </button>
              </div>
              
              {!isCollapsed && categoryChannels.map((channel) => (
                <button
                  type="button"
                  key={channel._id}
                  onClick={() => setActiveChannelId(channel._id)}
                  className={`group px-2 py-2 rounded-md flex items-center gap-x-2 w-full hover:bg-zinc-700/10 dark:hover:bg-zinc-700/50 transition cursor-pointer text-left ${activeChannelId === channel._id ? "bg-zinc-700/20 dark:bg-zinc-700/50 text-indigo-600 dark:text-white" : "text-zinc-500 dark:text-zinc-400"}`}
                >
                  <span className="opacity-70 text-lg">#</span>
                  <p className={`line-clamp-1 font-semibold text-[15px] transition group-hover:text-zinc-600 dark:group-hover:text-zinc-300 flex-1 ${activeChannelId === channel._id ? "text-zinc-800 dark:text-zinc-100" : ""}`}>
                    {channel.name}
                  </p>
                  {unreadCounts[channel._id] > 0 && activeChannelId !== channel._id && (
                    <span className="min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-black bg-indigo-500 text-white rounded-full px-1">
                      {unreadCounts[channel._id] > 99 ? "99+" : unreadCounts[channel._id]}
                    </span>
                  )}
                  <button type="button" onClick={(e) => { e.stopPropagation(); setSettingsChannelId(channel._id); }} className="hidden group-hover:block group-focus-within:block ml-auto opacity-70 hover:opacity-100" aria-label="Channel settings">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </button>
                </button>
              ))}
            </div>
          );
        })}

        <div className="mt-6 mb-2">
          <Dialog open={isEmojiDialogOpen} onOpenChange={setIsEmojiDialogOpen}>
            <div className="flex items-center justify-between px-2 pb-2 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              <span>Custom Emojis</span>
              <DialogTrigger asChild>
                <button className="cursor-pointer hover:text-zinc-800 dark:hover:text-zinc-200 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                </button>
              </DialogTrigger>
            </div>

            <DialogContent className="bg-white dark:bg-[#313338] text-black dark:text-white border-none shadow-xl max-w-md p-6">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">Upload Custom Emoji</DialogTitle>
              </DialogHeader>
                <div className="space-y-4 mt-2">
                  {emojiError && (
                    <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                      {emojiError}
                    </div>
                  )}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-zinc-600 dark:text-zinc-400">Emoji Name</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-zinc-500 text-lg">:</span>
                    <Input
                      value={newEmojiName}
                      onChange={(e) => setNewEmojiName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                      className="pl-6 pr-6 bg-zinc-100 dark:bg-[#1E1F22] border-none focus-visible:ring-emerald-500 text-zinc-900 dark:text-zinc-200"
                      placeholder="pepe_happy"
                    />
                    <span className="absolute right-3 top-2 text-zinc-500 text-lg">:</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-zinc-600 dark:text-zinc-400">Emoji File</label>
                  <Input
                    type="file"
                    accept="image/png, image/jpeg, image/gif, image/webp"
                    onChange={(e) => setEmojiFile(e.target.files?.[0] || null)}
                    className="bg-zinc-100 dark:bg-[#1E1F22] border-none text-zinc-900 dark:text-zinc-200"
                  />
                  <p className="text-xs text-zinc-500">Upload a PNG, JPEG, or GIF (for animated nitro emojis).</p>
                </div>
                <Button 
                  onClick={() => void handleUploadEmoji()} 
                  disabled={isUploadingEmoji || !newEmojiName || !emojiFile}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold transition"
                >
                  {isUploadingEmoji ? "Uploading..." : "Upload Emoji"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {serverEmojis.length > 0 && (
            <div className="space-y-2 px-2">
              {serverEmojis.map((emoji) => (
                <div
                  key={emoji._id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-600 dark:text-zinc-300"
                >
                  <img
                    alt=""
                    className="h-5 w-5 rounded-[2px] object-contain"
                    src={emoji.url ?? undefined}
                  />
                  <span className="font-medium">:{emoji.name}:</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Dialog open={isCreateCategoryOpen} onOpenChange={setIsCreateCategoryOpen}>
          <DialogContent className="bg-white dark:bg-[#313338] text-black dark:text-white border-none shadow-xl max-w-md p-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Create Category</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-zinc-600 dark:text-zinc-400">Category Name</label>
                <div className="relative">
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="bg-zinc-100 dark:bg-[#1E1F22] border-none focus-visible:ring-indigo-500 text-zinc-900 dark:text-zinc-200 uppercase"
                    placeholder="New Category"
                  />
                </div>
              </div>
              <Button onClick={() => void handleCreateCategory()} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold transition">
                Create Category
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
