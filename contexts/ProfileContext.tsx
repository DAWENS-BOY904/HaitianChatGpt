import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ProfileContextType {
  profilePhotoUrl: string;
  displayName: string;
  username: string;
  setProfilePhotoUrl: (url: string) => void;
  setDisplayName: (name: string) => void;
  setUsername: (username: string) => void;
  refreshKey: number;
  triggerRefresh: () => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  return (
    <ProfileContext.Provider value={{
      profilePhotoUrl,
      displayName,
      username,
      setProfilePhotoUrl,
      setDisplayName,
      setUsername,
      refreshKey,
      triggerRefresh,
    }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
