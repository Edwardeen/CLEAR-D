import React from 'react';
import { ICounselor } from '@/models/Counselor';

interface CounselorCardProps {
  counselor: ICounselor;
  onClick?: () => void;
}

const CounselorCard: React.FC<CounselorCardProps> = ({ counselor, onClick }) => {
  return (
    <div 
      className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 cursor-pointer"
      onClick={onClick}
    >
      <div className="p-5">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-lg font-semibold text-gray-800 line-clamp-2">{counselor.name}</h3>
          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
            counselor.type === 'Kerajaan' ? 'bg-green-100 text-green-800' : 
            counselor.type === 'NGO' ? 'bg-purple-100 text-purple-800' : 
            counselor.type === 'Individual' ? 'bg-yellow-100 text-yellow-800' : 
            'bg-blue-100 text-blue-800'
          }`}>
            {counselor.type}
          </span>
        </div>
        
        <div className="mb-3">
          <div className="text-sm text-gray-500 mb-1">
            <span className="font-medium text-gray-700">State:</span> {counselor.state}
          </div>
          
          <div className="text-sm text-gray-500">
            <span className="font-medium text-gray-700">Address:</span> {counselor.address}
          </div>
        </div>
        
        {/* Specializations */}
        {counselor.specializations && counselor.specializations.length > 0 && (
          <div className="pt-3 border-t border-gray-100 mb-3">
            <div className="text-sm">
              <span className="font-medium text-gray-700">Specializations:</span>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {counselor.specializations.map((specialization, index) => (
                  <span 
                    key={index} 
                    className="inline-block px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium"
                  >
                    {specialization}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Languages */}
        {counselor.languages && counselor.languages.length > 0 && (
          <div className="pt-3 border-t border-gray-100">
            <div className="text-sm">
              <span className="font-medium text-gray-700">Languages:</span>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {counselor.languages.map((language, index) => (
                  <span 
                    key={index} 
                    className="inline-block px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium"
                  >
                    {language}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Contact Info - if available */}
        {counselor.contact && (counselor.contact.phone || counselor.contact.email) && (
          <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-600">
            {counselor.contact.phone && (
              <div>
                <span className="font-medium text-gray-700">Phone:</span> {counselor.contact.phone}
              </div>
            )}
            
            {counselor.contact.email && (
              <div className="truncate">
                <span className="font-medium text-gray-700">Email:</span> {counselor.contact.email}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CounselorCard; 