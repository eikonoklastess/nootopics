import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

interface ChannelSettingsModalProps {
  channelId: Id<"channels"> | null;
  serverId: Id<"servers"> | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ChannelSettingsModal({ channelId, serverId, isOpen, onClose }: ChannelSettingsModalProps) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<Id<"categories"> | "">("");

  const channels = useQuery(api.channels.list, serverId ? { serverId } : "skip") ?? [];
  const categories = useQuery(api.categories.list, serverId ? { serverId } : "skip") ?? [];
  
  const updateChannel = useMutation(api.channels.update);
  const removeChannel = useMutation(api.channels.remove);

  useEffect(() => {
    if (channelId) {
      const channel = channels.find(c => c._id === channelId);
      if (channel) {
        setName(channel.name);
        setCategoryId(channel.categoryId || "");
      }
    }
  }, [channelId, channels]);

  const handleUpdate = async () => {
    if (!channelId) return;
    await updateChannel({
      channelId,
      name: name || undefined,
      categoryId: categoryId || null,
    });
    onClose();
  };

  const handleDelete = async () => {
    if (!channelId) return;
    if (confirm("Are you sure you want to delete this channel? This action cannot be undone.")) {
      await removeChannel({ channelId });
      onClose();
    }
  };

  if (!channelId || !serverId) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white dark:bg-[#313338] text-black dark:text-white border-none shadow-xl max-w-md p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Channel Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 mt-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-zinc-500">Channel Name</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-zinc-500 text-lg">#</span>
              <Input 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                className="pl-8 bg-zinc-100 dark:bg-[#1E1F22] border-none text-zinc-900 dark:text-zinc-200"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-zinc-500">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value as any)}
              className="w-full bg-zinc-100 dark:bg-[#1E1F22] text-sm p-3 border-none rounded-md outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">No Category</option>
              {categories.map(cat => (
                <option key={cat._id} value={cat._id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter className="mt-6 flex justify-between sm:justify-between items-center w-full">
          <Button onClick={() => void handleDelete()} variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-500/10">
            Delete Channel
          </Button>
          <div className="flex gap-2">
            <Button onClick={onClose} variant="ghost">Cancel</Button>
            <Button onClick={() => void handleUpdate()} className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold">
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
