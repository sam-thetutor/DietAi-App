import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';

// Define types for our rewards system
export interface PointTransaction {
  timestamp: Date;
  action: string;
  points: number;
  description: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  dateUnlocked: Date | null;
  pointsAwarded: number;
  isUnlocked: boolean;
}

export interface UserRewards {
  address: string;
  totalPoints: number;
  currentLevel: number;
  pointsHistory: PointTransaction[];
  achievements: Achievement[];
  lastStreak: Date | null;
  currentStreak: number;
  longestStreak: number;
}

// Define available achievements
const AVAILABLE_ACHIEVEMENTS: Omit<Achievement, 'dateUnlocked' | 'isUnlocked'>[] = [
  {
    id: 'first_meal',
    name: 'First Bite',
    description: 'Log your first meal',
    icon: '🍽️',
    pointsAwarded: 10
  },
  {
    id: 'meal_streak_3',
    name: 'Consistent Eater',
    description: 'Log meals for 3 consecutive days',
    icon: '📆',
    pointsAwarded: 25
  },
  {
    id: 'meal_streak_7',
    name: 'Week Warrior',
    description: 'Log meals for 7 consecutive days',
    icon: '🗓️',
    pointsAwarded: 50
  },
  {
    id: 'photo_meals_5',
    name: 'Food Photographer',
    description: 'Upload 5 meal photos',
    icon: '📸',
    pointsAwarded: 30
  },
  {
    id: 'complete_profile',
    name: 'Identity Established',
    description: 'Complete your health profile',
    icon: '👤',
    pointsAwarded: 50
  },
  {
    id: 'calorie_goal_5',
    name: 'Goal Getter',
    description: 'Meet your calorie goal for 5 days',
    icon: '🎯',
    pointsAwarded: 40
  },
  {
    id: 'try_10_foods',
    name: 'Food Explorer',
    description: 'Try and log 10 different foods',
    icon: '🍲',
    pointsAwarded: 35
  },
  {
    id: 'generate_meal_plan',
    name: 'Meal Planner',
    description: 'Generate your first AI meal plan',
    icon: '📝',
    pointsAwarded: 15
  },
  {
    id: 'level_2',
    name: 'Level 2 Achieved',
    description: 'Reach Level 2',
    icon: '⭐',
    pointsAwarded: 0
  },
  {
    id: 'level_5',
    name: 'Health Enthusiast',
    description: 'Reach Level 5',
    icon: '🌟',
    pointsAwarded: 0
  }
];

// Calculate level based on points
function calculateLevel(points: number): number {
  if (points < 100) return 1;
  if (points < 250) return 2;
  if (points < 500) return 3;
  if (points < 1000) return 4;
  if (points < 2000) return 5;
  if (points < 3500) return 6;
  if (points < 5000) return 7;
  if (points < 7500) return 8;
  if (points < 10000) return 9;
  return 10;
}

// Calculate points needed for next level
function pointsForNextLevel(currentLevel: number): number {
  switch (currentLevel) {
    case 1: return 100;
    case 2: return 250;
    case 3: return 500;
    case 4: return 1000;
    case 5: return 2000;
    case 6: return 3500;
    case 7: return 5000;
    case 8: return 7500;
    case 9: return 10000;
    default: return 999999; // Max level
  }
}

// GET endpoint to retrieve user rewards
export async function GET(request: NextRequest) {
  try {
    // Get address from query params
    const address = request.nextUrl.searchParams.get('address');
    
    if (!address) {
      return NextResponse.json({ error: 'Missing wallet address' }, { status: 400 });
    }

    // Connect to MongoDB
    const { db } = await connectToDatabase();
    
    // Find the rewards data for this user
    let userData = await db.collection('rewards').findOne({ address });
    
    if (!userData) {
      // Initialize new user rewards
      userData = {
        address,
        totalPoints: 0,
        currentLevel: 1,
        pointsHistory: [],
        achievements: AVAILABLE_ACHIEVEMENTS.map(achievement => ({
          ...achievement,
          dateUnlocked: null,
          isUnlocked: false
        })),
        lastStreak: null,
        currentStreak: 0,
        longestStreak: 0
      };
      
      // Save the initial rewards data
      await db.collection('rewards').insertOne(userData);
    }
    
    // Calculate next level info
    const nextLevelPoints = pointsForNextLevel(userData.currentLevel);
    const pointsToNextLevel = nextLevelPoints - userData.totalPoints;
    const levelProgress = userData.currentLevel === 10 ? 100 : 
      Math.floor((userData.totalPoints / nextLevelPoints) * 100);
    
    return NextResponse.json({
      ...userData,
      nextLevelPoints,
      pointsToNextLevel,
      levelProgress
    });
    
  } catch (error) {
    console.error('Error retrieving rewards data:', error);
    return NextResponse.json({ 
      error: 'Failed to retrieve rewards data', 
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

// POST endpoint to add points
export async function POST(request: NextRequest) {
  try {
    const { address, action, points, description } = await request.json();

    if (!address) {
      return NextResponse.json({ error: 'Missing wallet address' }, { status: 400 });
    }

    if (!action || !points) {
      return NextResponse.json({ error: 'Missing action or points' }, { status: 400 });
    }

    // Connect to MongoDB
    const { db } = await connectToDatabase();
    
    // Get current user data
    let userData = await db.collection('rewards').findOne({ address });
    
    if (!userData) {
      // Initialize new user rewards
      userData = {
        address,
        totalPoints: 0,
        currentLevel: 1,
        pointsHistory: [],
        achievements: AVAILABLE_ACHIEVEMENTS.map(achievement => ({
          ...achievement,
          dateUnlocked: null,
          isUnlocked: false
        })),
        lastStreak: null,
        currentStreak: 0,
        longestStreak: 0
      };
      
      // Save the initial rewards data
      await db.collection('rewards').insertOne(userData);
    }
    
    // Create transaction
    const transaction: PointTransaction = {
      timestamp: new Date(),
      action,
      points,
      description: description || `Earned ${points} points for ${action}`
    };
    
    // Update user data
    const newTotalPoints = userData.totalPoints + points;
    const newLevel = calculateLevel(newTotalPoints);
    
    // Check for level up
    let levelUpAchievement = null;
    if (newLevel > userData.currentLevel) {
      // Check if there's a level achievement to unlock
      const levelAchievementId = `level_${newLevel}`;
      const levelAchievement = userData.achievements.find(a => a.id === levelAchievementId);
      
      if (levelAchievement && !levelAchievement.isUnlocked) {
        levelUpAchievement = {
          ...levelAchievement,
          dateUnlocked: new Date(),
          isUnlocked: true
        };
        
        // Update the achievement in the array
        userData.achievements = userData.achievements.map(a => 
          a.id === levelAchievementId ? levelUpAchievement : a
        );
      }
    }
    
    // Update the database
    await db.collection('rewards').updateOne(
      { address },
      { 
        $set: { 
          totalPoints: newTotalPoints,
          currentLevel: newLevel,
          achievements: userData.achievements
        },
        $push: { 
          pointsHistory: transaction
        }
      }
    );
    
    // Calculate next level info
    const nextLevelPoints = pointsForNextLevel(newLevel);
    const pointsToNextLevel = nextLevelPoints - newTotalPoints;
    const levelProgress = newLevel === 10 ? 100 : 
      Math.floor((newTotalPoints / nextLevelPoints) * 100);
    
    return NextResponse.json({ 
      success: true,
      points,
      totalPoints: newTotalPoints,
      currentLevel: newLevel,
      levelUp: newLevel > userData.currentLevel,
      levelUpAchievement,
      nextLevelPoints,
      pointsToNextLevel,
      levelProgress
    });
    
  } catch (error) {
    console.error('Error adding reward points:', error);
    return NextResponse.json({ 
      error: 'Failed to add reward points', 
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

// // Add this function to update streaks
// async function updateStreak(address: string, db: any) {
//   const userData = await db.collection('rewards').findOne({ address });
//   if (!userData) return;
  
//   const today = new Date();
//   today.setHours(0, 0, 0, 0);
  
//   const lastStreak = userData.lastStreak ? new Date(userData.lastStreak) : null;
  
//   if (!lastStreak) {
//     // First time logging, start streak
//     await db.collection('rewards').updateOne(
//       { address },
//       { 
//         $set: { 
//           lastStreak: today,
//           currentStreak: 1
//         }
//       }
//     );
//     return;
//   }
  
//   // Calculate days between last streak and today
//   const lastStreakDate = new Date(lastStreak);
//   lastStreakDate.setHours(0, 0, 0, 0);
  
//   const diffTime = Math.abs(today.getTime() - lastStreakDate.getTime());
//   const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
//   if (diffDays === 1) {
//     // Consecutive day, increment streak
//     const newStreak = userData.currentStreak + 1;
//     const longestStreak = Math.max(newStreak, userData.longestStreak || 0);
    
//     await db.collection('rewards').updateOne(
//       { address },
//       { 
//         $set: { 
//           lastStreak: today,
//           currentStreak: newStreak,
//           longestStreak: longestStreak
//         }
//       }
//     );
    
//     // Check for streak achievements
//     if (newStreak === 3) {
//       await unlockAchievement(address, 'meal_streak_3', db);
//     } else if (newStreak === 7) {
//       await unlockAchievement(address, 'meal_streak_7', db);
//     }
    
//   } else if (diffDays > 1) {
//     // Streak broken, reset to 1
//     await db.collection('rewards').updateOne(
//       { address },
//       { 
//         $set: { 
//           lastStreak: today,
//           currentStreak: 1
//         }
//       }
//     );
//   }
//   // If diffDays === 0, it's the same day, do nothing
// }

// Helper function to unlock an achievement
// async function unlockAchievement(address: string, achievementId: string, db: any) {
//   const userData = await db.collection('rewards').findOne({ address });
//   if (!userData) return;
  
//   const achievement = userData.achievements.find(a => a.id === achievementId);
//   if (!achievement || achievement.isUnlocked) return;
  
//   await db.collection('rewards').updateOne(
//     { address, "achievements.id": achievementId },
//     { 
//       $set: { 
//         "achievements.$.isUnlocked": true,
//         "achievements.$.dateUnlocked": new Date()
//       },
//       $inc: { totalPoints: achievement.pointsAwarded },
//       $push: { 
//         pointsHistory: {
//           timestamp: new Date(),
//           action: 'achievement_unlocked',
//           points: achievement.pointsAwarded,
//           description: `Unlocked achievement: ${achievement.name}`
//         }
//       }
//     }
//   );
// } 