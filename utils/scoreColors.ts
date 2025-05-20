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
  if (score >= 9) return 'text-red-50 bg-red-700'; // 9-10: Very high risk - Surgery + Chemo/Radiation (Blood Red)
  if (score >= 7) return 'text-rose-50 bg-rose-500'; // 7-8: High risk - Chemotherapy
  if (score >= 5) return 'text-orange-50 bg-orange-500'; // 5-6: Localized disease likely - Radiation Therapy
  if (score >= 3) return 'text-amber-800 bg-amber-400'; // 3-4: Moderate risk - Immunotherapy
  return 'text-emerald-50 bg-emerald-600'; // 0-2: Low risk - Targeted Therapy
};

/**
 * Get color for glaucoma score based on the specified ranges:
 * - 0-2: Green (Low risk - Routine monitoring)
 * - 2.1-4.9: Yellow (Moderate risk - Eye drops)
 * - 5-7.9: Orange (High risk - Surgery/combination)
 * - 8-10: Red (Critical/Acute risk - Immediate intervention)
 */
export const getGlaucomaScoreColor = (score: number): string => {
  if (score >= 8) return 'text-red-50 bg-red-700';         // 8-10: Critical/Acute risk (Blood Red)
  if (score >= 5) return 'text-orange-50 bg-orange-600';  // 5-7.9: High risk
  if (score >= 2.1) return 'text-amber-800 bg-amber-400';  // 2.1-4.9: Moderate risk
  return 'text-emerald-50 bg-emerald-600';                 // 0-2: Low risk
}; 