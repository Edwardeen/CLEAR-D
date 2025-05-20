export const getRiskLevelName = (score: number, type: string): string => {
  const lowerType = type.toLowerCase();
  if (lowerType === 'glaucoma') {
    if (score >= 8) return 'Critical / Acute risk';
    if (score >= 5) return 'High risk';
    if (score >= 2.1) return 'Moderate risk';
    return 'Low risk';
  } else if (lowerType === 'cancer') {
    if (score >= 9) return 'Very high risk';
    if (score >= 7) return 'High risk';
    if (score >= 5) return 'Localized disease likely';
    if (score >= 3) return 'Moderate risk';
    return 'Low risk';
  } else {
    // Generic fallback for new types
    if (score >= 8) return 'Very High Risk';
    if (score >= 5) return 'High Risk';
    if (score >= 2) return 'Moderate Risk';
    return 'Low Risk';
  }
}; 