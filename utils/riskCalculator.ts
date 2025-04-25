import { IFormData } from '../models/Assessment';

// Glaucoma Calculation (1 point per 'Yes', max 10)
export const calculateGlaucomaScore = (formData: IFormData): number => {
  let score = 0;
  if (formData.elevatedIOP) score += 1;
  if (formData.familyHistoryGlaucoma) score += 1;
  if (formData.suddenEyePain) score += 1;
  if (formData.ethnicityRisk) score += 1;
  if (formData.ageOver40) score += 1;
  if (formData.steroidUse) score += 1;
  if (formData.diabetes) score += 1; // Shared
  if (formData.eyeInjury) score += 1;
  if (formData.poorVision) score += 1;
  if (formData.halosOrTunnelVision) score += 1;
  return Math.min(score, 10); // Ensure score doesn't exceed 10
};

// Cancer Calculation (Weighted points, adjusted for screening, max 10)
export const calculateCancerScore = (formData: IFormData): number => {
  let baseScore = 0;
  if (formData.unexplainedWeightLoss) baseScore += 3;
  if (formData.familyHistoryCancer) baseScore += 2;
  if (formData.tobaccoOrAlcohol) baseScore += 2;
  if (formData.highRiskEnvironment) baseScore += 1;
  if (formData.diabetes) baseScore += 1; // Shared

  // Adjust for screening
  const screeningAdjustment = formData.regularScreening ? 1 : 0;
  const finalScore = baseScore - screeningAdjustment;

  // Ensure score is between 0 and 10
  return Math.max(0, Math.min(finalScore, 10));
};

export const calculateRisk = (formData: IFormData) => {
    const glaucomaScore = calculateGlaucomaScore(formData);
    const cancerScore = calculateCancerScore(formData);

    const glaucomaRiskPercentage = (glaucomaScore / 10) * 100;
    const cancerRiskPercentage = (cancerScore / 10) * 100;

    return {
        glaucomaScore,
        cancerScore,
        glaucomaRiskPercentage,
        cancerRiskPercentage
    };
}; 