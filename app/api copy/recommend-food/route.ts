import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// Use a text-focused model like gemini-1.5-flash or gemini-pro
const MODEL_NAME = "gemini-1.5-flash";
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("Error: GEMINI_API_KEY environment variable is not set.");
}

// Define expected input types (mirroring frontend types)
type HealthGoal = "weight_loss" | "weight_gain" | "maintenance";

interface RecommendationRequest {
    healthGoal: HealthGoal;
    commonFoods: string[]; // Top 5 overall common foods
}

// interface RecommendationResponse {
//     recommendations: string[];
// }

export async function POST(request: Request) {
  if (!API_KEY) {
    return NextResponse.json({ error: 'API key not configured.' }, { status: 500 });
  }

  try {
    const body: RecommendationRequest = await request.json();
    const { healthGoal, commonFoods } = body;

    // Updated input validation (removed remainingCalories check)
    if (!healthGoal || !Array.isArray(commonFoods)) {
      return NextResponse.json({ error: 'Missing or invalid input data (goal, common foods).' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const generationConfig = {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
    };

    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ];

    // --- Updated Prompt for General Goal-Oriented Suggestions ---
    const prompt = `
        Provide general dietary suggestions to help a user achieve their long-term health goal, based on their common eating habits.

        User Profile:
        - Health Goal: ${healthGoal}
        - Common Foods Eaten (Top 5): ${commonFoods.length > 0 ? commonFoods.join(', ') : 'None specified'}

        Task:
        Generate 3-5 actionable dietary suggestions or meal ideas that align with the user's health goal (${healthGoal}). These suggestions should be general advice, not tied to specific daily calorie counts.

        Guidelines:
        - Analyze the common foods list. If they seem counterproductive to the goal, suggest healthier alternatives or modifications (e.g., "Consider swapping [common food] for [healthier option] more often," or "Try preparing [common food] in a lighter way, like baking instead of frying").
        - If common foods align well, suggest complementary healthy foods or meal structures (e.g., "Pairing your usual [common food] with a side salad can add nutrients," or "Ensure you're getting enough lean protein like [example] to support your ${healthGoal} goal").
        - For 'weight_loss': Focus on nutrient density, portion awareness, lower-calorie swaps.
        - For 'weight_gain': Focus on nutrient-dense additions, healthy fats, protein sources.
        - For 'maintenance': Focus on balance, variety, and mindful eating.
        - Suggestions should be practical tips or general meal concepts (e.g., "Incorporate more leafy greens into your lunches," "Prioritize lean protein sources at dinner," "Snack on fruits or nuts instead of processed options").

        Output Format:
        Respond ONLY with a valid JSON object containing a single key "recommendations". This key should hold an array of strings, where each string is one distinct suggestion.

        Example (Weight Loss, common foods: pasta, bread, chicken):
        {"recommendations": ["Consider opting for whole-wheat pasta and bread for increased fiber, which can aid satiety.", "Try pairing your chicken dishes with larger portions of non-starchy vegetables like broccoli or spinach.", "Explore adding lean protein sources like beans or lentils to your meals.", "Be mindful of portion sizes, especially with pasta and bread."]}

        Example (Weight Gain, common foods: rice, eggs, vegetables):
        {"recommendations": ["Add healthy fats like avocado or nuts to your rice and vegetable dishes to increase calorie density.", "Consider incorporating an extra egg or adding cheese to your breakfast for more protein and calories.", "Snack on calorie-dense options like peanut butter on toast or Greek yogurt with granola.", "Ensure you're eating regular meals and snacks throughout the day."]}
    `;
    // --- End Updated Prompt ---

    console.log(`Sending request to Gemini (${MODEL_NAME}) for general food suggestions...`);

    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig,
        safetySettings,
    });

    // Check for blocked content or empty response
    if (!result.response || !result.response.candidates || !result.response.candidates[0].content) {
        const blockReason = result.response?.promptFeedback?.blockReason;
        console.error("Gemini recommendation response blocked or empty. Reason:", blockReason || "Unknown");
        const errorMessage = blockReason ? `Content blocked by AI safety filters (${blockReason}).` : 'AI response was empty or blocked.';
        return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const responseText = result.response.text();
    console.log("Gemini General Suggestion Response Text:", responseText);

    try {
        const jsonResponse = JSON.parse(responseText);

        // Validate the structure
        if (jsonResponse && Array.isArray(jsonResponse.recommendations)) {
            // Further validation: ensure items in array are strings
            const validRecommendations = jsonResponse.recommendations.filter(
                (item: unknown): item is string => typeof item === 'string'
            );
            console.log("Parsed General Recommendations:", validRecommendations);
            return NextResponse.json({ recommendations: validRecommendations });
        } else {
            console.error("Gemini response did not contain expected JSON structure:", responseText);
            return NextResponse.json({ error: 'AI response format incorrect. Expected { "recommendations": string[] }' }, { status: 500 });
        }
    } catch (parseError: unknown) {
        console.error("Failed to parse Gemini recommendation response as JSON:", parseError, "\nResponse Text:", responseText);
        const errorMessage = parseError instanceof Error ? parseError.message : 'Failed to parse AI recommendation response.';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

  } catch (error: unknown) {
    console.error('Error calling Gemini API for recommendations:', error);
    const message = error instanceof Error ? error.message : 'Failed to get food recommendations.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}