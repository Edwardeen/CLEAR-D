import type { NextPage, GetServerSideProps } from 'next';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { getServerSession } from 'next-auth';
import { authOptions } from './api/auth/[...nextauth]';
import { ICounsellor } from '@/models/Counsellor'; // Assuming ICounsellor interface

interface CounsellorListingPageProps {
  // Props if initial data is fetched server-side (optional)
}

const CounsellorListingPage: NextPage<CounsellorListingPageProps> = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [counsellors, setCounsellors] = useState<ICounsellor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/counsellor-listing');
    }
    if (status === 'authenticated') {
      fetchCounsellors();
    }
  }, [status, router]);

  const fetchCounsellors = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/counsellors');
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to fetch counsellors');
      }
      const data = await res.json();
      setCounsellors(data.counsellors || []);
    } catch (err: any) {
      setError(err.message);
      setCounsellors([]);
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading') {
    return <div className="text-center p-10">Loading counsellor listing...</div>;
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-8 text-center">Counsellor Listing</h1>

      {/* TODO: Add filtering options if needed in the future (e.g., by specialty) */}

      {isLoading && <p className="text-center text-gray-600">Loading counsellors...</p>}
      {error && <p className="text-center text-red-500">Error: {error}</p>}
      
      {!isLoading && !error && counsellors.length === 0 && (
        <p className="text-center text-gray-600">No counsellors available at the moment.</p>
      )}

      {!isLoading && !error && counsellors.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {counsellors.map(counsellor => (
            <div key={String(counsellor._id)} className="bg-white p-6 rounded-lg shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
              <h2 className="text-xl font-semibold text-gray-800 mb-2">{counsellor.name}</h2>
              <p className="text-md text-indigo-600 font-medium mb-2">{counsellor.specialty}</p>
              <p className="text-sm text-gray-600 mb-1">
                <a href={`tel:${counsellor.phone}`} className="hover:underline">{counsellor.phone}</a>
              </p>
              <p className="text-sm text-gray-600 mb-1">
                <a href={`mailto:${counsellor.email}`} className="hover:underline">{counsellor.email}</a>
              </p>
              {/* Add more details or a link to a detailed view if available */}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const getServerSideProps: GetServerSideProps<CounsellorListingPageProps> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session) {
    return {
      redirect: {
        destination: '/login?callbackUrl=/counsellor-listing',
        permanent: false,
      },
    };
  }
  // Data fetching is done client-side in this example
  return { props: {} };
};

export default CounsellorListingPage; 