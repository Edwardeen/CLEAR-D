import { IFormData } from '../models/Assessment';

// Glaucoma Calculation (Guideline v3, integer-rounded, max 10)
export const calculateGlaucomaScore = (formData: IFormData): number => {
  let score = 0;
  if (formData.elevatedIOP) score += 2.0;
  if (formData.poorVision) score += 1.5;            // Guideline: Peripheral vision loss
  if (formData.suddenEyePain) score += 1.5;
  if (formData.familyHistoryGlaucoma) score += 1.0;
  if (formData.halosOrTunnelVision) score += 1.0;   // Guideline: Halos/tunnel vision
  if (formData.steroidUse) score += 0.8;
  if (formData.ethnicityRisk) score += 0.5;
  if (formData.diabetes) score += 0.91;            // Guideline: Diabetes specific point
  if (formData.ageOver40) score += 0.3;

  // Round to nearest integer
  const roundedScore = Math.round(score);
  
  // Ensure score is between 0 and 10
  return Math.max(0, Math.min(roundedScore, 10)); 
};

// Cancer Calculation (Guideline v3, integer-rounded, max 10)
export const calculateCancerScore = (formData: IFormData): number => {
  let score = 0;
  if (formData.unexplainedWeightLoss) score += 3;    
  if (formData.familyHistoryCancer) score += 1.5;  
  if (formData.tobaccoOrAlcohol) score += 1.5;   
  if (formData.highRiskEnvironment) score += 1.5; 
  if (formData.diabetes) score += 1.5;     

  // Adjust for screening (-1 for Yes, +1 for No)
  if (formData.regularScreening === true) {
    score -= 1; 
  } else if (formData.regularScreening === false) { 
    score += 1; 
  } 
  
  // Round to nearest integer
  const roundedScore = Math.round(score);

  // Ensure score is between 0 and 10
  return Math.max(0, Math.min(roundedScore, 10));
};

export const calculateRisk = (formData: IFormData) => {
    // Use the updated functions which now return rounded integers
    const glaucomaScore = calculateGlaucomaScore(formData);
    const cancerScore = calculateCancerScore(formData);

    // Percentages are based on the final integer score
    const glaucomaRiskPercentage = (glaucomaScore / 10) * 100;
    const cancerRiskPercentage = (cancerScore / 10) * 100;

    return {
        glaucomaScore, // Already rounded integer
        cancerScore,   // Already rounded integer
        glaucomaRiskPercentage,
        cancerRiskPercentage
    };
}; 