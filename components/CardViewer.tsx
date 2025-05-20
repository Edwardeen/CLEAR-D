import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { ICard } from '@/models/Card';
import QRCode from 'react-qr-code';
import localLogoForCard from '../logo.png';
import { auto } from '@cloudinary/url-gen/actions/resize';

interface CardViewerProps {
  card: ICard;
  userName?: string;
  userIc?: string;
  userPhotoUrl?: string;
  logoUrl?: string;
  glaucomaScore?: number;
  cancerScore?: number;
  baseUrl?: string;
}

// Function to determine risk level color
const getRiskColor = (score: number | undefined, type: 'glaucoma' | 'cancer') => {
  if (score === undefined) return '#6B7280'; // Gray for unknown
  
  if (type === 'glaucoma') {
    if (score >= 8) return '#DC2626'; // Critical - Red
    if (score >= 5) return '#EA580C'; // High - Orange
    if (score >= 2.1) return '#EAB308'; // Moderate - Yellow
    return '#16A34A'; // Low - Green
  } else { // cancer
    if (score >= 9) return '#DC2626'; // Very high - Red
    if (score >= 7) return '#EA580C'; // High - Orange
    if (score >= 5) return '#F97316'; // Localized - Light Orange
    if (score >= 3) return '#EAB308'; // Moderate - Yellow
    return '#16A34A'; // Low - Green
  }
};

// Get risk level label
const getRiskLevel = (score: number | undefined, type: 'glaucoma' | 'cancer') => {
  if (score === undefined) return 'Unknown';
  
  if (type === 'glaucoma') {
    if (score >= 8) return 'Critical / Acute';
    if (score >= 5) return 'High Risk';
    if (score >= 2.1) return 'Moderate';
    return 'Low Risk';
  } else { // cancer
    if (score >= 9) return 'Very High Risk';
    if (score >= 7) return 'High Risk';
    if (score >= 5) return 'Localized';
    if (score >= 3) return 'Moderate';
    return 'Low Risk';
  }
};

// Get recommended action based on score and type
const getRecommendedAction = (score: number | undefined, type: 'glaucoma' | 'cancer') => {
  if (score === undefined) return 'Consult healthcare provider';
  
  if (type === 'glaucoma') {
    if (score >= 8) return 'Immediate intervention, laser or IOP-lowering meds';
    if (score >= 5) return 'Surgery or combination treatments';
    if (score >= 2.1) return 'Eye drops, laser therapy';
    return 'Routine monitoring, lifestyle advice';
  } else { // cancer
    if (score >= 9) return 'Surgery + Chemo/Radiation';
    if (score >= 7) return 'Chemotherapy';
    if (score >= 5) return 'Radiation Therapy';
    if (score >= 3) return 'Immunotherapy';
    return 'Targeted Therapy';
  }
};

const CardViewer: React.FC<CardViewerProps> = ({
  card,
  userName,
  userIc,
  userPhotoUrl,
  logoUrl,
  glaucomaScore,
  cancerScore,
  baseUrl = ''
}) => {
  const [qrUrl, setQrUrl] = useState<string>('');

  // Create QR URL only once when component mounts or when card.userId changes
  useEffect(() => {
    const publicBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : baseUrl); // Fallback to window.location.origin or prop
    const url = `${publicBaseUrl}/profile/${card.userId}`;
    setQrUrl(url);
  }, [card.userId, baseUrl]);
  
  // Format issue date once during component render
  const formattedDate = new Date(card.issueDate).toLocaleDateString('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  // Determine the risk colors
  const glaucomaColor = getRiskColor(glaucomaScore, 'glaucoma');
  const cancerColor = getRiskColor(cancerScore, 'cancer');
  
  // Get risk levels
  const glaucomaRiskLevel = getRiskLevel(glaucomaScore, 'glaucoma');
  const cancerRiskLevel = getRiskLevel(cancerScore, 'cancer');

  // Get recommended actions
  const glaucomaAction = getRecommendedAction(glaucomaScore, 'glaucoma');
  const cancerAction = getRecommendedAction(cancerScore, 'cancer');
  
  // For downloadable version, ensure we use inline styles
  return (
    <div style={{
      width: '100%',
      maxWidth: '100%',
      margin: '0 auto',
      padding: '0px',
    }}>
      {/* Card container */}
      <div style={{
        width: '100%',
        backgroundColor: '#FFF5F5', // Very light red/pink background
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        border: '1px solid #E5E7EB',
        position: 'relative',
      }}>
        {/* Medical cross watermark */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '220px',
          height: '220px',
          opacity: 0.03,
          zIndex: 0,
        }}>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 8H8V16H16V8Z" fill="#EF4444" />
            <path d="M19 8h-3v8h3a3 3 0 003-3v-2a3 3 0 00-3-3z" fill="#EF4444" />
            <path d="M5 8h3v8H5a3 3 0 01-3-3v-2a3 3 0 013-3z" fill="#EF4444" />
            <path d="M8 5v3h8V5a3 3 0 00-3-3h-2a3 3 0 00-3 3z" fill="#EF4444" />
            <path d="M8 19v-3h8v3a3 3 0 01-3 3h-2a3 3 0 01-3-3z" fill="#EF4444" />
          </svg>
        </div>

        {/* Content */}
        <div style={{
          padding: '20px',
          position: 'relative',
          zIndex: 1,
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '15px',
            borderBottom: '1px solid rgba(229, 231, 235, 0.7)',
            paddingBottom: '10px',
          }}>
            {/* Logo and title */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
            }}>
              <div style={{
                height: '40px',
                width: '150px',
                marginRight: '10px',
                position: 'relative',
              }}>
                <Image 
                  src={localLogoForCard}
                  alt="CLEAR-D Logo" 
                  width={100}
                  height={50}
                  style={{
                    height: '100%',
                    width: '100%',
                    objectFit: 'contain',
                  }}
                />
              </div>

            </div>
            
            {/* Card number */}
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              padding: '5px 10px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '500',
              color: '#1F2937', // Near black
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              border: '1px solid #E5E7EB',
            }}>
              Card No: <span style={{ color: '#1E40AF', fontWeight: 'bold' }}>{card.cardNo}</span>
            </div>
          </div>

          {/* Main content */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Name */}
            <div style={{
              fontWeight: 'bold',
              fontSize: '20px',
              color: '#111827', // Near black
              marginBottom: '20px',
              marginLeft: 'auto',
              marginRight: 'auto',
              
            }}>
              {userName || 'N/A'}
            </div>

            {/* Photo and details */}
            <div style={{
              display: 'flex',
              gap: '15px',
              marginBottom: '15px',
            }}>
              {/* Left section with photo */}
              <div style={{
                width: '110px',
                height: '140px',
                backgroundColor: 'white',
                borderRadius: '6px',
                overflow: 'hidden',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                border: '1px solid #E5E7EB',
                flexShrink: 0,
                position: 'relative',
              }}>
                {userPhotoUrl ? (
                  <Image 
                    src={userPhotoUrl} 
                    alt={userName ? `${userName}&apos;s photo` : "User&apos;s photo"} 
                    layout="fill"
                    objectFit="cover"
                  />
                ) : (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#F3F4F6',
                  }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" fill="#9CA3AF"/>
                      <path d="M12 13C16.4183 13 20 16.5817 20 21H4C4 16.5817 7.58172 13 12 13Z" fill="#9CA3AF"/>
                    </svg>
                  </div>
                )}
              </div>

              {/* Right section with personal details */}
              <div style={{
                flex: '1',
                backgroundColor: 'white',
                borderRadius: '6px',
                padding: '15px',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                border: '1px solid #E5E7EB',
              }}>
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '2px' }}>IC/Passport:</div>
                  <div style={{ fontSize: '16px', fontWeight: '500', color: '#111827' }}>{userIc || '123456789102'}</div>
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '2px' }}>Issue Date:</div>
                  <div style={{ fontSize: '14px', color: '#111827' }}>{formattedDate}</div>
                </div>

                <div>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '2px' }}>Diabetes:</div>
                  <div style={{ fontSize: '14px', color: '#22C55E', fontWeight: '500' }}>{card.diabetes ? 'Yes' : 'No'}</div>
                </div>
              </div>
            </div>

            {/* Risk Assessment & Recommendations Section */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '6px',
              padding: '15px',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
              border: '1px solid #E5E7EB',
              marginBottom: '15px',
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#1F2937',
                marginBottom: '10px',
                textAlign: 'center',
                borderBottom: '1px solid #E5E7EB',
                paddingBottom: '5px',
              }}>
                Risk Assessment & Recommendations
              </div>

              {card.riskFor.includes('glaucoma') && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                  borderBottom: '1px dashed #F3F4F6',
                  paddingBottom: '8px',
                }}>
                  <div style={{ flex: '1' }}>
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>Glaucoma Risk:</div>
                    <div style={{ 
                      fontSize: '14px', 
                      fontWeight: '500', 
                      color: glaucomaColor,
                    }}>
                      {glaucomaRiskLevel} {glaucomaScore !== undefined ? `(${glaucomaScore.toFixed(1)}/10)` : ''}
                    </div>
                  </div>
                  <div style={{ flex: '1' }}>
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>Recommendation:</div>
                    <div style={{ fontSize: '12px', color: '#4B5563' }}>{glaucomaAction}</div>
                  </div>
                </div>
              )}

              {card.riskFor.includes('cancer') && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                }}>
                  <div style={{ flex: '1' }}>
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>Cancer Risk:</div>
                    <div style={{ 
                      fontSize: '14px', 
                      fontWeight: '500', 
                      color: cancerColor,
                    }}>
                      {cancerRiskLevel} {cancerScore !== undefined ? `(${cancerScore.toFixed(1)}/10)` : ''}
                    </div>
                  </div>
                  <div style={{ flex: '1' }}>
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>Recommendation:</div>
                    <div style={{ fontSize: '12px', color: '#4B5563' }}>{cancerAction}</div>
                  </div>
                </div>
              )}
            </div>

            {/* QR Code */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '6px',
              padding: '15px',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
              border: '1px solid #E5E7EB',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {qrUrl && (
                <div style={{ width: '84px', height: '84px' }}>
                  <QRCode
                    value={qrUrl}
                    size={84}
                    level="M"
                    style={{ height: '100%', width: '100%' }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardViewer; 