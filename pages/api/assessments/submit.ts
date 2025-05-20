import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import dbConnect from '../../../lib/dbConnect';
import Assessment, { IAssessment } from '../../../models/Assessment';
import QuestionBank, { IQuestionBankItem } from '../../../models/QuestionBank';
import User from '../../../models/User';
import { getGlaucomaRecommendations, getCancerRecommendations } from '../../../utils/recommendations';

// Helper to get risk level name (similar to one in pages/results/[assessmentId].tsx)
const getRiskLevelName = (score: number, type: string): string => {
  // Normalize type to lowercase for consistent matching
  const lowerType = type.toLowerCase();

  if (lowerType === 'glaucoma') {
    if (score >= 8) return 'Critical / Acute risk'; // 8-10
    if (score >= 5) return 'High risk'; // 5.0-7.9
    if (score >= 2.1) return 'Moderate risk'; // 2.1-4.9
    return 'Low risk'; // 0-2
  } else if (lowerType === 'cancer') {
    if (score >= 9) return 'Very high risk'; // 9-10
    if (score >= 7) return 'High risk'; // 7-8
    if (score >= 5) return 'Localized disease likely'; // 5-6
    if (score >= 3) return 'Moderate risk'; // 3-4
    return 'Low risk'; // 0-2
  } else {
    // Quartile-based for other illnesses (assuming a 0-10 score range)
    // Ensure score is within 0-10 for this generic logic
    const normalizedScore = Math.max(0, Math.min(score, 10));
    if (normalizedScore > 7.5) return 'Very high risk'; // Quartile 4: 7.51 - 10
    if (normalizedScore > 5) return 'High risk';      // Quartile 3: 5.01 - 7.5
    if (normalizedScore > 2.5) return 'Moderate risk';  // Quartile 2: 2.51 - 5.0
    return 'Low risk';                               // Quartile 1: 0 - 2.5
  }
};

// Helper to get recommendations (extendable for more types)
const getRecommendations = (score: number, type: string): string[] => {
  const lowerType = type.toLowerCase();
  if (lowerType === 'glaucoma') {
    return [getGlaucomaRecommendations(score)];
  } else if (lowerType === 'cancer') {
    return [getCancerRecommendations(score)];
  } else {
    // Generic recommendations for other types, aligned with quartile risk levels
    const normalizedScore = Math.max(0, Math.min(score, 10)); // Ensure score is 0-10

    if (normalizedScore > 7.5) return ["Urgent medical consultation is advised. This indicates a Very high risk."];
    if (normalizedScore > 5.0) return ["Consult a specialist for further evaluation. This indicates a High risk."];
    if (normalizedScore > 2.5) return ["Monitor symptoms and consider a follow-up with a healthcare provider. This indicates a Moderate risk."];
    return ["Maintain a healthy lifestyle and regular check-ups. This indicates a Low risk."];
  }
};


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user?.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    await dbConnect();

    const { type, responses: userResponses, userId: bodyUserId, existingAssessmentId } = req.body;

    if (session.user.id !== bodyUserId) {
        return res.status(403).json({ message: 'User ID mismatch.' });
    }

    if (!type || !userResponses || !Array.isArray(userResponses) || userResponses.length === 0) {
      return res.status(400).json({ message: 'Missing assessment type or responses.' });
    }

    const questionBankItems = await QuestionBank.find({ type }).lean() as IQuestionBankItem[];
    if (!questionBankItems || questionBankItems.length === 0) {
      return res.status(400).json({ message: `No questions found for assessment type: ${type}` });
    }

    const questionsMap = new Map(questionBankItems.map(q => [q.questionId, q]));
    let totalScore = 0;

    const processedResponses = userResponses.map((response: { questionId: string; answer: string }) => {
      const question = questionsMap.get(response.questionId);
      if (!question) {
        throw new Error(`Question with ID ${response.questionId} not found for type ${type}.`);
      }
      // Basic scoring: if answer is "Yes", add question weight. Otherwise, 0.
      // This can be expanded for different answer types or more complex scoring.
      const score = response.answer === 'Yes' ? question.weight : 0;
      totalScore += score;
      return {
        questionId: response.questionId,
        answer: response.answer,
        score,
        // We can also store the weight at the time of response if needed, though it's in QuestionBank
        // weight: question.weight 
      };
    });

    // Ensure totalScore is capped at a reasonable maximum if necessary, e.g., 10, or sum of all weights.
    // For simplicity, we assume weights are designed to keep totalScore within a 0-10 range or similar.
    // If not, clamping or normalization might be needed here.
    // Example clamp (if max possible score is 10):
    // totalScore = Math.max(0, Math.min(totalScore, 10));

    const riskLevel = getRiskLevelName(totalScore, type);
    const recommendations = getRecommendations(totalScore, type);

    let savedAssessment;

    if (existingAssessmentId) {
      // Potentially update logic if resuming incomplete assessments
      // For now, this assumes a full resubmission replaces or acts as new
      // If it were truly updating, you might load the existing one and merge/modify
      console.warn(`Handling existingAssessmentId ${existingAssessmentId} - currently creates a new assessment.`);
      // Fall through to create new one, or implement update logic here.
    }
    
    // Create new assessment
    const newAssessment = new Assessment({
      userId: session.user.id,
      type,
      responses: processedResponses,
      totalScore,
      riskLevel,
      recommendations,
      createdAt: new Date(), // Explicitly set for clarity, though timestamps:true also does it
    });

    savedAssessment = await newAssessment.save();

    res.status(201).json({ message: 'Assessment submitted successfully', assessmentId: savedAssessment._id });

  } catch (error: any) {
    console.error('[API Submit Assessment] Error:', error);
    res.status(500).json({ message: error.message || 'Error submitting assessment' });
  }
} 