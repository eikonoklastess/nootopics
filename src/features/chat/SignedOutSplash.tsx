import { SignInButton } from '@clerk/clerk-react';

export function SignedOutSplash() {
  return (
    <div className="flex h-full w-full items-center justify-center flex-col gap-6 bg-[#F2F3F5] dark:bg-[#313338]">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-black text-indigo-500">Nootopics</h1>
        <p className="text-zinc-500 dark:text-zinc-400">Your place to talk.</p>
      </div>
      <SignInButton mode="modal">
        <button className="bg-indigo-500 hover:bg-indigo-600 outline-none text-white font-bold py-3 px-8 rounded-full transition shadow-lg hover:shadow-xl hover:-translate-y-0.5">
          Log In to Chat
        </button>
      </SignInButton>
    </div>
  );
}
