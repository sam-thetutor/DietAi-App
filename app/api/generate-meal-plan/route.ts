import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// Use a text-focused model
const MODEL_NAME = "gemini-1.5-flash";
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("Error: GEMINI_API_KEY environment variable is not set.");
}

// --- Input/Output Types ---
// type HealthGoal = "weight_loss" | "weight_gain" | "maintenance";

// interface MealPlanRequest {
//     profile: {
//       goal: HealthGoal;
//       calorieTarget: string;
//       restrictions?: string;
//     };
//     calorieHistory: {
//       [dateKey: string]: {
//         breakfast: any[];
//         lunch: any[];
//         supper: any[];
//       }
//     };
// }

interface MealPlanResponse {
    breakfast: string[];
    lunch: string[];
    supper: string[];
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

export async function POST(request: Request) {
  if (!API_KEY) {
    return NextResponse.json({ error: 'API key not configured.' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { profile, calorieHistory } = body;
    
    if (!profile || !profile.goal || !profile.calorieTarget) {
      return NextResponse.json({ error: 'Missing profile information.' }, { status: 400 });
    }

    // Extract all unique food items from history
    const allLoggedFoods: string[] = [];
    if (calorieHistory) {
      Object.values(calorieHistory as CalorieHistory).forEach((day: MealCalories) => {
        (['breakfast', 'lunch', 'supper'] as const).forEach((meal: keyof MealCalories) => {
          const mealEntries = day[meal];
          if (Array.isArray(mealEntries)) {
            mealEntries.forEach((entry: CalorieLogEntry) => {
              if (entry.items && Array.isArray(entry.items)) {
                entry.items.forEach((item: string) => {
                  if (typeof item === 'string' && !allLoggedFoods.includes(item)) {
                    allLoggedFoods.push(item);
                  }
                });
              }
            });
          }
        });
      });
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const generationConfig = {
      temperature: 0.8,
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

    // Detailed prompt for meal plan
    const prompt = `
        Generate a balanced 5-day meal suggestion plan (5 breakfast, 5 lunch, 5 supper ideas) for a user with the following profile:

        - Health Goal: ${profile.goal}
        - Daily Calorie Target: Approximately ${profile.calorieTarget} kcal
        ${profile.restrictions ? `- Dietary Restrictions: ${profile.restrictions}` : ''}
        - User's Logged Food History (Unique Items): ${allLoggedFoods.length > 0 ? allLoggedFoods.join(', ') : 'None logged yet'}

        Task:
        Create distinct meal suggestions for breakfast, lunch, and supper. Provide exactly 5 suggestions for each meal type.

        Guidelines:
        - Aim for variety across the suggestions for each meal type.
        - Suggestions should align with the user's health goal (${profile.goal}).
            - For 'weight_loss': Focus on nutrient-dense, lower-calorie meals, potentially smaller portions.
            - For 'weight_gain': Include calorie-dense, nutritious options, potentially larger portions or additions.
            - For 'maintenance': Focus on balanced meals meeting the approximate target.
        - Incorporate or create variations of foods from the user's logged history where appropriate and healthy, but also introduce new balanced ideas.
        - Keep suggestions relatively simple and practical. Include brief descriptions or key ingredients.
        - Do NOT include calorie counts for each meal suggestion in the output.

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
        const jsonResponse: MealPlanResponse = JSON.parse(responseText);

        // Validate the structure
        if (jsonResponse &&
            Array.isArray(jsonResponse.breakfast) && jsonResponse.breakfast.length === 5 && jsonResponse.breakfast.every(item => typeof item === 'string') &&
            Array.isArray(jsonResponse.lunch) && jsonResponse.lunch.length === 5 && jsonResponse.lunch.every(item => typeof item === 'string') &&
            Array.isArray(jsonResponse.supper) && jsonResponse.supper.length === 5 && jsonResponse.supper.every(item => typeof item === 'string')
           )
        {
            console.log("Parsed Meal Plan:", jsonResponse);
            return NextResponse.json(jsonResponse);
        } else {
            console.error("Gemini response did not contain the expected meal plan structure:", responseText);
            return NextResponse.json({ error: 'AI response format incorrect. Expected { breakfast: string[5], lunch: string[5], supper: string[5] }' }, { status: 500 });
        }
    } catch (parseError) {
        console.error("Failed to parse Gemini meal plan response as JSON:", parseError, "\nResponse Text:", responseText);
        return NextResponse.json({ error: 'Failed to parse AI meal plan response.' }, { status: 500 });
    }

  } catch (error: unknown) {
    console.error('Error calling Gemini API for meal plan:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate meal plan.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 