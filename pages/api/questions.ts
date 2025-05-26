import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/dbConnect';
import QuestionBank, { IQuestionBankItem } from '@/models/QuestionBank';

// Define a simple interface for our mock questions
interface SimplifiedQuestion {
  questionId: string;
  text: string;
  weight: number;
}

// Mock data based on the provided YAML/docx content until DB is seeded
const mockGlaucomaQuestions: SimplifiedQuestion[] = [
  { questionId: 'G1', text: 'High Eye Pressure / Vision Loss', weight: 1.82 },
  { questionId: 'G2', text: 'Eye Pain / Nausea / Blurred Vision', weight: 1.36 },
  { questionId: 'G3', text: 'Gradual Vision Loss', weight: 1.36 },
  { questionId: 'G4', text: 'Family History', weight: 0.91 },
  { questionId: 'G5', text: 'Halos Around Lights', weight: 0.91 },
  { questionId: 'G6', text: 'Low BP / Vascular Issues', weight: 0.91 },
  { questionId: 'G7', text: 'Diabetic', weight: 0.91 },
  { questionId: 'G8', text: 'Steroid Medication Usage', weight: 0.73 },
  { questionId: 'G9', text: 'African/Hispanic/Asian Descent', weight: 0.45 },
  { questionId: 'G10', text: 'Frequent Headaches/Visual Disturbances', weight: 0.36 },
  { questionId: 'G11', text: 'Age > 40', weight: 0.27 },
];

const mockCancerQuestions: SimplifiedQuestion[] = [
  { questionId: 'C1', text: 'Unexplained Weight Loss', weight: 3 },
  { questionId: 'C2', text: 'Family History', weight: 1.5 },
  { questionId: 'C3', text: 'Alcohol/Tobacco Use', weight: 1.5 },
  { questionId: 'C4', text: 'High-Risk Environment', weight: 1.5 },
  { questionId: 'C5', text: 'Diabetic', weight: 1.5 }, // This was C5 in the spec image
  { questionId: 'C6', text: 'Regular Screening', weight: 1 }, // Weight is +1 if No, -1 if Yes (handled in submission logic)
  { questionId: 'C7', text: 'Do you have diabetes?', weight: 1.5 }, // New question from spec
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { type } = req.query;

  if (req.method === 'GET') {
    if (type !== 'glaucoma' && type !== 'cancer') {
      return res.status(400).json({ message: 'Invalid or missing assessment type query parameter.' });
    }

    try {
      await dbConnect();

      // Fetch questions and filter out those marked for auto-population
      const questions = await QuestionBank.find({
        type: type,
        $or: [
          { autoPopulate: { $exists: false } }, // Include if autoPopulate doesn't exist
          { autoPopulate: false }             // Include if autoPopulate is false
        ]
      })
        .select('questionId text weight -_id')
        .sort({ questionId: 1 })
        .lean();

      if (!questions) { // Note: find() returns [] if no docs, not null unless error
        return res.status(404).json({ message: `No manual-answer questions found for type: ${type}` });
      }

      res.status(200).json(questions);

    } catch (error: any) {
      console.error(`Error fetching questions for type ${type}:`, error);
      res.status(500).json({ message: 'Internal server error fetching questions', error: error.message });
    }

  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 