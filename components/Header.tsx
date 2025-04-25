import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';

const Header = () => {
  const { data: session, status } = useSession();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut({ redirect: false, callbackUrl: '/login' });
    router.push('/login'); // Force redirect client-side
  };

  const isLoading = status === 'loading';

  return (
    <header className="bg-blue-100 p-4 shadow-md sticky top-0 z-50">
      <nav className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-2">
          {/* Placeholder Logo */}
          <Link href="/">
            <img src="/placeholder.png" alt="Logo" className="h-10 sm:h-12" />
          </Link>
          <Link href="/" className="text-xl sm:text-2xl font-bold text-blue-800 hover:text-blue-600 transition-colors">
              Health Risk Assessment
          </Link>
        </div>

        {/* Navigation Links */}
        <ul className="flex items-center space-x-3 sm:space-x-4 text-sm sm:text-base">
          {!isLoading && (
            <>
              <li>
                <Link href="/" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">
                  Home
                </Link>
              </li>

              {session ? (
                <>
                  <li>
                    <Link href="/profile" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">
                      Profile
                    </Link>
                  </li>
                  {session.user?.role === 'doctor' && (
                    <li>
                      <Link href="/doctor/dashboard" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">
                        Dashboard
                      </Link>
                    </li>
                  )}
                  <li>
                    <button
                      onClick={handleLogout}
                      className="bg-red-500 hover:bg-red-600 text-white font-bold py-1.5 px-3 rounded text-xs sm:text-sm transition-colors"
                    >
                      Logout
                    </button>
                  </li>
                  <li className="text-gray-600 text-xs sm:text-sm hidden sm:block">
                    ({session.user?.name || session.user?.email})
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link href="/login" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">
                      Login
                    </Link>
                  </li>
                  <li>
                    <Link href="/register" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-3 rounded text-xs sm:text-sm transition-colors">
                      Register
                    </Link>
                  </li>
                </>
              )}
            </>
          )}
          {isLoading && (
              <li className="text-gray-500 text-sm">Loading...</li>
          )}
        </ul>
      </nav>
    </header>
  );
};

export default Header; 