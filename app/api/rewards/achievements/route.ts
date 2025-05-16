import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Achievement } from '../route';

// POST endpoint to unlock an achievement
export async function POST(request: NextRequest) {
  try {
    const { address, achievementId } = await request.json();

    if (!address || !achievementId) {
      return NextResponse.json({ error: 'Missing address or achievement ID' }, { status: 400 });
    }

    // Connect to MongoDB
    const { db } = await connectToDatabase();
    
    // Get current user data
    const userData = await db.collection('rewards').findOne({ address });
    
    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Find the achievement
    const achievement = userData.achievements.find((a: Achievement) => a.id === achievementId);
    
    if (!achievement) {
      return NextResponse.json({ error: 'Achievement not found' }, { status: 404 });
    }
    
    // Check if already unlocked
    if (achievement.isUnlocked) {
      return NextResponse.json({ 
        success: false, 
        message: 'Achievement already unlocked',
        achievement
      });
    }
    
    // Update the achievement
    const updatedAchievement = {
      ...achievement,
      dateUnlocked: new Date(),
      isUnlocked: true
    };
    
    // Update the achievements array
    const updatedAchievements = userData.achievements.map((a: Achievement) => 
      a.id === achievementId ? updatedAchievement : a
    );
    
    // Update points if the achievement awards points
    const newTotalPoints = userData.totalPoints + achievement.pointsAwarded;
    
    // Update in database
    await db.collection('rewards').updateOne(
      { address },
      { 
        $set: { 
          achievements: updatedAchievements,
          totalPoints: newTotalPoints
        },
        $push: { 
          pointsHistory: {
            timestamp: new Date(),
            action: 'achievement_unlocked',
            points: achievement.pointsAwarded,
            description: `Unlocked achievement: ${achievement.name}`
          }
        }
      }
    );
    
    return NextResponse.json({ 
      success: true, 
      achievement: updatedAchievement,
      pointsAwarded: achievement.pointsAwarded,
      newTotalPoints
    });
    
  } catch (error) {
    console.error('Error unlocking achievement:', error);
    return NextResponse.json({ 
      error: 'Failed to unlock achievement', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 