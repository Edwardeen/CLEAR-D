import React from 'react';
import { useRouter } from 'next/router';
import { IHospital } from '@/models/Hospital';

interface HospitalCardProps {
  hospital: IHospital;
  onClick?: () => void;
}

const HospitalCard: React.FC<HospitalCardProps> = ({ hospital, onClick }) => {
  const router = useRouter();
  
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (hospital._id) {
      // Default behavior: navigate to hospital details page
      router.push(`/hospitals/${hospital._id}`);
    }
  };

  // Format specialists for display
  const renderSpecialists = () => {
    if (!hospital.specialists || hospital.specialists === '-') {
      return <span className="text-gray-500 italic">No specialists listed</span>;
    }

    if (Array.isArray(hospital.specialists)) {
      return (
        <div className="flex flex-wrap gap-1">
          {hospital.specialists.map((specialist, index) => (
            <span 
              key={index} 
              className="inline-block px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium"
            >
              {specialist}
            </span>
          ))}
        </div>
      );
    }

    return <span>{hospital.specialists}</span>;
  };

  return (
    <div 
      className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 cursor-pointer"
      onClick={handleClick}
    >
      <div className="p-5">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-lg font-semibold text-gray-800 line-clamp-2">{hospital.name}</h3>
          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
            hospital.type === 'Government' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
          }`}>
            {hospital.type}
          </span>
        </div>
        
        <div className="mb-3">
          <div className="text-sm text-gray-500 mb-1">
            <span className="font-medium text-gray-700">State:</span> {hospital.state}
          </div>
          
          <div className="text-sm text-gray-500">
            <span className="font-medium text-gray-700">Address:</span> {hospital.address}
          </div>
        </div>
        
        <div className="pt-3 border-t border-gray-100">
          <div className="text-sm">
            <span className="font-medium text-gray-700">Specialists:</span>
            <div className="mt-1.5">
              {renderSpecialists()}
            </div>
          </div>
        </div>
        
        <div className="mt-4 pt-3 border-t border-gray-100 text-right">
          <span className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            View Details →
          </span>
        </div>
      </div>
    </div>
  );
};

export default HospitalCard; 