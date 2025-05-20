import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../lib/dbConnect';
import ServerSetting from '../../models/ServerSetting';

/**
 * EMERGENCY RESTORE ENDPOINT
 * 
 * This endpoint allows restoring the server to online status when it's stuck in offline mode.
 * It bypasses normal authentication and server status checks.
 * 
 * SECURITY: This endpoint requires a secret emergency key to prevent unauthorized access.
 * 
 * Usage:
 * POST /api/emergency-restore?key=YOUR_EMERGENCY_KEY&action=restore
 * 
 * Set YOUR_EMERGENCY_KEY in .env.local as EMERGENCY_RESTORE_KEY
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Validate emergency key
    const providedKey = req.query.key as string;
    const emergencyKey = process.env.EMERGENCY_RESTORE_KEY;
    
    if (!emergencyKey) {
      console.error('EMERGENCY_RESTORE_KEY not defined in environment variables');
      return res.status(500).json({ 
        error: 'Emergency restore system not properly configured',
        message: 'Server administrator must define EMERGENCY_RESTORE_KEY in .env.local'
      });
    }
    
    if (!providedKey || providedKey !== emergencyKey) {
      console.warn('Invalid emergency key attempt', { providedIP: req.headers['x-forwarded-for'] || req.socket.remoteAddress });
      return res.status(403).json({ error: 'Invalid or missing emergency key' });
    }

    // Check action parameter
    const action = req.query.action as string;
    if (action !== 'restore') {
      return res.status(400).json({ error: 'Invalid action. Use "action=restore"' });
    }

    // Connect to database and restore server status
    await dbConnect();
    
    // Find current status
    const currentStatus = await ServerSetting.findOne({ key: 'global_server_status' });
    const wasOffline = currentStatus ? !currentStatus.isServiceGloballyActive : false;
    
    // Update status to online
    await ServerSetting.updateOne(
      { key: 'global_server_status' },
      { $set: { isServiceGloballyActive: true } },
      { upsert: true }
    );

    console.log('EMERGENCY RESTORE EXECUTED - Server set to ONLINE', {
      time: new Date().toISOString(),
      requestIP: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      previousStatus: wasOffline ? 'OFFLINE' : 'ONLINE or undefined'
    });

    return res.status(200).json({
      success: true,
      message: 'Emergency restore successful. Server is now ONLINE.',
      previousStatus: wasOffline ? 'OFFLINE' : 'ONLINE or undefined'
    });
  } catch (error) {
    console.error('Emergency restore error:', error);
    return res.status(500).json({
      error: 'Failed to restore server',
      message: String(error)
    });
  }
} 