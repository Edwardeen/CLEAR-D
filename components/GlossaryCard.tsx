import React, { useState } from 'react';

interface GlossaryTerm {
  term: string;
  definition: string;
}

interface GlossaryCardProps {
  title?: string;
  terms: GlossaryTerm[];
  themeColor: 'green' | 'pink'; // To match the assessment theme
}

const GlossaryCard: React.FC<GlossaryCardProps> = ({ 
  title = "Glossary", 
  terms, 
  themeColor 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Define classes based on theme color
  const headerBgClass = themeColor === 'green' 
    ? 'bg-green-600' 
    : 'bg-pink-600';
  
  const toggleButtonClass = themeColor === 'green'
    ? 'text-green-600 hover:text-green-800'
    : 'text-pink-600 hover:text-pink-800';

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden w-full max-w-xl mt-8">
      <div className={`${headerBgClass} px-4 py-3 text-white`}>
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-white hover:text-gray-200 focus:outline-none"
            aria-label={isExpanded ? "Collapse glossary" : "Expand glossary"}
          >
            {isExpanded ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="p-4">
          <p className="text-sm text-gray-600 mb-3">
            Here are some medical terms that may help you understand the questions better:
          </p>
          <dl className="space-y-4 text-gray-700">
            {terms.map((term, index) => (
              <div key={index}>
                <dt className="font-semibold text-lg">{term.term}:</dt>
                <dd className="ml-1 text-base text-gray-600">{term.definition}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 text-center">
            <button
              onClick={() => setIsExpanded(false)}
              className={`text-sm font-medium ${toggleButtonClass} focus:outline-none`}
            >
              Close Glossary
            </button>
          </div>
        </div>
      )}
      
      {!isExpanded && (
        <div className="px-4 py-2 text-center border-t border-gray-200">
          <button
            onClick={() => setIsExpanded(true)}
            className={`text-sm font-medium ${toggleButtonClass} focus:outline-none`}
          >
            Need help? Click to view medical terms
          </button>
        </div>
      )}
    </div>
  );
};

export default GlossaryCard;

