import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// Use a text-focused model
const MODEL_NAME = "gemini-1.5-flash";
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("Error: GEMINI_API_KEY environment variable is not set.");
}

// Define proper types for the meal data structure
interface CalorieLogEntry {
  calories: number;
  items: string[];
  timestamp: string;
  imageUrl?: string;
}

interface MealCalories {
  breakfast: CalorieLogEntry[];
  lunch: CalorieLogEntry[];
  supper: CalorieLogEntry[];
  snacks?: CalorieLogEntry[];
  drinks?: CalorieLogEntry[];
}

interface CalorieHistory {
  [dateKey: string]: MealCalories;
}

// Type for MongoDB database
interface MongoDB {
  collection: (name: string) => Collection;
}

interface Collection {
  findOne: (query: any) => Promise<any>;
  updateOne: (query: any, update: any, options?: any) => Promise<any>;
}

interface MealPlanResponse {
  breakfast: string[];
  lunch: string[];
  supper: string[];
}

export async function GET(request: NextRequest) {
  try {
    // Get address from query params
    const address = request.nextUrl.searchParams.get('address');
    
    if (!address) {
      return NextResponse.json({ error: 'Missing wallet address' }, { status: 400 });
    }

    // Connect to MongoDB
    const { db } = await connectToDatabase();
    
    // Find the meal plan data for this user
    const userData = await db.collection('meal_plans').findOne({ address });
    
    if (!userData) {
      // If no meal plan exists, generate a default one
      return await generateAndSaveMealPlan(address, db);
    }
    
    return NextResponse.json(userData.mealPlan);
    
  } catch (error) {
    console.error('Error retrieving meal plan data:', error);
    return NextResponse.json({ 
      error: 'Failed to retrieve meal plan', 
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();

    if (!address) {
      return NextResponse.json({ error: 'Missing wallet address' }, { status: 400 });
    }

    // Connect to MongoDB
    const { db } = await connectToDatabase();
    
    // Generate a new meal plan
    const mealPlan = await generateAndSaveMealPlan(address, db);
    
    // Check if the user has the meal planner achievement
    const userData = await db.collection('rewards').findOne({ address });
    if (userData) {
      // Check if the achievement is already unlocked
      const mealPlannerAchievement = userData.achievements.find((a: any) => a.id === 'generate_meal_plan');
      
      if (mealPlannerAchievement && !mealPlannerAchievement.isUnlocked) {
        // Unlock the achievement
        await db.collection('rewards').updateOne(
          { address, "achievements.id": "generate_meal_plan" },
          { 
            $set: { 
              "achievements.$.isUnlocked": true,
              "achievements.$.dateUnlocked": new Date()
            },
            $inc: { totalPoints: mealPlannerAchievement.pointsAwarded },
            $push: { 
              pointsHistory: {
                timestamp: new Date(),
                action: 'achievement_unlocked',
                points: mealPlannerAchievement.pointsAwarded,
                description: `Unlocked achievement: ${mealPlannerAchievement.name}`
              }
            }
          }
        );
      }
    }
    
    return NextResponse.json(mealPlan);
    
  } catch (error) {
    console.error('Error generating meal plan:', error);
    return NextResponse.json({ 
      error: 'Failed to generate meal plan', 
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

async function generateAndSaveMealPlan(address: string, db: MongoDB) {
  if (!API_KEY) {
    return NextResponse.json({ error: 'API key not configured.' }, { status: 500 });
  }

  try {
    // Get user profile
    const userProfile = await db.collection('profiles').findOne({ address });
    
    // Get calorie history
    const calorieData = await db.collection('calories').findOne({ address });
    
    // Extract profile data and calorie history
    const profile = userProfile?.profile || {
      goal: "maintenance",
      calorieTarget: "2000",
      restrictions: ""
    };
    
    const calorieHistory = calorieData?.calorieData || {};
    
    // Extract all unique food items from history
    const allLoggedFoods: string[] = [];
    const foodFrequency: Record<string, number> = {};
    
    if (calorieHistory) {
      Object.values(calorieHistory as CalorieHistory).forEach((day: MealCalories) => {
        (['breakfast', 'lunch', 'supper'] as const).forEach((meal: keyof MealCalories) => {
          const mealEntries = day[meal];
          if (Array.isArray(mealEntries)) {
            mealEntries.forEach((entry: CalorieLogEntry) => {
              if (entry.items && Array.isArray(entry.items)) {
                entry.items.forEach((item: string) => {
                  if (typeof item === 'string') {
                    // Add to unique foods list
                    if (!allLoggedFoods.includes(item)) {
                      allLoggedFoods.push(item);
                    }
                    
                    // Count frequency
                    foodFrequency[item] = (foodFrequency[item] || 0) + 1;
                  }
                });
              }
            });
          }
        });
      });
    }
    
    // Get top 10 favorite foods (most frequently logged)
    const favoriteFoods = Object.entries(foodFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(entry => entry[0]);
    
    console.log("User profile:", profile);
    console.log("Favorite foods:", favoriteFoods);
    console.log("All logged foods count:", allLoggedFoods.length);

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const generationConfig = {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    };

    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ];

    // Create prompt for meal plan generation
    const prompt = `
        Generate a personalized 5-day meal suggestion plan (5 breakfast, 5 lunch, 5 supper ideas) for a user with the following profile:
        
        User Profile:
        - Health Goal: ${profile.goal || 'maintenance'}
        - Daily Calorie Target: ${profile.calorieTarget || '2000'} calories
        - Dietary Restrictions: ${profile.restrictions || 'None'}
        
        Food History:
        - Favorite foods (most frequently logged): ${favoriteFoods.length > 0 ? favoriteFoods.join(', ') : 'No favorites yet'}
        - Previously logged foods: ${allLoggedFoods.length > 0 ? allLoggedFoods.join(', ') : 'No food history available'}
        
        Guidelines:
        - Create a varied and balanced meal plan with 5 different options for each meal type.
        - Each meal suggestion should be a brief description (1-2 sentences max).
        - Suggestions should align with the user's health goal.
        - For 'weight_loss': Focus on nutrient-dense, lower-calorie meals.
        - For 'weight_gain': Include calorie-dense, nutritious options.
        - For 'maintenance': Focus on balanced meals meeting the approximate target.
        - Incorporate the user's favorite foods where appropriate and healthy.
        - Include at least 2-3 of the user's favorite foods in the meal plan.
        - Keep suggestions relatively simple and practical.
        - Do NOT include calorie counts for each meal suggestion.

        Output Format:
        Respond ONLY with a valid JSON object containing exactly three keys: "breakfast", "lunch", and "supper". Each key must hold an array of exactly 5 strings, where each string is a meal suggestion.

        Example JSON Output Structure:
        {
          "breakfast": [
            "Scrambled eggs with spinach and whole-wheat toast",
            "Greek yogurt with granola and mixed berries",
            "Oatmeal with sliced banana and chia seeds",
            "Smoothie with protein powder, fruit, and almond milk",
            "Whole-grain pancakes with a side of fruit"
          ],
          "lunch": [
            "Large mixed green salad with grilled chicken and vinaigrette",
            "Turkey and avocado wrap in a whole-wheat tortilla",
            "Lentil soup with a side salad",
            "Quinoa bowl with roasted vegetables and chickpeas",
            "Tuna salad sandwich on whole-wheat bread with lettuce"
          ],
          "supper": [
            "Baked salmon with roasted sweet potatoes and broccoli",
            "Chicken stir-fry with brown rice and mixed vegetables",
            "Lean ground turkey chili with beans",
            "Whole-wheat pasta with marinara sauce and lean meatballs",
            "Vegetable curry with tofu and brown rice"
          ]
        }
    `;

    console.log(`Sending request to Gemini (${MODEL_NAME}) for meal plan generation...`);

    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig,
        safetySettings,
    });

    // Check for blocked content or empty response
    if (!result.response || !result.response.candidates || !result.response.candidates[0].content) {
        const blockReason = result.response?.promptFeedback?.blockReason;
        console.error("Gemini meal plan response blocked or empty. Reason:", blockReason || "Unknown");
        const errorMessage = blockReason ? `Content blocked by AI safety filters (${blockReason}).` : 'AI response was empty or blocked.';
        return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const responseText = result.response.text();
    console.log("Gemini Meal Plan Response Text:", responseText);

    try {
        const mealPlan: MealPlanResponse = JSON.parse(responseText);

        // Validate the structure
        if (mealPlan &&
            Array.isArray(mealPlan.breakfast) && mealPlan.breakfast.length === 5 && mealPlan.breakfast.every(item => typeof item === 'string') &&
            Array.isArray(mealPlan.lunch) && mealPlan.lunch.length === 5 && mealPlan.lunch.every(item => typeof item === 'string') &&
            Array.isArray(mealPlan.supper) && mealPlan.supper.length === 5 && mealPlan.supper.every(item => typeof item === 'string')
           )
        {
            console.log("Parsed Meal Plan:", mealPlan);
            
            // Add metadata to the meal plan
            const mealPlanWithMetadata = {
                ...mealPlan,
                generatedAt: new Date(),
                userProfile: {
                    goal: profile.goal,
                    calorieTarget: profile.calorieTarget,
                    restrictions: profile.restrictions
                },
                favoriteFoods: favoriteFoods.slice(0, 5) // Include top 5 favorite foods
            };
            
            // Save the meal plan to the database
            await db.collection('meal_plans').updateOne(
              { address },
              { $set: { address, mealPlan: mealPlanWithMetadata, updatedAt: new Date() } },
              { upsert: true }
            );
            
            return NextResponse.json(mealPlanWithMetadata);
        } else {
            console.error("Gemini response did not contain the expected meal plan structure:", responseText);
            return NextResponse.json({ error: 'AI response format incorrect. Expected { breakfast: string[5], lunch: string[5], supper: string[5] }' }, { status: 500 });
        }
    } catch (parseError) {
        console.error("Failed to parse Gemini meal plan response as JSON:", parseError, "\nResponse Text:", responseText);
        return NextResponse.json({ error: 'Failed to parse AI meal plan response.' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error generating meal plan:', error);
    return NextResponse.json({ 
      error: 'Failed to generate meal plan', 
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
} 