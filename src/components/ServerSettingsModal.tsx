import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

interface ServerSettingsModalProps {
  serverId: Id<"servers"> | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ServerSettingsModal({ serverId, isOpen, onClose }: ServerSettingsModalProps) {
  const isMemberRole = (value: string): value is "ADMIN" | "MODERATOR" | "GUEST" =>
    value === "ADMIN" || value === "MODERATOR" || value === "GUEST";

  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "ROLES">("OVERVIEW");
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const server = useQuery(api.servers.get, serverId ? { serverId } : "skip");
  const members = useQuery(api.users.listByServer, serverId ? { serverId } : "skip");
  
  const updateServer = useMutation(api.servers.update);
  const updateMemberRole = useMutation(api.servers.updateMemberRole);

  useEffect(() => {
    if (server) {
      setName(server.name);
      setImageUrl(server.imageUrl || "");
    }
  }, [server]);

  const handleUpdate = async () => {
    if (!serverId) return;
    await updateServer({
      serverId,
      name: name || undefined,
      imageUrl: imageUrl || undefined,
    });
    onClose();
  };

  if (!serverId || !server) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white dark:bg-[#313338] text-black dark:text-white border-none shadow-xl max-w-2xl p-0 flex h-[500px]">
        {/* Sidebar */}
        <div className="w-48 bg-[#F2F3F5] dark:bg-[#2B2D31] p-4 flex flex-col gap-2 rounded-l-lg">
          <h2 className="text-xs font-bold uppercase text-zinc-500 mb-2 px-2 truncate">{server.name}</h2>
          <Button
            variant="ghost"
            className={`w-full justify-start ${activeTab === "OVERVIEW" ? "bg-zinc-200 dark:bg-zinc-700" : ""}`}
            onClick={() => setActiveTab("OVERVIEW")}
          >
            Overview
          </Button>
          <Button
            variant="ghost"
            className={`w-full justify-start ${activeTab === "ROLES" ? "bg-zinc-200 dark:bg-zinc-700" : ""}`}
            onClick={() => setActiveTab("ROLES")}
          >
            Roles
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeTab === "OVERVIEW" && (
            <div className="space-y-6">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Server Overview</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-zinc-500">Server Name</label>
                  <Input 
                    value={name} 
                    onChange={(e) => setName(e.target.value)}
                    className="bg-zinc-100 dark:bg-[#1E1F22] border-none text-zinc-900 dark:text-zinc-200"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-zinc-500">Image URL</label>
                  <Input 
                    value={imageUrl} 
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="bg-zinc-100 dark:bg-[#1E1F22] border-none text-zinc-900 dark:text-zinc-200"
                    placeholder="https://example.com/image.png"
                  />
                </div>
              </div>
              <Button onClick={() => void handleUpdate()} className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold">
                Save Changes
              </Button>
            </div>
          )}

          {activeTab === "ROLES" && (
            <div className="space-y-6">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Manage Roles</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                {members?.map(member => {
                  if (!member) return null;
                  return (
                    <div key={member._id} className="flex items-center justify-between p-3 bg-zinc-100 dark:bg-[#2B2D31] rounded-md">
                    <div className="flex items-center gap-3">
                      <img src={member.imageUrl} className="w-8 h-8 rounded-full" alt={member.name} />
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{member.name}</span>
                    </div>
                    {member.memberId && member.role !== "ADMIN" ? (
                      <select 
                        value={member.role}
                        onChange={(e) => {
                          if (!isMemberRole(e.target.value)) {
                            return;
                          }
                          void updateMemberRole({
                            serverId,
                            memberId: member.memberId as Id<"members">,
                            role: e.target.value,
                          });
                        }}
                        className="bg-white dark:bg-[#1E1F22] text-sm p-1.5 border-none rounded outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="MODERATOR">Moderator</option>
                        <option value="GUEST">Guest</option>
                      </select>
                    ) : (
                      <span className="text-xs font-bold text-zinc-500 px-2 py-1 bg-zinc-200 dark:bg-zinc-800 rounded">{member.role}</span>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
