const pulse = "animate-pulse bg-zinc-200 dark:bg-zinc-700";
const bar = `${pulse} rounded`;

function MessageSkeletonRow() {
  return (
    <div className="flex gap-3">
      <div className={`h-10 w-10 shrink-0 rounded-full ${pulse}`} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className={`h-4 w-28 ${bar}`} />
        <div className={`h-4 w-full max-w-xl ${bar}`} />
      </div>
    </div>
  );
}

export function MessageSkeleton() {
  return (
    <div className="flex flex-col-reverse gap-y-6 px-6 py-4">
      {Array.from({ length: 6 }, (_, i) => (
        <MessageSkeletonRow key={i} />
      ))}
    </div>
  );
}

export function ChannelListSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="flex h-[60px] items-center px-3">
        <div className={`h-5 w-36 ${bar}`} />
      </div>
      <div className="flex flex-col gap-1 px-2 py-1">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex h-8 items-center gap-2 px-2">
            <div className={`h-4 w-4 shrink-0 ${bar}`} />
            <div className={`h-4 flex-1 max-w-[10rem] ${bar}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ServerHeaderSkeleton() {
  return (
    <div className="flex h-12 items-center px-4">
      <div className={`h-3 w-24 ${bar}`} />
    </div>
  );
}
