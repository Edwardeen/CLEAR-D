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
    if (score >= 8) return 'Critical / Acute risk';
    if (score >= 5) return 'High risk';
    if (score >= 2.1) return 'Moderate risk'; // Based on previous util: score > 2 && score < 5
    return 'Low risk';
  } else if (lowerType === 'cancer') {
    if (score >= 9) return 'Very high risk';
    if (score >= 7) return 'High risk';
    if (score >= 5) return 'Localized disease likely';
    if (score >= 3) return 'Moderate risk';
    return 'Low risk';
  } else {
    // Generic fallback for other types like 'ligma'
    if (score >= 8) return 'Very High Risk';
    if (score >= 5) return 'High Risk';
    if (score >= 2) return 'Moderate Risk';
    return 'Low Risk';
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
    // Generic recommendations for other types
    if (score >= 8) return ['Urgent medical consultation is advised.'];
    if (score >= 5) return ['Consult a specialist for further evaluation and management.'];
    if (score >= 2) return ['Monitor symptoms and consider a follow-up with a healthcare provider.'];
    return ['Maintain a healthy lifestyle and regular check-ups.'];
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