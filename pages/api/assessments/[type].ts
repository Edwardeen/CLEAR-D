import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/dbConnect';
import Assessment, { IAssessment } from '@/models/Assessment';
import QuestionBank, { IQuestionBankItem } from '@/models/QuestionBank'; // Import QuestionBank
import { getServerSession } from 'next-auth/next'; // Changed from next-auth/react
import { authOptions } from '../auth/[...nextauth]'; // Import your authOptions
import User from '@/models/User'; // Import User model

interface ResponseItem {
  questionId: string;
  answer: 'Yes' | 'No' | string; // Allow string for other answer types potentially
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { type } = req.query as { type: 'glaucoma' | 'cancer' };
  
  const session = await getServerSession(req, res, authOptions); // Changed to getServerSession
  // DEBUG LOGGING
  console.log('[API Assessment Route] Attempting to submit. Received session:', JSON.stringify(session, null, 2));
  // END DEBUG LOGGING

  if (!session || !session.user?.id) {
    // DEBUG LOGGING
    console.log('[API Assessment Route] Unauthorized: Session or user ID missing. Current session object:', JSON.stringify(session, null, 2));
    // END DEBUG LOGGING
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const userId = session.user.id;

  await dbConnect();

  if (req.method === 'POST') {
    if (type !== 'glaucoma' && type !== 'cancer') {
      return res.status(400).json({ message: 'Invalid assessment type.' });
    }

    const { responses: manualResponsesFromClient } = req.body as { responses: ResponseItem[] };
    if (!manualResponsesFromClient || !Array.isArray(manualResponsesFromClient)) {
      return res.status(400).json({ message: 'Invalid responses format.' });
    }

    let userProfileData = {
      hasDiabetes: false,
      age: 0,
    };

    try {
      const user = await User.findById(userId).select('hasDiabetes dateOfBirth').lean();
      if (user) {
        userProfileData.hasDiabetes = user.hasDiabetes === true;
        console.log(`[Assessment API] User ${userId} fetched. Raw hasDiabetes: ${user.hasDiabetes}, Processed hasDiabetes: ${userProfileData.hasDiabetes}`);
        if (user.dateOfBirth) {
          const today = new Date();
          const birthDate = new Date(user.dateOfBirth);
          let age = today.getFullYear() - birthDate.getFullYear();
          const monthDifference = today.getMonth() - birthDate.getMonth();
          if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          userProfileData.age = age;
        }
      } else {
        console.log(`[Assessment API] User ${userId} not found.`);
      }
    } catch (dbError) {
      console.error(`[Assessment API] Error fetching user data for user ${userId}:`, dbError);
      // Potentially return an error if user data is critical and fetch fails
    }

    let totalScore = 0;
    const processedResponses: IAssessment['responses'] = [];
    const allQuestionsForType = await QuestionBank.find({ type: type }).lean();
    const questionMap = new Map<string, IQuestionBankItem>();
    allQuestionsForType.forEach(q => questionMap.set(q.questionId, q));

    // 1. Process auto-populated factors (Diabetes, Age)
    const diabetesQuestionIds = ['G7', 'C5']; // Glaucoma and Cancer diabetes question IDs
    const ageQuestionId = 'G11'; // Glaucoma age question ID

    for (const qId of diabetesQuestionIds) {
      const questionData = questionMap.get(qId);
      if (questionData && questionData.type === type) { // Ensure it's for the current assessment type
        const answer = userProfileData.hasDiabetes ? 'Yes' : 'No';
        const score = userProfileData.hasDiabetes ? questionData.weight : 0;
        console.log(`[Assessment API] Processing auto-question ${qId} for type ${type}. User diabetic: ${userProfileData.hasDiabetes}. Score added: ${score}`);
        totalScore += score;
        processedResponses.push({
          questionId: qId,
          answer,
          score,
          autoPopulated: true,
        });
      } else if (questionData && questionData.type !== type) {
        console.log(`[Assessment API] Skipping auto-question ${qId} because its type (${questionData.type}) does not match assessment type (${type}).`);
      } else if (!questionData) {
        console.log(`[Assessment API] Skipping auto-question ${qId} because it was not found in questionMap for type ${type}.`);
      }
    }

    if (type === 'glaucoma') {
      const ageQuestionData = questionMap.get(ageQuestionId);
      if (ageQuestionData) {
        const answer = userProfileData.age > 40 ? 'Yes' : 'No';
        const score = userProfileData.age > 40 ? ageQuestionData.weight : 0;
        totalScore += score;
        processedResponses.push({
          questionId: ageQuestionId,
          answer,
          score,
          autoPopulated: true,
        });
      }
    }

    // 2. Process manually answered questions from the client
    for (const response of manualResponsesFromClient) {
      const questionData = questionMap.get(response.questionId);
      if (!questionData) {
        console.warn(`Manual Response: Question ID ${response.questionId} not found in DB for type ${type}. Skipping.`);
        processedResponses.push({ questionId: response.questionId, answer: response.answer, score: 0 });
        continue;
      }

      // Sanity check: Should not receive auto-populated questions from client, but good to prevent double counting
      if (questionData.autoPopulate) {
          console.warn(`Manual Response: Question ID ${response.questionId} is auto-populated but received from client. Skipping.`);
        continue; 
      }

      let scoreForQuestion = 0;
      if (response.answer === 'Yes') {
        if (type === 'cancer' && response.questionId === 'C6') { // Special for Cancer Q6 screening
          scoreForQuestion = -1;
        } else {
          scoreForQuestion = questionData.weight;
        }
      } else if (response.answer === 'No') {
        if (type === 'cancer' && response.questionId === 'C6') {
          scoreForQuestion = 1;
        }
      }
      totalScore += scoreForQuestion;
      processedResponses.push({
        questionId: response.questionId,
        answer: response.answer,
        score: scoreForQuestion,
        autoPopulated: false, // Explicitly mark as not auto-populated
      });
    }
    
    totalScore = Math.max(0, totalScore);

    let riskLevel = 'Low';
    let recommendations: string[] = ["Consult with a healthcare professional for personalized advice."];

    if (type === 'glaucoma') {
      if (totalScore >= 8) riskLevel = 'Critical';
      else if (totalScore >= 5) riskLevel = 'High';
      else if (totalScore >= 2.1) riskLevel = 'Moderate';
      else riskLevel = 'Low';
      // TODO: Add specific glaucoma recommendations
    } else if (type === 'cancer') {
      if (totalScore >= 9) riskLevel = 'Very High';
      else if (totalScore >= 7) riskLevel = 'High';
      else if (totalScore >= 5) riskLevel = 'Localized';
      else if (totalScore >= 3) riskLevel = 'Moderate';
      else riskLevel = 'Low';
      // TODO: Add specific cancer recommendations
    }

    try {
      const newAssessment = new Assessment({
        userId,
        type,
        responses: processedResponses,
        totalScore,
        riskLevel,
        recommendations,
      });
      await newAssessment.save();
      
      res.status(201).json({
        assessmentId: newAssessment._id,
        totalScore,
        riskLevel,
        recommendations,
      });
    } catch (error: any) {
      console.error("Error saving assessment:", error);
      res.status(500).json({ message: 'Error saving assessment', error: error.message });
    }

  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 