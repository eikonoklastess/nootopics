interface ThreadCreatorPanelProps {
  firstMessage: string;
  isOpen: boolean;
  name: string;
  onClose: () => void;
  onFirstMessageChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}

export function ThreadCreatorPanel({
  firstMessage,
  isOpen,
  name,
  onClose,
  onFirstMessageChange,
  onNameChange,
  onSubmit,
}: ThreadCreatorPanelProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="absolute top-0 right-0 bottom-0 w-96 bg-white dark:bg-[#2B2D31] border-l border-zinc-200 dark:border-zinc-700 flex flex-col z-40 shadow-2xl">
      <div className="h-12 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span className="font-bold text-sm">New Thread</span>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition text-zinc-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col flex-1 p-4 gap-4">
        <div>
          <label className="text-xs font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1.5 block">
            Thread Name
          </label>
          <input
            autoFocus
            type="text"
            className="w-full bg-[#EBEDEF] dark:bg-[#383A40] rounded-lg px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none border border-transparent focus:border-indigo-500 transition placeholder-zinc-400"
            placeholder="e.g. Design Discussion"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
          />
        </div>
        <div className="flex-1 flex flex-col">
          <label className="text-xs font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1.5 block">
            First Message
          </label>
          <textarea
            className="w-full flex-1 bg-[#EBEDEF] dark:bg-[#383A40] rounded-lg px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none border border-transparent focus:border-indigo-500 transition placeholder-zinc-400 resize-none min-h-[100px]"
            placeholder="Start the conversation..."
            value={firstMessage}
            onChange={(event) => onFirstMessageChange(event.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={!name.trim() || !firstMessage.trim()}
          className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-2.5 text-sm transition"
        >
          Create Thread
        </button>
      </form>
    </div>
  );
}
