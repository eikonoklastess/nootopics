import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";

type DesktopNotificationSetting = "ALL" | "MENTIONS" | "NONE";

export function NextToUserButtonSettings() {
  const currentUser = useQuery(api.users.current);
  const updateSettings = useMutation(api.users.updateSettings);
  const [open, setOpen] = useState(false);

  const currentSetting: DesktopNotificationSetting =
    currentUser?.notificationSettings?.desktop ?? "ALL";

  const handleChange = async (value: DesktopNotificationSetting) => {
    await updateSettings({
      notificationSettings: {
        desktop: value,
      },
    });
  };

  return (
    <>
      <button
        className="mt-3 rounded-full bg-white p-2 text-zinc-600 shadow-sm transition hover:text-zinc-900 dark:bg-[#313338] dark:text-zinc-300 dark:hover:text-white"
        onClick={() => setOpen(true)}
        title="Notification settings"
        type="button"
      >
        ⚙
      </button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-w-md bg-white text-black dark:bg-[#313338] dark:text-white">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <h4 className="font-semibold">Notifications</h4>
            <label className="block text-sm text-zinc-500">Desktop notifications</label>
            <select
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-[#1E1F22]"
              onChange={(event) =>
                void handleChange(event.target.value as DesktopNotificationSetting)
              }
              value={currentSetting}
            >
              <option value="ALL">All Messages</option>
              <option value="MENTIONS">Mentions Only</option>
              <option value="NONE">Nothing</option>
            </select>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
