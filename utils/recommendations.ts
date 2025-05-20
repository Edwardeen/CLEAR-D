// utils/recommendations.ts

export const getGlaucomaRecommendations = (score: number): string => {
  if (score >= 0 && score <= 2) {
    return "Your glaucoma risk is Low risk. We recommend you to monitor your routinity, and lifestyle.";
  }
  if (score > 2 && score < 5) { // Adjusted range to match prompt (2.1-4.9)
    return "Your glaucoma risk is Moderate risk. Consider seeing an eye specialist to get a laser therapy, and to get eye drops prescribed.";
  }
  if (score >= 5 && score < 8) { // Adjusted range (5.0-7.9)
    return "Your glaucoma risk is High risk. Please consult an ophthalmologist soon. We recommend you to do surgery or combination treatments.";
  }
  if (score >= 8 && score <= 10) {
    return "Your glaucoma risk is Critical / Acute risk. Seek immediate medical attention to get laser or IOP-lowering medications.";
  }
  return "Invalid score.";
};

export const getCancerRecommendations = (score: number): string => {
  if (score >= 0 && score <= 2) {
    return "Your cancer risk is Low risk. Continue with regular check-ups. If you are diagnosed, please do Targeted Therapy";
  }
  if (score >= 3 && score <= 4) {
    return "Your cancer risk is Moderate risk. Consider consulting a doctor for further evaluation. if diagnosed, proceed to get Immunotherapy";
  }
  if (score >= 5 && score <= 6) {
    return "Your cancer risk is Localized disease likely. Please consult a doctor as soon as possible. if diagnosed, do Radiation Therapy";
  }
  if (score >= 7 && score <= 8) {
    return "Your cancer risk is High risk. Seek medical attention immediately. if diagnosed, proceed to get Chemotherapy";
  }
  if (score >= 9 && score <= 10) {
    return "Your cancer risk is Very high risk. Urgent medical consultation is necessary. if diagnosed, proceed to get Surgery and Chemotherapy or Radiation Therapy";
  }
  return "Invalid score.";
};

interface RiskData {
    glaucomaScore: number;
    cancerScore: number;
    glaucomaRiskPercentage: number;
    cancerRiskPercentage: number;
}

export const getOverallRecommendations = (riskData: RiskData) => {
    const { glaucomaRiskPercentage, cancerRiskPercentage, glaucomaScore, cancerScore } = riskData;

    const glaucomaRec = getGlaucomaRecommendations(glaucomaScore);
    const cancerRec = getCancerRecommendations(cancerScore);

    let higherRiskDisease: 'glaucoma' | 'cancer' | 'both' | 'none' = 'none';
    let recommendations = "";

    // Determine higher risk and combined recommendations
    if (glaucomaRiskPercentage > cancerRiskPercentage) {
        higherRiskDisease = 'glaucoma';
        recommendations = `Primary concern: Glaucoma (${glaucomaRiskPercentage}% risk). ${glaucomaRec}`;
    } else if (cancerRiskPercentage > glaucomaRiskPercentage) {
        higherRiskDisease = 'cancer';
        recommendations = `Primary concern: Cancer (${cancerRiskPercentage}% risk). ${cancerRec}`;
    } else if (glaucomaRiskPercentage === cancerRiskPercentage && glaucomaRiskPercentage > 0) { // Equal risk and not zero
        higherRiskDisease = 'both';
        recommendations = `Equal risk for Glaucoma (${glaucomaRiskPercentage}%) and Cancer (${cancerRiskPercentage}%).
Glaucoma: ${glaucomaRec}
Cancer: ${cancerRec}`;
    } else { // Both risks are 0%
        higherRiskDisease = 'none';
        recommendations = "Overall risk for both conditions is low. Maintain regular health check-ups.";
    }

     // If one risk is 0, still mention the recommendation for the other if it exists
    if (higherRiskDisease === 'glaucoma' && cancerScore > 0) {
        recommendations += `\nSecondary concern: Cancer (${cancerRiskPercentage}% risk). ${cancerRec}`;
    } else if (higherRiskDisease === 'cancer' && glaucomaScore > 0) {
        recommendations += `\nSecondary concern: Glaucoma (${glaucomaRiskPercentage}% risk). ${glaucomaRec}`;
    }

    return {
        higherRiskDisease,
        recommendations,
        glaucomaRecommendations: glaucomaRec, // Store individual recommendations
        cancerRecommendations: cancerRec
    };

}; 