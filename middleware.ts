import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Path patterns that should always be accessible regardless of server status
const ALWAYS_ACCESSIBLE_PATHS = [
  '/api/auth',                // Authentication routes
  '/api/admin/server-status', // Admin control routes
  '/api/emergency-restore',   // Emergency restore endpoint
  '/api/internal/status'      // Allow middleware to access its own status check
];

// Create a cache object to store server status
let serverStatusCache = {
  isOnline: true,
  lastChecked: 0,
  // Add a flag to indicate if the initial fetch failed, to prevent constant retries on a misconfigured secret
  initialFetchFailedDueToConfig: false 
};

const CACHE_DURATION_MS = 10000; // 10 seconds
const INTERNAL_STATUS_SECRET_KEY = process.env.INTERNAL_STATUS_SECRET_KEY;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if path should always be accessible
  const isAlwaysAccessible = ALWAYS_ACCESSIBLE_PATHS.some(path => pathname.startsWith(path));
  if (isAlwaysAccessible) {
    return NextResponse.next();
  }

  // Only check server status for API routes
  if (pathname.startsWith('/api/')) {
    try {
      const now = Date.now();
      if (now - serverStatusCache.lastChecked > CACHE_DURATION_MS && !serverStatusCache.initialFetchFailedDueToConfig) {
        if (!INTERNAL_STATUS_SECRET_KEY) {
          console.error('CRITICAL: INTERNAL_STATUS_SECRET_KEY is not defined in middleware environment. Server status check will not work.');
          // If the secret isn't even defined in the middleware, there's no point trying to fetch.
          // Default to online to avoid blocking the site due to misconfiguration.
          // Mark as failed to prevent repeated log spamming.
          serverStatusCache.isOnline = true; 
          serverStatusCache.lastChecked = now;
          serverStatusCache.initialFetchFailedDueToConfig = true; // Prevent further attempts if secret is missing
          return NextResponse.next(); // Allow access as a fail-safe
        }

        const response = await fetch(`${request.nextUrl.origin}/api/internal/status`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-status-secret': INTERNAL_STATUS_SECRET_KEY,
          },
          // Add a timeout to the fetch call itself
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });

        if (response.ok) {
          const data = await response.json();
          serverStatusCache.isOnline = data.isServiceGloballyActive;
          serverStatusCache.lastChecked = now;
          serverStatusCache.initialFetchFailedDueToConfig = false; // Reset on successful fetch
          console.log(`Middleware: Updated server status cache via internal API. Server is ${serverStatusCache.isOnline ? 'ONLINE' : 'OFFLINE'}`);
        } else {
          const errorText = await response.text();
          console.warn(`Middleware: Could not fetch server status from internal API. Status: ${response.status}, Body: ${errorText}. Using cached value.`);
          // If fetch fails (e.g. 500 from API, or 403 due to wrong secret), keep using cached value.
          // This prevents the site from going down if the internal API has a temporary glitch or misconfiguration.
          // The API endpoint itself defaults to 'online' on DB error, so that helps.
        }
      }
      
      // Check if server is offline based on cache
      if (!serverStatusCache.isOnline) {
        console.log(`Middleware: Blocked access to ${pathname} - Server is OFFLINE (cached)`);
        return new NextResponse(
          JSON.stringify({ 
            error: 'Service Unavailable', 
            message: 'Server is temporarily offline for maintenance' 
          }),
          { 
            status: 503, 
            headers: { 'Content-Type': 'application/json' } 
          }
        );
      }
    } catch (error) {
      // This catch block handles errors like network issues or AbortSignal timeout
      console.error('Middleware error during server status check process:', error);
      // Default to allowing the request through if the status check process itself fails unexpectedly.
      // This is a fail-safe to prevent the entire site from being inaccessible due to a bug in the middleware status check.
    }
  }

  return NextResponse.next();
}

// Specify a matcher to only run the middleware on API routes
export const config = {
  matcher: '/api/:path*',
}; 