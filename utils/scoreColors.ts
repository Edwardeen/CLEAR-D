// Utility functions for score color coding

/**
 * Get color for cancer score based on the specified ranges:
 * - 0-2: Green (Targeted Therapy)
 * - 3-4: Light Green (Immunotherapy)
 * - 5-6: Yellow (Radiation Therapy)
 * - 7-8: Orange (Chemotherapy)
 * - 9-10: Red (Surgery + Chemo/Radiation)
 */
export const getCancerScoreColor = (score: number): string => {
  if (score >= 9) return 'text-red-800 bg-red-100'; // 9-10: Red (Surgery + Chemo/Radiation)
  if (score >= 7) return 'text-orange-800 bg-orange-100'; // 7-8: Orange (Chemotherapy)
  if (score >= 5) return 'text-yellow-800 bg-yellow-100'; // 5-6: Yellow (Radiation Therapy)
  if (score >= 3) return 'text-green-800 bg-green-50'; // 3-4: Light Green (Immunotherapy)
  return 'text-green-800 bg-green-100'; // 0-2: Green (Targeted Therapy)
};

/**
 * Get color for glaucoma score based on the specified ranges:
 * - 0-2: Low Risk (Green)
 * - 3-5: Moderate Risk (Yellow)
 * - 6-8: High Risk (Orange)
 * - 9-10: Critical Risk (Red)
 */
export const getGlaucomaScoreColor = (score: number): string => {
  if (score >= 9) return 'text-red-800 bg-red-100';         // 9-10: Critical
  if (score >= 6) return 'text-orange-800 bg-orange-100';  // 6-8: High
  if (score >= 3) return 'text-yellow-800 bg-yellow-100';  // 3-5: Moderate
  return 'text-green-800 bg-green-100';                 // 0-2: Low
}; 