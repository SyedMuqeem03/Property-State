import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const router = express.Router();
const prisma = new PrismaClient();

router.get("/should-be-logged-in", verifyToken, (req, res) => {
  console.log('✅ User authenticated:', req.userId);
  res.status(200).json({ message: "You are Authenticated", userId: req.userId });
});

router.get("/should-be-admin", verifyToken, (req, res) => {
  console.log('❌ Admin check - not authorized');
  res.status(403).json({ message: "Not authorized!" });
});

// Check database connectivity and get counts
router.get('/db-stats', async (req, res) => {
  try {
    // Test database connection
    await prisma.$connect();
    
    // Get collection counts
    const userCount = await prisma.user.count();
    const postCount = await prisma.post.count();
    const conversationCount = await prisma.conversation.count();
    const messageCount = await prisma.message.count();
    
    res.status(200).json({
      status: 'connected',
      collections: {
        users: userCount,
        posts: postCount,
        conversations: conversationCount,
        messages: messageCount
      }
    });
  } catch (error) {
    console.error('❌ Database error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
});

// Check current user from token
router.get('/auth-check', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ status: 'error', message: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    res.status(200).json({
      status: 'authenticated',
      user: {
        id: decoded.id || decoded._id || decoded.userId,
        username: decoded.username,
        email: decoded.email
      }
    });
  } catch (error) {
    res.status(401).json({ status: 'error', message: error.message });
  }
});

export default router;
