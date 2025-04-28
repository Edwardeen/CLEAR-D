import type { NextApiRequest, NextApiResponse } from 'next';
import nodemailer from 'nodemailer';
import { unstable_getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { IAssessment } from '../../models/Assessment'; // Assuming IAssessment includes necessary fields

// Nodemailer transporter setup (using environment variables)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '465', 10),
  secure: parseInt(process.env.SMTP_PORT || '465', 10) === 465, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface EmailRequestBody {
    assessment: IAssessment;
    userEmail: string;
    userName: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await unstable_getServerSession(req, res, authOptions);

  // Basic check to ensure the request comes from an authenticated session,
  // though the actual user details are passed in the body for clarity.
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { assessment, userEmail, userName }: EmailRequestBody = req.body;

  if (!assessment || !userEmail || !userName) {
    return res.status(400).json({ message: 'Missing required email data' });
  }

  // Construct email content
  const subject = 'Your Health Risk Assessment Results';
  const textBody = `
Dear ${userName},

Thank you for completing the health risk assessment.

Here is a summary of your results:

Glaucoma Risk Score: ${assessment.glaucomaScore}/10
Cancer Risk Score: ${assessment.cancerScore}/10

Highest Risk Identified: ${assessment.higherRiskDisease === 'both' ? 'Glaucoma & Cancer (Equal Risk)' : assessment.higherRiskDisease === 'none' ? 'None' : assessment.higherRiskDisease.charAt(0).toUpperCase() + assessment.higherRiskDisease.slice(1)}

Recommendations:
${assessment.recommendations}

You can view your full assessment history on your profile page:
${process.env.NEXTAUTH_URL}/profile

Please remember this assessment provides risk stratification and is not a diagnosis. Consult with a healthcare professional for any health concerns.

Sincerely,
The Health Assessment Team
`;

  const htmlBody = `
<p>Dear ${userName},</p>
<p>Thank you for completing the health risk assessment.</p>
<p>Here is a summary of your results:</p>
<ul>
  <li><strong>Glaucoma Risk Score:</strong> ${assessment.glaucomaScore}/10</li>
  <li><strong>Cancer Risk Score:</strong> ${assessment.cancerScore}/10</li>
  <li><strong>Highest Risk Identified:</strong> ${assessment.higherRiskDisease === 'both' ? 'Glaucoma & Cancer (Equal Risk)' : assessment.higherRiskDisease === 'none' ? 'None' : assessment.higherRiskDisease.charAt(0).toUpperCase() + assessment.higherRiskDisease.slice(1)}</li>
</ul>
<p><strong>Recommendations:</strong></p>
<pre style="white-space: pre-wrap; word-wrap: break-word; background-color: #f8f9fa; padding: 10px; border-radius: 4px;">${assessment.recommendations}</pre>
<p>You can view your full assessment history on your profile page: <a href="${process.env.NEXTAUTH_URL}/profile">${process.env.NEXTAUTH_URL}/profile</a></p>
<p>Please remember this assessment provides risk stratification and is not a diagnosis. Consult with a healthcare professional for any health concerns.</p>
<p>Sincerely,<br>The Health Assessment Team</p>
`;

  const mailOptions = {
    from: `"Health Assessment Team" <${process.env.EMAIL_FROM}>`,
    to: userEmail,
    subject: subject,
    text: textBody,
    html: htmlBody,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${userEmail}`);
    return res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Failed to send email:', error);
    // Do not expose detailed SMTP errors to the client
    return res.status(500).json({ message: 'Failed to send email' });
  }
} 