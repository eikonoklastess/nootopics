import { useMutation } from 'convex/react';
import { useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { api } from '../../../convex/_generated/api';

export function UserSync({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const storeUser = useMutation(api.users.storeUser);

  useEffect(() => {
    if (!user) {
      return;
    }

    void storeUser({
      name: user.fullName || user.username || 'Unknown',
      imageUrl: user.imageUrl,
    }).catch(console.error);
  }, [storeUser, user?.id, user?.updatedAt, user?.fullName, user?.username, user?.imageUrl]);

  return <>{children}</>;
}
