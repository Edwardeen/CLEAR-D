import type { NextPage, GetServerSideProps } from 'next';
import { useSession } from 'next-auth/react';
import { getServerSession } from 'next-auth';
import { authOptions } from './api/auth/[...nextauth]';
import { useRouter } from 'next/router';
import AssessmentForm from '../components/AssessmentForm';
import GlobalStats from '../components/GlobalStats';
import React, { useEffect } from 'react';

const HomePage: NextPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Client-side check for redirecting unauthenticated users
  useEffect(() => {
      if (status === 'unauthenticated') {
          router.push('/login');
      }
  }, [status, router]);

  // Handle loading state
  if (status === 'loading') {
    return (
        <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
            <p className="text-gray-500 text-lg">Loading session...</p>
             {/* Optional: Add a spinner */}
        </div>
    );
  }

  // Render form if authenticated
  if (session) {
    return (
        <div className="container mx-auto px-4 py-6">
            {/* Welcome message with global stats */}
            <div className="text-center mb-6">
                <h1 className="text-2xl font-semibold mb-2">Welcome, {session.user?.name || session.user?.email}!</h1>
                <p className="text-gray-600">Complete the assessment below to evaluate your health risks</p>
            </div>
            
            {/* Display global stats before the form */}
            {/* <GlobalStats /> */}
            
            {/* Assessment form */}
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
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session) {
    return {
      redirect: {
        destination: '/login', // Redirect destination
        permanent: false, // Not a permanent redirect
      },
    };
  }

  // Make session serializable by converting undefined values to null
  const serializableSession = JSON.parse(JSON.stringify(session));

  // If session exists, pass it as a prop (optional, useSession hook handles it client-side too)
  return {
    props: { session: serializableSession },
  };
};

export default HomePage; 