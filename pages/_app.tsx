import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { SessionProvider } from 'next-auth/react';
import Layout from '../components/Layout';
import React from 'react';
import { useRouter } from 'next/router';

function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  const router = useRouter();
  const isAuthPage = router.pathname === '/login' || router.pathname === '/register' || router.pathname === '/doctor/login';

  return (
    <SessionProvider 
      session={session}
      // Very long session refetch interval (4 hours) to reduce API calls
      refetchInterval={14400}
      // Don't refetch on window focus to prevent excessive API calls
      refetchOnWindowFocus={false}
      // Minimize session updates
      refetchWhenOffline={false}
    >
      {isAuthPage ? (
        <Component {...pageProps} />
      ) : (
        <Layout>
          <Component {...pageProps} />
        </Layout>
      )}
    </SessionProvider>
  );
}

export default MyApp;