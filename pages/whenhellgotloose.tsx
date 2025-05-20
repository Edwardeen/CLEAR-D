import React, { useEffect, useState, useCallback } from 'react';
import { GetServerSideProps, NextPage } from 'next';
import { getServerSession } from 'next-auth';
import { useSession } from 'next-auth/react';
import { authOptions } from './api/auth/[...nextauth]';
import { useRouter } from 'next/router';

// The official superadmin email - normalized to lowercase
const SUPERADMIN_EMAIL = "xxtremeindmc@gmail.com".toLowerCase();

// Additional helper function to verify superadmin
const isSuperAdminEmail = (email?: string | null): boolean => {
  // Handle undefined/null
  if (!email) return false;
  
  // Skip non-string email values
  if (typeof email !== 'string') {
    console.error(`Invalid email type: ${typeof email}`);
    return false;
  }
  
  // Check if it's a valid-looking email
  if (!email.includes('@')) {
    console.warn(`Email doesn't look like an email address: ${email}`);
    
    // Special case for the known admin user ID
    if (email === '682c8ed653f91f3f3f34f074') {
      console.log("Found admin ID as email, granting access");
      return true;
    }
    
    return false;
  }
  
  const normalizedEmail = email.toLowerCase().trim();
  const result = normalizedEmail === SUPERADMIN_EMAIL;
  console.log(`Checking superadmin email: "${normalizedEmail}" === "${SUPERADMIN_EMAIL}" => ${result}`);
  return result;
};

// Debug info type
interface DebugInfo {
  serverAuthChecked?: boolean;
  email?: string;
  superadminEmail?: string;
  isSuperAdmin?: boolean;
  sessionObject?: any;
  rawSessionData?: any;
  userId?: string; // Add userId for additional debugging
  rawToken?: string; // Add raw token information if accessible
  [key: string]: any; // Allow any other properties
}

interface WhenHellGotLoosePageProps {
  isSuperAdmin: boolean;
  initialServerOnlineStatus: boolean;
  debug?: DebugInfo; // For debugging info
}

const WhenHellGotLoosePage: NextPage<WhenHellGotLoosePageProps> = ({ 
  isSuperAdmin, 
  initialServerOnlineStatus,
  debug 
}) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isServerActuallyOnline, setIsServerActuallyOnline] = useState<boolean>(initialServerOnlineStatus);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [clientSideDebug, setClientSideDebug] = useState<any>({});

  // Debug current session
  useEffect(() => {
    // Check email client-side as well
    const clientEmail = session?.user?.email?.toLowerCase() || '';
    const clientIsSuperAdmin = clientEmail === SUPERADMIN_EMAIL;
    
    const debugInfo = {
      status,
      clientEmail,
      superadminEmail: SUPERADMIN_EMAIL,
      clientIsSuperAdmin,
      propIsSuperAdmin: isSuperAdmin,
      sessionExists: !!session,
      sessionUser: session?.user ? true : false
    };
    
    console.log("WhenHellGotLoose - Client Debug:", debugInfo);
    setClientSideDebug(debugInfo);
    
    // Don't redirect if client-side check passes (workaround if server-side fails)
    if (clientIsSuperAdmin) {
      console.log("Client-side superadmin check passed, allowing access");
    }
  }, [session, status, isSuperAdmin]);

  useEffect(() => {
    // Only redirect if client-side also confirms not a superadmin
    const clientEmail = session?.user?.email?.toLowerCase() || '';
    const clientIsSuperAdmin = clientEmail === SUPERADMIN_EMAIL;
    
    if (status === 'unauthenticated') {
      console.log("WhenHellGotLoose - Redirecting to 404 (unauthenticated)");
      router.push('/404');
    } else if (status === 'authenticated' && !isSuperAdmin && !clientIsSuperAdmin) {
      console.log("WhenHellGotLoose - Authenticated but not superadmin, redirecting to 404");
      router.push('/404');
    }
  }, [status, router, isSuperAdmin, session]);

  const fetchActualServerStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/admin/server-status');
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch server status: ${res.status}`);
      }
      const data = await res.json();
      setIsServerActuallyOnline(data.isServiceGloballyActive);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not fetch server status.');
      console.error('Server status fetch error:', err);
      // Don't change the current status if there's an error
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) { 
        fetchActualServerStatus();

        // Poll for updates every 30 seconds
        const intervalId = setInterval(() => {
          fetchActualServerStatus();
        }, 30000);

        return () => clearInterval(intervalId);
    }
  }, [isSuperAdmin, fetchActualServerStatus]);

  const handleToggleServerStatus = async () => {
    setIsLoadingStatus(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/admin/server-status/toggle', { method: 'POST' });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to toggle server status: ${res.status}`);
      }
      const data = await res.json();
      setIsServerActuallyOnline(data.isServiceGloballyActive);
      alert(data.message || `Server status toggled to ${data.isServiceGloballyActive ? 'ONLINE' : 'OFFLINE'}.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not toggle server status.');
      console.error('Server toggle error:', err);
      // Optionally, re-fetch status to be sure of current state
      fetchActualServerStatus();
    } finally {
      setIsLoadingStatus(false);
    }
  };

  if (status === 'loading') {
    return <div className="text-center p-10">Loading session...</div>;
  }

  // Allow access if either server-side or client-side confirms superadmin
  const clientEmail = session?.user?.email?.toLowerCase() || '';
  const clientIsSuperAdmin = clientEmail === SUPERADMIN_EMAIL;
  const hasAccess = isSuperAdmin || clientIsSuperAdmin;

  if (!session || !hasAccess) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-3xl font-bold text-red-600 mb-4">Checking Permissions...</h1>
        <p className="text-xl text-gray-700">
          {!session ? "No session found." : "Your account doesn't have access."}
        </p>
        <div className="mt-4 p-4 bg-gray-100 rounded text-left overflow-auto max-h-60">
          <pre className="text-xs">{JSON.stringify({ 
            status, 
            email: session?.user?.email,
            serverSideIsSuperAdmin: isSuperAdmin,
            clientSideIsSuperAdmin: clientIsSuperAdmin,
            serverDebug: debug,
            clientDebug: clientSideDebug
          }, null, 2)}</pre>
        </div>
        <button
          onClick={() => router.push('/')}
          className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Go to Homepage
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-2xl mx-auto bg-white shadow-xl rounded-lg p-8 border-t-4 border-red-600">
        <h1 className="text-4xl font-bold text-red-700 mb-6 text-center">Emergency Server Control</h1>
        
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded">
            <p><strong>Error:</strong> {errorMessage}</p>
            <button 
              onClick={fetchActualServerStatus}
              className="mt-2 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}

        <div className="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-lg font-medium text-gray-800 mb-2">
            Current Actual Server Status:
          </p>
          {isLoadingStatus ? (
            <p className='text-2xl font-bold text-gray-500'>Loading status...</p>
          ) : (
            <p className={`text-3xl font-bold ${isServerActuallyOnline ? 'text-green-600' : 'text-red-600'}`}>
              {isServerActuallyOnline ? 'ONLINE' : 'OFFLINE'}
            </p>
          )}
          <p className="text-sm text-gray-500 mt-1">
            When OFFLINE, the server API endpoints should reject requests with a 503 error.
          </p>
        </div>

        <div className="flex flex-col space-y-4">
          <button
            onClick={handleToggleServerStatus}
            disabled={isLoadingStatus}
            className={`w-full px-6 py-3 text-lg font-semibold rounded-md transition-colors
                        ${isLoadingStatus ? 'bg-gray-400 cursor-not-allowed' :
                          isServerActuallyOnline 
                            ? 'bg-yellow-500 hover:bg-yellow-600 text-white' 
                            : 'bg-green-500 hover:bg-green-600 text-white'}`}
          >
            {isLoadingStatus ? 'Processing...' : (isServerActuallyOnline ? 'Take Server OFFLINE' : 'Bring Server ONLINE')}
          </button>

          <button
            onClick={fetchActualServerStatus}
            disabled={isLoadingStatus}
            className="w-full px-6 py-3 text-lg font-semibold rounded-md transition-colors bg-blue-500 hover:bg-blue-600 text-white border border-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoadingStatus ? 'Refreshing...' : 'Refresh Server Status'}
          </button>
        </div>

        <div className="mt-10 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-xl font-semibold text-red-700 mb-2">Important Notes:</h2>
          <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
            <li>This toggle affects the <strong className="font-bold">actual backend server</strong> for all users.</li>
            <li>When OFFLINE, API endpoints will return a 503 Service Unavailable error (when middleware is enabled).</li>
            <li>Authentication routes (`/api/auth/...`) and these admin control routes remain accessible.</li>
            <li>Use with extreme caution. Accidental prolonged offline state can disrupt all users.</li>
            <li>Status is stored in database and persists between server restarts.</li>
            <li>If the server gets stuck OFFLINE and this panel is inaccessible, direct database intervention might be needed.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  // Get raw request cookie header
  const rawCookieHeader = context.req.headers.cookie || '';
  
  // Get session from next-auth
  const session = await getServerSession(context.req, context.res, authOptions);
  let initialServerOnlineStatus = true; // Default to true
  let debug: DebugInfo = { 
    serverAuthChecked: true,
    rawCookieHeader: rawCookieHeader.substring(0, 100) + (rawCookieHeader.length > 100 ? '...(truncated)' : ''),
    // Extract session token from cookies for debugging
    sessionToken: rawCookieHeader
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('next-auth.session-token='))
      ?.split('=')[1]?.substring(0, 30) + '...(truncated)',
    timestamp: new Date().toISOString()
  };

  console.log('Admin page access - getServerSideProps start:', { 
    path: context.resolvedUrl,
    hasSession: !!session, 
    userEmail: session?.user?.email || 'no-email',
    userId: session?.user?.id || 'no-id',
    timestamp: debug.timestamp
  });

  if (!session) {
    console.log("Server side: No session found for whenhellgotloose page", {
      rawCookieHeader: debug.rawCookieHeader,
      sessionToken: debug.sessionToken,
      timestamp: debug.timestamp
    });
    
    // Allow page to render with debug info instead of 404
    return {
      props: {
        isSuperAdmin: false,
        initialServerOnlineStatus,
        debug
      }
    };
  }

  // Extract all possible identification from session
  const userEmail = session.user?.email || '';
  const userId = session.user?.id || '';
  
  // Log raw session for debugging
  console.log("Raw session object:", JSON.stringify(session, null, 2));
  
  // Normalize email to lowercase for comparison
  const isSuperAdminUser = isSuperAdminEmail(userEmail);
  
  // Check for emergency admin access (development only)
  const hasEmergencyAccess = process.env.NODE_ENV === 'development' && 
      userId && userId === '64fae7e5dc37f36bba77fdd8';
  
  // Determine if access should be granted
  const accessGranted = isSuperAdminUser || hasEmergencyAccess;
  
  if (hasEmergencyAccess) {
    console.log("TEST MODE: Granting emergency admin access to user ID", userId);
  }
  
  debug = {
    ...debug,
    email: userEmail,
    userId,
    superadminEmail: SUPERADMIN_EMAIL,
    isSuperAdmin: isSuperAdminUser,
    hasEmergencyAccess,
    accessGranted,
    sessionObject: JSON.parse(JSON.stringify(session)),
    rawSessionData: JSON.stringify(session)
  };
  
  console.log("Server side: whenhellgotloose access check:", { 
    userEmail, 
    userId,
    isSuperAdmin: isSuperAdminUser,
    hasEmergencyAccess,
    accessGranted,
    sessionExists: !!session,
    hasUserObject: !!session?.user,
    hasEmail: !!session?.user?.email,
    timestamp: debug.timestamp
  });
  
  // If not super admin, also return 404
  if (!accessGranted) {
    console.log("Server side: Not superadmin, returning 404 for whenhellgotloose page");
    // Allow access with just debug info in dev mode
    if (process.env.NODE_ENV === 'development') {
      return {
        props: {
          isSuperAdmin: false,
          initialServerOnlineStatus,
          debug
        }
      };
    }
    return {
      notFound: true,
    };
  }

  if (accessGranted) {
    try {
      // Use API route approach that handles things defensively
      const serverUrl = process.env.NEXTAUTH_URL || `http://${context.req.headers.host}`;
      const res = await fetch(`${serverUrl}/api/admin/server-status`, {
        headers: {
          cookie: context.req.headers.cookie || '',
        },
      });
      
      if (res.ok) {
        const data = await res.json();
        initialServerOnlineStatus = data.isServiceGloballyActive;
      }
    } catch (error) {
      console.error("Error fetching initial server status:", error);
      // Keep default true to avoid locking out if fetch fails during SSR
    }
  }

  // Always include debug info in development
  if (process.env.NODE_ENV === 'development') {
    return {
      props: {
        isSuperAdmin: accessGranted,
        initialServerOnlineStatus,
        debug
      },
    };
  }

  return {
    props: {
      isSuperAdmin: accessGranted,
      initialServerOnlineStatus,
    },
  };
};

export default WhenHellGotLoosePage; 