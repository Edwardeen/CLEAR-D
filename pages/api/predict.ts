import type { NextApiRequest, NextApiResponse } from 'next';

// Define the structure of the incoming request data
interface RequestData {
  age: number | '';
  gender: 'Male' | 'Female' | 'Other' | '';
  familyHistoryGlaucoma: 'Yes' | 'No' | '';
  familyHistoryCancer: 'Yes' | 'No' | '';
  currentSymptoms?: string; // Optional
  blurredVision: 'Yes' | 'No' | '';
  weightLoss: 'Yes' | 'No' | '';
}

// Define the structure of the response data
interface ResponseData {
  glaucomaRisk: number;
  cancerRisk: number;
  recommendations: string[];
}

interface ErrorResponse {
  error: string;
}

// --- Dummy Prediction Logic --- //
// This function simulates a machine learning model prediction.
// It can be replaced with a call to a real model later.
const predictHealthRisks = (data: RequestData): ResponseData => {
  let glaucomaRisk = 10;
  let cancerRisk = 5;
  const recommendations: string[] = [];

  // Validate required fields before processing
  if (data.age === '' || data.gender === '' || data.familyHistoryGlaucoma === '' || data.familyHistoryCancer === '' || data.blurredVision === '' || data.weightLoss === '') {
      // This validation should ideally happen before calling this function,
      // but we include a fallback check.
      throw new Error("Missing required input data for prediction.");
  }

  // Glaucoma Risk Calculation
  if (data.age > 50) {
    glaucomaRisk += 20;
  }
  if (data.familyHistoryGlaucoma === 'Yes') {
    glaucomaRisk += 30;
  }
  if (data.blurredVision === 'Yes') {
    glaucomaRisk += 40;
  }
  glaucomaRisk = Math.min(glaucomaRisk, 100); // Cap at 100%

  // Cancer Risk Calculation
  if (data.age > 40) {
    cancerRisk += 10;
  }
  if (data.familyHistoryCancer === 'Yes') {
    cancerRisk += 20;
  }
  if (data.weightLoss === 'Yes') {
    cancerRisk += 30;
  }
  cancerRisk = Math.min(cancerRisk, 100); // Cap at 100%

  // Recommendations
  if (glaucomaRisk > 50) {
    recommendations.push('Consult an ophthalmologist.');
  }
  if (cancerRisk > 30) {
    recommendations.push('See a doctor for further tests.');
  }
  recommendations.push('Maintain a healthy lifestyle, get regular check-ups.');

  return {
    glaucomaRisk,
    cancerRisk,
    recommendations,
  };
};
// --- End of Dummy Prediction Logic --- //

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData | ErrorResponse>
) {
  if (req.method === 'POST') {
    const data: RequestData = req.body;

    // Server-side validation of required fields
    const requiredFields: (keyof RequestData)[] = [
      'age', 'gender', 'familyHistoryGlaucoma', 'familyHistoryCancer',
      'blurredVision', 'weightLoss'
    ];

    for (const field of requiredFields) {
        // Check if the field is missing or empty (age can be 0 but not empty string)
        if (data[field] === undefined || data[field] === null || data[field] === '') {
             if (field === 'age' && data.age !== 0) {
                 return res.status(400).json({ error: `Missing required field: ${field}` });
             } else if (field !== 'age') {
                 return res.status(400).json({ error: `Missing required field: ${field}` });
             }
        }
    }

     // Specific validation for age range
    if (typeof data.age !== 'number' || data.age < 0 || data.age > 120) {
        return res.status(400).json({ error: 'Invalid age provided. Age must be between 0 and 120.' });
    }

    // Add more specific validation if needed (e.g., check enum values for gender etc.)

    try {
      // Call the modular prediction function
      const predictionResults = predictHealthRisks(data);

      res.status(200).json(predictionResults);
    } catch (error: any) {
      console.error("Prediction error:", error);
      res.status(500).json({ error: error.message || 'Internal Server Error during prediction' });
    }
  } else {
    // Handle any non-POST requests
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 