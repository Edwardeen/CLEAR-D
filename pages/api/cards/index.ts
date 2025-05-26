import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/dbConnect';
import Card, { ICard } from '@/models/Card';
import User from '@/models/User';
import Assessment from '@/models/Assessment';
import { getSession } from 'next-auth/react';
import { v4 as uuidv4 } from 'uuid'; // For generating unique card numbers

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getSession({ req });
  if (!session || !session.user?.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const userId = session.user.id;

  await dbConnect();

  if (req.method === 'POST') {
    try {
      // 1. Fetch user details
      const user = await User.findById(userId).select('hasDiabetes name icPassportNo photoUrl').lean();
      if (!user) {
        return res.status(404).json({ message: 'User not found to generate card.' });
      }

      // 2. Fetch latest assessments to determine riskFor
      const latestGlaucoma = await Assessment.findOne({ userId, type: 'glaucoma' }).sort({ createdAt: -1 }).lean();
      const latestCancer = await Assessment.findOne({ userId, type: 'cancer' }).sort({ createdAt: -1 }).lean();

      const riskFor: ('glaucoma' | 'cancer')[] = [];
      const recommendations: ICard['recommendations'] = {};

      // Define what constitutes a high enough risk to be listed on the card
      // Example: if riskLevel is 'High', 'Critical', or 'Very High'
      if (latestGlaucoma) {
        if (['High', 'Critical', 'Moderate'].includes(latestGlaucoma.riskLevel)) {
          riskFor.push('glaucoma');
        }
        if (latestGlaucoma.recommendations && latestGlaucoma.recommendations.length > 0) {
          recommendations.glaucoma = latestGlaucoma.recommendations;
        }
      }
      if (latestCancer) {
        if (['High', 'Very High', 'Localized', 'Moderate'].includes(latestCancer.riskLevel)) {
          riskFor.push('cancer');
        }
        if (latestCancer.recommendations && latestCancer.recommendations.length > 0) {
          recommendations.cancer = latestCancer.recommendations;
        }
      }
      
      // 3. Generate unique cardNo (simple UUID for now)
      const cardNo = uuidv4().substring(0, 16).replace(/-/g, '').toUpperCase();

      // 4. Generate qrCodeUrl (placeholder - link to user's profile or a dedicated card view page)
      // In a real app, this might be a signed URL or a shortlink
      const qrCodeUrl = `${process.env.NEXTAUTH_URL}/profile`; // Could also be `/cards/view/${cardNo}`

      // 5. Placeholder pdfUrl
      const pdfUrl = `/api/cards/${cardNo}/pdf`; // This endpoint would generate/serve the PDF

      const newCardData: Partial<ICard> = {
        userId: userId as any, // Mongoose handles ObjectId conversion
        cardNo,
        issueDate: new Date(),
        diabetes: user.hasDiabetes || false, // Default to false if undefined
        riskFor,
        qrCodeUrl,
        pdfUrl,
        recommendations,
      };

      const newCard = new Card(newCardData);
      await newCard.save();

      res.status(201).json({ message: 'CLEAR-D Card generated successfully', card: newCard });

    } catch (error: any) {
      console.error("Error generating CLEAR-D Card:", error);
      res.status(500).json({ message: 'Failed to generate CLEAR-D Card', error: error.message });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 