// Utility functions for score color coding

/**
 * Get color for cancer score based on the specified ranges:
 * - 0-2: Green (Low risk - Targeted Therapy)
 * - 3-4: Yellow (Moderate risk - Immunotherapy)
 * - 5-6: Orange (Localized disease likely - Radiation Therapy)
 * - 7-8: Dark Orange (High risk - Chemotherapy)
 * - 9-10: Red (Very high risk - Surgery + Chemo/Radiation)
 */
export const getCancerScoreColor = (score: number): string => {
  if (score >= 9) return 'text-white bg-red-800'; // 9-10: Very high risk - Surgery + Chemo/Radiation (Deep Red)
  if (score >= 7) return 'text-white bg-rose-600'; // 7-8: High risk - Chemotherapy
  if (score >= 5) return 'text-white bg-orange-600'; // 5-6: Localized disease likely - Radiation Therapy
  if (score >= 3) return 'text-white bg-amber-500'; // 3-4: Moderate risk - Immunotherapy
  return 'text-white bg-emerald-700'; // 0-2: Low risk - Targeted Therapy
};

/**
 * Get color for glaucoma score based on the specified ranges:
 * - 0-2: Green (Low risk - Routine monitoring)
 * - 2.1-4.9: Yellow (Moderate risk - Eye drops)
 * - 5-7.9: Orange (High risk - Surgery/combination)
 * - 8-10: Red (Critical/Acute risk - Immediate intervention)
 */
export const getGlaucomaScoreColor = (score: number): string => {
  if (score >= 8) return 'text-white bg-red-800';         // 8-10: Critical/Acute risk (Deep Red)
  if (score >= 5) return 'text-white bg-orange-700';      // 5-7.9: High risk (Deeper Orange)
  if (score >= 2.1) return 'text-white bg-amber-500';     // 2.1-4.9: Moderate risk (Deeper Amber)
  return 'text-white bg-emerald-700';                     // 0-2: Low risk (Deeper Emerald)
};

// --- New functions to return hex colors ---

/**
 * Get hex color for cancer score based on risk level.
 */
export const getDynamicCancerHexColor = (score: number): string => {
  if (score >= 9) return '#B91C1C'; // Corresponds to red-800
  if (score >= 7) return '#E11D48'; // Corresponds to rose-600 
  if (score >= 5) return '#EA580C'; // Corresponds to orange-600
  if (score >= 3) return '#D97706'; // Corresponds to amber-500
  return '#047857'; // Corresponds to emerald-700
};

/**
 * Get hex color for glaucoma score based on risk level.
 */
export const getDynamicGlaucomaHexColor = (score: number): string => {
  if (score >= 8) return '#B91C1C';    // Corresponds to red-800
  if (score >= 5) return '#C2410C';    // Corresponds to orange-700
  if (score >= 2.1) return '#D97706'; // Corresponds to amber-500
  return '#047857';                  // Corresponds to emerald-700
}; 