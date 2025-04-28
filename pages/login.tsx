import type { NextPage, GetServerSideProps } from 'next';
import { useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { getServerSession } from 'next-auth';
import { authOptions } from './api/auth/[...nextauth]';
import { useRouter } from 'next/router';
import Link from 'next/link';
import React from 'react';
import Image from 'next/image';
import Logo from 'logo.png'

const LoginPage: NextPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const router = useRouter();
  const { callbackUrl } = router.query;

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
      redirect: false, 
      email: email,
      password: password,
    });

    setLoading(false);

    if (result?.error) {
      setError(result.error);
      console.error('Login failed:', result.error);
    } else if (result?.ok) {
      console.log('Login successful, redirecting...');
      router.push((callbackUrl as string) || '/');
    } else {
      setError('An unknown error occurred during login.');
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen overflow-hidden bg-gray-100 px-4 py-12 sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:6rem_4rem]">
          <div className="absolute bottom-0 left-0 right-0 top-0 bg-[radial-gradient(circle_800px_at_100%_200px,#d5c5ff,transparent)]"></div>
      </div>

      <div className="relative max-w-md w-full space-y-8 bg-white p-8 sm:p-10 rounded-2xl shadow-xl border border-gray-200">
        <div className="text-center">
           <Image 
              src={Logo} 
              alt="Logo" 
              width={60}
              height={60}
              className="mx-auto mb-4"
          />
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            Sign in to CLEAR-D
          </h2>
           <p className="mt-2 text-sm text-gray-600">
            Access your health assessment portal.
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-md text-sm flex items-center space-x-2" role="alert">
              <span>{error}</span>
            </div>
          )}
          
          <input type="hidden" name="remember" defaultValue="true" />
          
          <div className="space-y-4">
            <div>
              <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 mb-1">
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
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm transition duration-150 ease-in-out"
                placeholder="you@example.com"
                disabled={loading}
              />
            </div>
            <div>
               <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
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
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm transition duration-150 ease-in-out"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-70 disabled:cursor-not-allowed transition duration-150 ease-in-out"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </>
               ) : ( 
                 'Sign in'
               )}
            </button>
          </div>
        </form>
        
        <div className="text-center text-sm text-gray-600 space-y-2">
             <p>
                Don&apos;t have an account?{' '}
                <Link href="/register" className="font-semibold text-purple-600 hover:text-purple-500 hover:underline ml-1 transition duration-150 ease-in-out">
                   Register here
                </Link>
             </p>

         </div>
      </div>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (session) {
    return {
      redirect: {
        destination: '/', 
        permanent: false,
      },
    };
  }
  return {
    props: {},
  };
};

export default LoginPage; 