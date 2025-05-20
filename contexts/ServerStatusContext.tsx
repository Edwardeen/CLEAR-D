import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';

interface ServerStatusContextType {
  isServerOnline: boolean;
  toggleServerStatus: () => void;
  forceServerOnline: () => void; // Added for safety
}

const ServerStatusContext = createContext<ServerStatusContextType | undefined>(undefined);

export const ServerStatusProvider = ({ children }: { children: ReactNode }) => {
  const [isServerOnline, setIsServerOnline] = useState(true);

  const toggleServerStatus = useCallback(() => {
    setIsServerOnline(prev => !prev);
    console.warn(`SERVER CONNECTION SIMULATION TOGGLED: ${!isServerOnline ? 'ONLINE' : 'OFFLINE'}`);
  }, [isServerOnline]);

  const forceServerOnline = useCallback(() => {
    setIsServerOnline(true);
    console.warn('SERVER CONNECTION SIMULATION: Forced ONLINE');
  }, []);

  return (
    <ServerStatusContext.Provider value={{ isServerOnline, toggleServerStatus, forceServerOnline }}>
      {children}
    </ServerStatusContext.Provider>
  );
};

export const useServerStatus = () => {
  const context = useContext(ServerStatusContext);
  if (context === undefined) {
    throw new Error('useServerStatus must be used within a ServerStatusProvider');
  }
  return context;
}; 