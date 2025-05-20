import React from 'react';
import Image from 'next/image';
// import QRCode from 'qrcode.react'; // QR Code import remains commented out for now
import { IUser } from '@/models/User';
import ClearDLogo from '../logo.png'; // Re-enabling logo import

interface MyKadDisplayProps {
  user: Partial<IUser>;
  profileUrl: string; // For QR code link if re-enabled
  glaucomaScore?: number;
  cancerScore?: number;
  riskFor?: 'Glaucoma' | 'Cancer' | 'Both' | 'None';
}

const getRiskColorProperties = (
  glaucomaScore?: number,
  cancerScore?: number,
  riskFor?: 'Glaucoma' | 'Cancer' | 'Both' | 'None'
): { bgClass: string; textClass: string; borderColorClass: string; riskLabel: string } => {
  let colorProps = {
    bgClass: 'bg-gray-100', // Default background
    textClass: 'text-gray-800',
    borderColorClass: 'border-gray-300',
    riskLabel: 'N/A'
  };

  const effectiveGlaucomaScore = glaucomaScore !== undefined ? glaucomaScore : -1;
  const effectiveCancerScore = cancerScore !== undefined ? cancerScore : -1;

  // Determine primary risk for color scheme if "Both"
  let primaryRiskType = riskFor;
  if (riskFor === 'Both') {
    primaryRiskType = 'Glaucoma'; // Default to Glaucoma color scheme for "Both"
  }

  if (primaryRiskType === 'Glaucoma') {
    colorProps.riskLabel = `Glaucoma Risk: ${effectiveGlaucomaScore}/10`;
    if (effectiveGlaucomaScore >= 8) {
      colorProps.bgClass = 'bg-red-500'; colorProps.textClass = 'text-white'; colorProps.borderColorClass = 'border-red-700';
    } else if (effectiveGlaucomaScore >= 5) {
      colorProps.bgClass = 'bg-orange-500'; colorProps.textClass = 'text-white'; colorProps.borderColorClass = 'border-orange-700';
    } else if (effectiveGlaucomaScore >= 2.1) {
      colorProps.bgClass = 'bg-yellow-400'; colorProps.textClass = 'text-gray-800'; colorProps.borderColorClass = 'border-yellow-600';
    } else if (effectiveGlaucomaScore >= 0) {
      colorProps.bgClass = 'bg-green-500'; colorProps.textClass = 'text-white'; colorProps.borderColorClass = 'border-green-700';
    }
  } else if (primaryRiskType === 'Cancer') {
    colorProps.riskLabel = `Cancer Risk: ${effectiveCancerScore}/10`;
    if (effectiveCancerScore >= 9) {
      colorProps.bgClass = 'bg-red-600'; colorProps.textClass = 'text-white'; colorProps.borderColorClass = 'border-red-800';
    } else if (effectiveCancerScore >= 7) {
      colorProps.bgClass = 'bg-orange-600'; colorProps.textClass = 'text-white'; colorProps.borderColorClass = 'border-orange-800';
    } else if (effectiveCancerScore >= 5) {
      colorProps.bgClass = 'bg-yellow-500'; colorProps.textClass = 'text-gray-800'; colorProps.borderColorClass = 'border-yellow-700';
    } else if (effectiveCancerScore >= 3) {
      colorProps.bgClass = 'bg-lime-500'; colorProps.textClass = 'text-white'; colorProps.borderColorClass = 'border-lime-700'; // Light Green (using lime)
    } else if (effectiveCancerScore >= 0) {
      colorProps.bgClass = 'bg-green-600'; colorProps.textClass = 'text-white'; colorProps.borderColorClass = 'border-green-800';
    }
  }
  
  if (riskFor === 'None' || (effectiveGlaucomaScore < 0 && effectiveCancerScore < 0)) {
    colorProps.riskLabel = 'Low/No Assessed Risk';
    colorProps.bgClass = 'bg-blue-500'; // A neutral, positive color for low/no risk
    colorProps.textClass = 'text-white';
    colorProps.borderColorClass = 'border-blue-700';
  }

  return colorProps;
};

const MyKadDisplay: React.FC<MyKadDisplayProps> = ({ user, profileUrl, glaucomaScore, cancerScore, riskFor }) => {
  const formatDate = (dateString?: Date | string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return 'Invalid Date';
    }
  };

  const cardId = user._id ? `CD-${user._id.toString().slice(-7).toUpperCase()}` : 'N/A';
  const fullName = user.name ? `${user.name.first || ''} ${user.name.last || ''}`.trim() : 'User Name';
  const icPassport = user.icPassportNo || 'N/A';
  const issuedDate = formatDate(user.createdAt);
  const diabetesStatus = user.hasDiabetes === undefined ? 'N/A' : (user.hasDiabetes ? 'Yes' : 'No');

  const { bgClass, textClass, borderColorClass, riskLabel } = getRiskColorProperties(glaucomaScore, cancerScore, riskFor);

  let riskForDisplay = 'N/A';
  if (riskFor === 'Both') riskForDisplay = 'Glaucoma & Cancer';
  else if (riskFor) riskForDisplay = riskFor;

  return (
    <div className={`w-full max-w-md mx-auto my-6 rounded-xl shadow-2xl font-sans overflow-hidden border-4 ${borderColorClass} ${bgClass} ${textClass}`}>
      <div className="p-5">
        {/* Header: Logo and Card Title */}
        <div className="flex justify-between items-center mb-4 pb-3 border-b-2 border-opacity-50" style={{borderColor: textClass === 'text-white' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)'}}>
          <Image src={ClearDLogo} alt="CLEAR-D Logo" width={100} height={30} priority />
          <div className="text-right">
            <h2 className={`text-xl font-bold ${textClass}`}>CLEAR-D Health Card</h2>
            <p className={`text-xs opacity-80 ${textClass}`}>{riskLabel}</p>
          </div>
        </div>

        {/* Body: Photo and Details */}
        <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
          {/* Left: Photo & QR Placeholder */}
          <div className="flex-shrink-0 w-32 sm:w-1/3 flex flex-col items-center">
            <div className={`w-32 h-40 border-2 ${textClass === 'text-white' ? 'border-white border-opacity-50' : 'border-gray-300'} rounded-md overflow-hidden mb-3 bg-gray-200 flex items-center justify-center`}>
              {user.photoUrl ? (
                <Image src={user.photoUrl} alt="Profile Photo" width={128} height={160} className="object-cover w-full h-full" />
              ) : (
                <span className={`text-sm ${textClass === 'text-white' ? 'text-gray-200' : 'text-gray-500'}`}>No Photo</span>
              )}
            </div>
            {/* QR Code Placeholder Area */}
            <div className={`w-32 h-20 border-2 border-dashed ${textClass === 'text-white' ? 'border-white border-opacity-30' : 'border-gray-400'} rounded-md flex flex-col items-center justify-center text-center p-2`}>
              <span className={`text-xs font-semibold opacity-80 ${textClass}`}>SCAN FOR PROFILE</span>
              <span className={`text-[0.6rem] opacity-70 ${textClass}`}>(QR System Deactivated)</span>
            </div>
          </div>

          {/* Right: User Information */}
          <div className="flex-grow space-y-2 text-sm w-full sm:w-2/3">
            <InfoItem label="Name" value={fullName} textClass={textClass} />
            <InfoItem label="I/C / Passport" value={icPassport} textClass={textClass} />
            <InfoItem label="Card No." value={cardId} textClass={textClass} />
            <InfoItem label="Issued" value={issuedDate} textClass={textClass} />
            <InfoItem label="Diabetes" value={diabetesStatus} highlight={user.hasDiabetes} textClass={textClass} />
            <InfoItem label="Primary Risk For" value={riskForDisplay} textClass={textClass} />
          </div>
        </div>

        {/* Footer Note for QR */}
        <p className={`mt-4 text-center text-xs opacity-70 ${textClass}`}>The QR code links to your secure CLEAR-D health profile.</p>
      </div>
    </div>
  );
};

// Helper component for consistent detail item styling
interface InfoItemProps {
  label: string;
  value: string;
  textClass: string;
  highlight?: boolean;
}
const InfoItem: React.FC<InfoItemProps> = ({ label, value, textClass, highlight }) => (
  <div className={`border-b pb-1 ${textClass === 'text-white' ? 'border-white border-opacity-20' : 'border-gray-200'}`}>
    <p className={`text-xs font-medium opacity-70 ${textClass}`}>{label}</p>
    <p className={`font-semibold text-base truncate ${textClass} ${highlight ? (textClass === 'text-white' ? 'text-yellow-300' : 'text-red-600') : ''}`} title={value}>{value}</p>
  </div>
);

export default MyKadDisplay;

// Basic CSS for text-xxs if Tailwind doesn't have it by default
// Add this to your global CSS or a style tag if needed:
// .text-xxs { font-size: 0.65rem; /* 10.4px */ } 