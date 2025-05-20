import { useState, useEffect, useCallback } from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { IHospital } from '@/models/Hospital';

interface HospitalDetailsProps {
  initialData?: {
    hospital: IHospital;
  };
  error?: string;
}

const HospitalDetailsPage = ({ initialData, error }: HospitalDetailsProps) => {
  const router = useRouter();
  const { id } = router.query;
  const [hospital, setHospital] = useState<IHospital | null>(initialData?.hospital || null);
  const [loading, setLoading] = useState(!initialData?.hospital);
  const [errorMessage, setErrorMessage] = useState(error || '');

  const fetchHospital = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErrorMessage('');
    
    try {
      const response = await fetch(`/api/hospitals/${id}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch hospital: ${response.status}`);
      }
      
      const data = await response.json();
      setHospital(data.hospital);
    } catch (error) {
      console.error('Error fetching hospital:', error);
      setErrorMessage('Failed to load hospital details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!initialData?.hospital && !loading && id) {
      fetchHospital();
    }
    else if (initialData?.hospital && hospital?.id !== initialData.hospital.id) {
       setHospital(initialData.hospital);
       setLoading(false);
    }
  }, [id, initialData, loading, fetchHospital, hospital?.id]);

  // Format specialists for display
  const renderSpecialists = () => {
    if (!hospital?.specialists || hospital.specialists === '-') {
      return <span className="text-gray-500 italic">No specialists listed</span>;
    }

    if (Array.isArray(hospital.specialists)) {
      return (
        <div className="flex flex-wrap gap-2">
          {hospital.specialists.map((specialist, index) => (
            <span 
              key={index} 
              className="inline-block px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium"
            >
              {specialist}
            </span>
          ))}
        </div>
      );
    }

    return <span>{hospital.specialists}</span>;
  };

  // Handle view on Google Maps
  const openGoogleMaps = () => {
    if (hospital?.google_maps_link) {
      window.open(hospital.google_maps_link, '_blank');
    }
  };

  // Generate a fallback Google Maps link if none exists
  const getGoogleMapsLink = () => {
    if (hospital?.google_maps_link) {
      return hospital.google_maps_link;
    }
    
    // Generate a search query based on hospital name and address
    if (hospital) {
      const query = encodeURIComponent(`${hospital.name}, ${hospital.address}`);
      return `https://www.google.com/maps/search/?api=1&query=${query}`;
    }
    
    return '#';
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-8 rounded-lg text-center">
          <p className="text-lg font-medium mb-2">Error</p>
          <p className="text-red-600">{errorMessage}</p>
          <button 
            onClick={() => router.push('/hospitals')}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
          >
            Return to Hospitals List
          </button>
        </div>
      </div>
    );
  }

  if (!hospital) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-8 rounded-lg text-center">
          <p className="text-lg font-medium mb-2">Hospital Not Found</p>
          <p className="text-yellow-600">The hospital you&apos;re looking for couldn&apos;t be found.</p>
          <button 
            onClick={() => router.push('/hospitals')}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
          >
            Return to Hospitals List
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{hospital.name} | Hospitals & Specialists</title>
      </Head>
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link 
            href="/hospitals"
            className="inline-flex items-center text-indigo-600 hover:text-indigo-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to Hospitals List
          </Link>
        </div>
        
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2 md:mb-0">{hospital.name}</h1>
              <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium self-start md:self-auto ${
                hospital.type === 'Kerajaan' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {hospital.type}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <h2 className="text-lg font-semibold text-gray-700 mb-3">Location Information</h2>
                <div className="space-y-2">
                  <div>
                    <span className="font-medium text-gray-700">State:</span>
                    <p className="text-gray-600">{hospital.state}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Address:</span>
                    <p className="text-gray-600">{hospital.address}</p>
                  </div>
                </div>
              </div>
              
              <div>
                <h2 className="text-lg font-semibold text-gray-700 mb-3">Contact Information</h2>
                <div className="space-y-2">
                  {hospital.contact?.phone && (
                    <div>
                      <span className="font-medium text-gray-700">Phone:</span>
                      <p className="text-gray-600">{hospital.contact.phone}</p>
                    </div>
                  )}
                  {hospital.contact?.email && (
                    <div>
                      <span className="font-medium text-gray-700">Email:</span>
                      <p className="text-gray-600">{hospital.contact.email}</p>
                    </div>
                  )}
                  {hospital.contact?.website && (
                    <div>
                      <span className="font-medium text-gray-700">Website:</span>
                      <p className="text-blue-600 hover:underline">
                        <a href={hospital.contact.website} target="_blank" rel="noopener noreferrer">
                          {hospital.contact.website}
                        </a>
                      </p>
                    </div>
                  )}
                  {!hospital.contact?.phone && !hospital.contact?.email && !hospital.contact?.website && (
                    <p className="text-gray-500 italic">No contact information available</p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-700 mb-3">Specialists</h2>
              {renderSpecialists()}
            </div>
            
            {hospital.services && hospital.services.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-700 mb-3">Services</h2>
                <div className="flex flex-wrap gap-2">
                  {hospital.services.map((service, index) => (
                    <span 
                      key={index} 
                      className="inline-block px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm font-medium"
                    >
                      {service}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {hospital.operating_hours && (hospital.operating_hours.weekdays || hospital.operating_hours.weekends) && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-700 mb-3">Operating Hours</h2>
                <div className="space-y-2">
                  {hospital.operating_hours.weekdays && (
                    <div>
                      <span className="font-medium text-gray-700">Weekdays:</span>
                      <p className="text-gray-600">{hospital.operating_hours.weekdays}</p>
                    </div>
                  )}
                  {hospital.operating_hours.weekends && (
                    <div>
                      <span className="font-medium text-gray-700">Weekends:</span>
                      <p className="text-gray-600">{hospital.operating_hours.weekends}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="mt-8 flex justify-center">
              <a 
                href={getGoogleMapsLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                View on Google Maps
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const id = params?.id;
  
  if (!id || typeof id !== 'string') {
    return {
      props: {
        error: 'Hospital ID is required'
      }
    };
  }

  try {
    // Determine the base URL for API requests
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/hospitals/${id}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch hospital: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      props: {
        initialData: data
      }
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    return {
      props: {
        error: 'Failed to load hospital details'
      }
    };
  }
};

export default HospitalDetailsPage; 