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
  if (score >= 9) return 'text-red-600 bg-red-50';
  if (score >= 7) return 'text-orange-600 bg-orange-50';
  if (score >= 5) return 'text-yellow-600 bg-yellow-50';
  if (score >= 3) return 'text-green-600 bg-green-50';
  return 'text-emerald-600 bg-emerald-50';
};

/**
 * Get color for glaucoma score based on the specified ranges:
 * - 0-2: Green
 * - 2.1-4.9: Yellow
 * - 5.0-7.9: Orange
 * - 8-10: Red
 */
export const getGlaucomaScoreColor = (score: number): string => {
  if (score >= 8) return 'text-red-600 bg-red-50';
  if (score >= 5) return 'text-orange-600 bg-orange-50';
  if (score > 2) return 'text-yellow-600 bg-yellow-50';
  return 'text-green-600 bg-green-50';
}; 