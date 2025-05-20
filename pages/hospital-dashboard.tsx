import type { NextPage, GetServerSideProps } from 'next';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { getServerSession } from 'next-auth';
import { authOptions } from './api/auth/[...nextauth]';
import Link from 'next/link';
import { IHospital } from '@/models/Hospital'; // Assuming IHospital interface

// Placeholder data for filters - In reality, these could be fetched or predefined
const specializations = ["Glaucoma", "Oncology", "Diabetes", "Cardiology", "General Medicine"];
const provinces = ["Selangor", "Kuala Lumpur", "Johor", "Penang", "Perak", "Sabah", "Sarawak"]; // Example provinces

interface HospitalDashboardProps {
  // Props if initial data is fetched server-side (optional)
}

const HospitalDashboardPage: NextPage<HospitalDashboardProps> = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [hospitals, setHospitals] = useState<IHospital[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    specialization: '',
    province: '',
  });

  // Fetch hospitals based on filters
  const fetchHospitals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const queryParams = new URLSearchParams();
    if (filters.specialization) queryParams.append('specialization', filters.specialization);
    if (filters.province) queryParams.append('province', filters.province);

    try {
      const res = await fetch(`/api/hospitals?${queryParams.toString()}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to fetch hospitals');
      }
      const data = await res.json();
      
      // Validate the returned data structure
      if (!data || !Array.isArray(data.hospitals)) {
        console.error('Invalid data structure returned from API:', data);
        throw new Error('Invalid data structure returned from API');
      }
      
      // Handle empty response gracefully
      setHospitals(data.hospitals || []);
      
      // Log successful fetch for debugging
      console.log(`Fetched ${data.hospitals.length} hospitals with filters:`, filters);
    } catch (err: any) {
      console.error('Error fetching hospitals:', err);
      setError(err.message || 'An unexpected error occurred');
      setHospitals([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Fetch on initial load and when filters change
  useEffect(() => {
    // Optional: Could fetch user's risk profile here to pre-fill filters
    // For now, fetch all or based on default/current filters
    fetchHospitals();
  }, [filters, fetchHospitals]); // Re-fetch when filters state changes

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/hospital-dashboard');
    }
  }, [status, router]);

  if (status === 'loading') {
    return <div className="text-center p-10">Loading dashboard...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-8 text-center">Hospital & Specialist Dashboard</h1>

      {/* Filter Section */}
      <div className="bg-gray-50 p-6 rounded-lg shadow-md mb-8 flex flex-col sm:flex-row gap-4 items-center">
        <h2 className="text-xl font-semibold text-gray-700 mr-4 whitespace-nowrap">Filter by:</h2>
        <div className="flex-grow w-full sm:w-auto">
          <label htmlFor="specialization" className="sr-only">Specialization</label>
          <select 
            name="specialization" 
            id="specialization"
            value={filters.specialization}
            onChange={handleFilterChange}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2"
          >
            <option value="">All Specializations</option>
            {specializations.map(spec => <option key={spec} value={spec}>{spec}</option>)}
          </select>
        </div>
        <div className="flex-grow w-full sm:w-auto">
          <label htmlFor="province" className="sr-only">Province</label>
          <select 
            name="province" 
            id="province"
            value={filters.province}
            onChange={handleFilterChange}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2"
          >
            <option value="">All Provinces</option>
            {provinces.map(prov => <option key={prov} value={prov}>{prov}</option>)}
          </select>
        </div>
        {/* Button to manually trigger fetch if useEffect on filters is not desired */}
        {/* <button onClick={fetchHospitals} className="px-4 py-2 bg-blue-500 text-white rounded-md">Search</button> */}
      </div>

      {/* Hospital List Section */}
      {isLoading && <p className="text-center text-gray-600">Loading hospitals...</p>}
      {error && <p className="text-center text-red-500">Error: {error}</p>}
      {!isLoading && !error && hospitals.length === 0 && (
        <p className="text-center text-gray-600">No hospitals found matching your criteria.</p>
      )}
      {!isLoading && !error && hospitals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hospitals.map(hospital => (
            <div key={String(hospital._id)} className="bg-white p-5 rounded-lg shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
              <h3 className="text-xl font-bold text-gray-800 mb-2">{hospital.name}</h3>
              <p className="text-sm text-gray-600 mb-1">
                {hospital.address}
              </p>
              <p className="text-sm text-gray-600 mb-3">Phone: {hospital.contact?.phone || 'N/A'}</p>
              <div className="mb-3">
                <strong className="text-sm font-medium text-gray-700">Specialists:</strong>
                <div className="flex flex-wrap gap-1 mt-1">
                  {hospital.specialists && (
                    (Array.isArray(hospital.specialists) ? hospital.specialists : [hospital.specialists]).map((spec: string) => (
                      spec && spec.trim() !== '-' && spec.trim() !== '' && (
                        <span key={spec} className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">{spec}</span>
                      )
                    ))
                  )}
                  {(!hospital.specialists || (Array.isArray(hospital.specialists) && hospital.specialists.every(s => !s || s.trim() === '-' || s.trim() === '')) || (typeof hospital.specialists === 'string' && (hospital.specialists.trim() === '-' || hospital.specialists.trim() === ''))) && (
                    <span className="text-gray-500 text-xs">No specialists listed</span>
                  )}
                </div>
              </div>
              {/* Add link to view details or map if needed */}
              {/* <Link href={`/hospitals/${hospital._id}`}>View Details</Link> */}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const getServerSideProps: GetServerSideProps<HospitalDashboardProps> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session) {
    return {
      redirect: {
        destination: '/login?callbackUrl=/hospital-dashboard',
        permanent: false,
      },
    };
  }
  // Fetching is done client-side based on filters in this implementation
  return { props: {} };
};

export default HospitalDashboardPage; 