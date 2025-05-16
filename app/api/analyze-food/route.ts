import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// Using gemini-1.5-flash as it's generally good for vision tasks and faster/cheaper
const MODEL_NAME = "gemini-1.5-flash";
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("Error: GEMINI_API_KEY environment variable is not set.");
}

export async function POST(request: Request) {
  if (!API_KEY) {
    return NextResponse.json({ error: 'API key not configured.' }, { status: 500 });
  }
  console.log("--- API /api/analyze-food received request ---");

  let requestBody;
  try {
    // Clone the request to read the body safely
    const clonedRequest = request.clone();
    try {
        requestBody = await clonedRequest.json();
        console.log("Received JSON body:", JSON.stringify(requestBody, null, 2));
    } catch (jsonError) {
        console.error("Failed to parse request body as JSON:", jsonError);
        try {
            const textBody = await request.text();
            console.log("Received body as text (potential issue):", textBody.substring(0, 500) + (textBody.length > 500 ? "..." : ""));
        } catch (textError) {
            console.error("Failed to read request body as text:", textError);
        }
        return NextResponse.json({ error: 'Invalid request body format. Expected JSON.' }, { status: 400 });
    }

    // Check if the 'image' property exists in the parsed body
    if (!requestBody || typeof requestBody !== 'object' || !('image' in requestBody)) {
        console.error("Request body is missing 'image' property.");
        return NextResponse.json({ error: "Request body must contain an 'image' property." }, { status: 400 });
    }

    const imageData = requestBody.image;

    // Log image data info for debugging
    console.log("Extracted imageData type:", typeof imageData);
    if (typeof imageData === 'string') {
        console.log("imageData starts with:", imageData.substring(0, 70));
        console.log("imageData length:", imageData.length);
    } else {
        console.log("imageData is not a string.");
    }

    // Validate the image data format (Data URL)
    if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image/')) {
      console.error("Validation Failed: Invalid image data format received.");
      return NextResponse.json({ error: 'Invalid image data provided. Expected data URL string.' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const generationConfig = {
      temperature: 0.2,
      topK: 32,
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

    // Prepare the prompt parts
    const parts = [
      { text: `Analyze this food image and identify all food items present. 
      
      Provide your response as a valid JSON object with the following structure:
      {
        "estimatedCalories": number | null,
        "foodItems": string[]
      }
      
      Guidelines:
      - For estimatedCalories: Provide your best estimate of the total calories in the entire meal/food shown. If you cannot reasonably estimate, use null.
      - For foodItems: List all identifiable food items as an array of strings. Be specific but concise.
      - Respond ONLY with the JSON object, no additional text.` },
      { inlineData: { mimeType: "image/jpeg", data: imageData.split(',')[1] } }
    ];

    console.log(`Sending request to Gemini (${MODEL_NAME}) for food analysis...`);

    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig,
      safetySettings,
    });

    // Check for blocked content
    if (!result.response || !result.response.candidates || result.response.candidates.length === 0 || !result.response.candidates[0].content) {
        const blockReason = result.response?.promptFeedback?.blockReason;
        console.error("Gemini response blocked or empty. Reason:", blockReason || "Unknown");
        const errorMessage = blockReason ? `Content blocked by AI safety filters (${blockReason}).` : 'AI response was empty or blocked.';
        return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const responseText = result.response.text();
    console.log("Gemini Response Text:", responseText);

    try {
        const jsonResponse = JSON.parse(responseText);

        // Validate the structure
        if (jsonResponse && typeof jsonResponse.estimatedCalories !== 'undefined' && Array.isArray(jsonResponse.foodItems)) {
             const calories = jsonResponse.estimatedCalories === null ? null : Number(jsonResponse.estimatedCalories);
             const foodItems = jsonResponse.foodItems.filter((item: string) => typeof item === 'string');

             if (calories === null || !isNaN(calories)) {
                console.log("Parsed Response:", { calories, items: foodItems });
                // Return both calories and items
                return NextResponse.json({ calories, items: foodItems });
             } else {
                 console.error("Gemini returned non-numeric/null calorie value in JSON:", jsonResponse.estimatedCalories);
                 return NextResponse.json({ error: 'AI returned an invalid calorie value.' }, { status: 500 });
             }
        } else {
            console.error("Gemini response did not contain expected JSON structure:", responseText);
            return NextResponse.json({ error: 'AI response format incorrect. Expected { "estimatedCalories": number|null, "foodItems": string[] }' }, { status: 500 });
        }
    } catch (parseError) {
        console.error("Failed to parse Gemini response as JSON:", parseError, "\nResponse Text:", responseText);
        const genericErrorMatch = responseText.match(/"error":\s*"([^"]+)"/);
        const errorMessage = genericErrorMatch ? genericErrorMatch[1] : 'Failed to parse AI response.';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

  } catch (error: unknown) {
    console.error('--- Uncaught Error in /api/analyze-food ---:', error);
    const message = error instanceof Error ? error.message : 'Failed to analyze image due to server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 