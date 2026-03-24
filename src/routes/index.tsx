import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { createFileRoute } from '@tanstack/react-router';
import { ChatPage } from '../features/chat/ChatPage';
import { SignedOutSplash } from '../features/chat/SignedOutSplash';
import { UserSync } from '../features/chat/UserSync';

export const Route = createFileRoute('/')({
  component: HomeRoute,
});

function HomeRoute() {
  return (
    <>
      <SignedOut>
        <SignedOutSplash />
      </SignedOut>
      <SignedIn>
        <UserSync>
          <ChatPage />
        </UserSync>
      </SignedIn>
    </>
  );
}
