import type { NextPage, GetServerSideProps } from 'next';
import { useState, FormEvent } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import React from 'react';

const LoginPage: NextPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const router = useRouter();
  const { callbackUrl } = router.query; // Get callbackUrl from query params if present

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
    });

    setLoading(false);

    if (result?.error) {
      // Handle specific errors returned from the authorize function
      setError(result.error);
      console.error('Login failed:', result.error);
    } else if (result?.ok) {
      // Login successful, redirect manually
      console.log('Login successful, redirecting...');
      // Redirect to callbackUrl if provided, otherwise to home page
      router.push((callbackUrl as string) || '/');
    } else {
      // Handle unexpected cases
      setError('An unknown error occurred during login.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)] bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-xl">
        <div>
          <h2 className="mt-6 text-center text-3xl font-semibold text-gray-900">
            Sign in to your account
          </h2>
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
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm transition duration-150 ease-in-out"
                placeholder="Email address"
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
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm transition duration-150 ease-in-out"
                placeholder="Password"
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              {/* Placeholder for Remember me if needed */}
            </div>

            <div className="text-sm">
              <Link href="/forgot-password" // Assuming you have a forgot password page route
                    className="font-medium text-purple-600 hover:text-purple-500 transition duration-150 ease-in-out">
                Forgot your password?
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-60 disabled:cursor-not-allowed transition duration-150 ease-in-out"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                {/* Optional: Lock icon or similar */}
              </span>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
         <p className="mt-6 text-center text-sm text-gray-600">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-medium text-purple-600 hover:text-purple-500 transition duration-150 ease-in-out">
               Register here
            </Link>
         </p>
      </div>
    </div>
  );
};

// Prevent authenticated users from accessing the login page
export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);

  if (session) {
    // If user is already logged in, redirect them away from login page
    return {
      redirect: {
        destination: '/', // Redirect to home page or dashboard
        permanent: false,
      },
    };
  }

  // If not logged in, allow access to the login page
  return {
    props: {}, // No specific props needed for login page itself
  };
};

export default LoginPage; 