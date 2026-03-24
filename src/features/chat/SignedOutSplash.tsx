import type { ReactNode } from 'react';
import { SignInButton } from '@clerk/clerk-react';

const features = [
  {
    title: 'Real-Time Chat',
    description: 'Lightning-fast messaging with typing indicators',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
      />
    ),
  },
  {
    title: 'Servers & Channels',
    description:
      'Organize your community with servers, categories, and channels',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
      />
    ),
  },
  {
    title: 'Threads & Pins',
    description:
      'Keep conversations organized with threads and pin important messages',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V4.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
      />
    ),
  },
  {
    title: 'Direct Messages',
    description:
      'Private 1:1 conversations with presence indicators',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
      />
    ),
  },
  {
    title: 'File Sharing',
    description:
      'Drag & drop images, videos, and files seamlessly',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    ),
  },
  {
    title: 'Custom Emojis',
    description:
      'Upload and use custom emojis across your server',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
      />
    ),
  },
] as const;

function FeatureIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-6 w-6 shrink-0 text-indigo-500 dark:text-indigo-400"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function SignedOutSplash() {
  return (
    <div className="h-full w-full overflow-y-auto bg-[#F2F3F5] dark:bg-[#313338]">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <section className="flex flex-col items-center justify-center py-16 text-center sm:py-20">
          <h1 className="text-5xl font-black text-indigo-500 sm:text-6xl">
            Nootopics
          </h1>
          <p className="mt-4 max-w-xl text-zinc-500 dark:text-zinc-400">
            Your place to talk. Real-time messaging for communities.
          </p>
          <SignInButton mode="modal">
            <button
              type="button"
              className="mt-8 rounded-full bg-indigo-500 px-8 py-3 font-bold text-white shadow-lg outline-none transition hover:bg-indigo-600 hover:shadow-xl hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#313338]"
            >
              Get Started
            </button>
          </SignInButton>
        </section>

        {/* Feature grid */}
        <section className="py-16 sm:py-20">
          <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <li
                key={f.title}
                className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-[#2B2D31]"
              >
                <div className="flex flex-col gap-3">
                  <FeatureIcon>{f.icon}</FeatureIcon>
                  <h3 className="font-bold text-zinc-800 dark:text-zinc-100">
                    {f.title}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {f.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Bottom CTA */}
        <section className="flex flex-col items-center py-16 text-center sm:py-20">
          <h2 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100 sm:text-3xl">
            Ready to start chatting?
          </h2>
          <SignInButton mode="modal">
            <button
              type="button"
              className="mt-6 rounded-full bg-indigo-500 px-8 py-3 font-bold text-white shadow-lg outline-none transition hover:bg-indigo-600 hover:shadow-xl hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#313338]"
            >
              Join Now
            </button>
          </SignInButton>
        </section>
      </div>
    </div>
  );
}
