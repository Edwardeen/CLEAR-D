import type { NextPage, GetServerSideProps } from 'next';
import { useSession, getSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import AssessmentForm from '../components/AssessmentForm';
import React, { useEffect } from 'react';

const HomePage: NextPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Handle loading state
  if (status === 'loading') {
    return (
        <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
            <p className="text-gray-500 text-lg">Loading session...</p>
             {/* Optional: Add a spinner */}
        </div>
    );
  }

  // If not authenticated, redirect handled by getServerSideProps
  // Client-side check as fallback or if direct access attempted after SSR
  useEffect(() => {
      if (status === 'unauthenticated') {
          router.push('/login');
      }
  }, [status, router]);

  // Render form if authenticated
  if (session) {
    return (
        <div>
             {/* Optional: Welcome message */}
             {/* <h1 className="text-xl font-semibold mb-4">Welcome, {session.user?.name || session.user?.email}!</h1> */} 
            <AssessmentForm />
        </div>
    );
  }

  // Fallback while redirecting or if logic fails
  return (
     <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
            <p className="text-gray-500 text-lg">Redirecting to login...</p>
        </div>
  );
};

// Protect the page: Redirect unauthenticated users to login
export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);

  if (!session) {
    return {
      redirect: {
        destination: '/login', // Redirect destination
        permanent: false, // Not a permanent redirect
      },
    };
  }

  // If session exists, pass it as a prop (optional, useSession hook handles it client-side too)
  return {
    props: { session },
  };
};

export default HomePage; 