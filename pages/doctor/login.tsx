import type { NextPage, GetServerSideProps } from 'next';
import { useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]'; // Adjusted path
import { useRouter } from 'next/router';
import Link from 'next/link';
import React from 'react';

const OfficialLoginPage: NextPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const router = useRouter();
  // Official login typically redirects to the dashboard
  const defaultCallbackUrl = '/doctor/dashboard'; 
  const { callbackUrl = defaultCallbackUrl } = router.query; 

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!email || !password) {
      setError('Please enter both email and password.');
      setLoading(false);
      return;
    }

    const result = await signIn('credentials', {
      redirect: false, // Prevent NextAuth from redirecting automatically
      email: email,
      password: password,
      expectedRole: 'doctor'
    });

    setLoading(false);

    if (result?.error) {
      // Error from authorize (e.g., wrong password, role mismatch) will be shown
      setError(result.error);
      console.error('Official login failed:', result.error);
    } else if (result?.ok) {
      // Login successful AND role check passed, redirect manually
      console.log('Official login successful, redirecting...');
      router.push(callbackUrl as string);
    } else {
      setError('An unknown error occurred during login.');
    }
  };

  return (
    // Slightly different styling/text for official login
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)] bg-gradient-to-br from-cyan-50 via-white to-blue-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-xl">
        <div>
          <h2 className="mt-6 text-center text-3xl font-semibold text-gray-900">
            Healthcare Official Portal
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Access your dashboard
          </p>
        </div>
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-800 px-4 py-3 rounded text-sm" role="alert">
              {error}
            </div>
          )}
          <input type="hidden" name="remember" defaultValue="true" />
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm transition duration-150 ease-in-out"
                placeholder="Official Email address"
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm transition duration-150 ease-in-out"
                placeholder="Password"
                disabled={loading}
              />
            </div>
          </div>

          {/* Removed Forgot Password for simplicity, can be added back */}
          {/* <div className="flex items-center justify-end">
            <div className="text-sm">
              <Link href="/forgot-password" 
                    className="font-medium text-blue-600 hover:text-blue-500 transition duration-150 ease-in-out">
                Forgot your password?
              </Link>
            </div>
          </div> */}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition duration-150 ease-in-out"
            >
              {loading ? 'Signing in...' : 'Sign in as Official'}
            </button>
          </div>
        </form>
         <p className="mt-6 text-center text-sm text-gray-600">
            Not a Healthcare Official?{' '}
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500 transition duration-150 ease-in-out">
               User Login
            </Link>
         </p>
      </div>
    </div>
  );
};

// Prevent authenticated users (especially officials) from accessing this login page
export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (session) {
    // If user is logged in, redirect them away
    const destination = session.user?.role === 'doctor' ? '/doctor/dashboard' : '/'; // Redirect officials to dash, others to home
    return {
      redirect: {
        destination: destination, 
        permanent: false,
      },
    };
  }

  // If not logged in, allow access to the official login page
  return {
    props: {},
  };
};

export default OfficialLoginPage; 