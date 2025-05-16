// Remove @ts-nocheck

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// Using gemini-1.5-flash as it's generally good for vision tasks and faster/cheaper
// Ensure this model is available and suitable for your use case.
// Fallback could be "gemini-pro-vision" if needed.
const MODEL_NAME = "gemini-1.5-flash";
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("Error: GEMINI_API_KEY environment variable is not set.");
}

console.log("API Key present:", !!process.env.GEMINI_API_KEY);

export async function POST(request: Request) {
  if (!API_KEY) {
    return NextResponse.json({ error: 'API key not configured.' }, { status: 500 });
  }
  console.log("--- API /api/analyze-image received request ---"); // Log request start

  let requestBody;
  try {
    // --- START: Detailed Request Body Logging ---
    // Clone the request to read the body safely multiple times if needed
    const clonedRequest = request.clone();
    try {
        requestBody = await clonedRequest.json();
        console.log("Received JSON body:", JSON.stringify(requestBody, null, 2)); // Log the parsed JSON
    } catch (jsonError) {
        console.error("Failed to parse request body as JSON:", jsonError);
        // Try reading as text if JSON parsing fails
        try {
            const textBody = await request.text(); // Use original request here
            console.log("Received body as text (potential issue):", textBody.substring(0, 500) + (textBody.length > 500 ? "..." : ""));
        } catch (textError) {
            console.error("Failed to read request body as text:", textError);
        }
        return NextResponse.json({ error: 'Invalid request body format. Expected JSON.' }, { status: 400 });
    }
    // --- END: Detailed Request Body Logging ---

    // Check if the 'image' property exists in the parsed body
    if (!requestBody || typeof requestBody !== 'object' || !('image' in requestBody)) {
        console.error("Request body is missing 'image' property.");
        return NextResponse.json({ error: "Request body must contain an 'image' property." }, { status: 400 });
    }

    const imageData = requestBody.image;

    // --- START: Image Data Validation Logging ---
    console.log("Extracted imageData type:", typeof imageData);
    if (typeof imageData === 'string') {
        console.log("imageData starts with:", imageData.substring(0, 70)); // Log start of string
        console.log("imageData length:", imageData.length); // Log length
    } else {
        console.log("imageData is not a string.");
    }
    // --- END: Image Data Validation Logging ---

    // Validate the image data format (Data URL)
    if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image/')) {
      console.error("Validation Failed: Invalid image data format received."); // More specific log
      return NextResponse.json({ error: 'Invalid image data provided. Expected data URL string.' }, { status: 400 });
    }
    console.log("Image data format validation passed."); // Log success

    // Extract mime type and base64 data (rest of the function remains the same)
    const mimeTypeMatch = imageData.match(/^data:(image\/\w+);base64,/);
    if (!mimeTypeMatch) {
        console.error("Could not extract mime type from data URL.");
        return NextResponse.json({ error: 'Invalid image data URL format.' }, { status: 400 });
    }
    const mimeType = mimeTypeMatch[1];
    const base64Data = imageData.substring(mimeTypeMatch[0].length);

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const generationConfig = {
      temperature: 0.3, // Slightly higher temp might help identify more items, adjust if needed
      topK: 32,
      topP: 1,
      maxOutputTokens: 4096,
      // Ensure response format is JSON
      responseMimeType: "application/json",
    };

    const safetySettings = [
      // Keep safety settings as before
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ];

    const parts = [
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Data
        },
      },
      {
        // Updated prompt asking for items and calories in JSON
        text: `Analyze the food item(s) in this image. Identify the main distinct food items visible (e.g., "apple", "sandwich", "salad"). Estimate the total calories for the entire portion shown. Respond ONLY with a valid JSON object containing two keys: "estimatedCalories" (numerical value or null if unknown) and "foodItems" (an array of strings representing the identified food items, or an empty array [] if none identified). Example: {"estimatedCalories": 450, "foodItems": ["chicken sandwich", "side salad"]} dont put the word simulated anywhere on your re`
      },
    ];

    console.log(`Sending request to Gemini (${MODEL_NAME}) for image analysis... MimeType: ${mimeType}`);
    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig,
      safetySettings,
    });

    // Log the raw response for debugging
    // console.log("Raw Gemini Response:", JSON.stringify(result.response, null, 2));

    // Check for blocked content
    if (!result.response || !result.response.candidates || result.response.candidates.length === 0 || !result.response.candidates[0].content) {
        const blockReason = result.response?.promptFeedback?.blockReason;
        console.error("Gemini response blocked or empty. Reason:", blockReason || "Unknown");
        const errorMessage = blockReason ? `Content blocked by AI safety filters (${blockReason}).` : 'AI response was empty or blocked.';
        return NextResponse.json({ error: errorMessage }, { status: 400 }); // Use 400 for blocked content
    }

    const responseText = result.response.text(); // text() should work even with responseMimeType: "application/json"
    console.log("Gemini Response Text:", responseText);

    try {
        const jsonResponse = JSON.parse(responseText);

        // Validate the structure
        if (jsonResponse && typeof jsonResponse.estimatedCalories !== 'undefined' && Array.isArray(jsonResponse.foodItems)) {
             const calories : number | null = jsonResponse.estimatedCalories === null ? null : Number(jsonResponse.estimatedCalories);
             const foodItems : string[] = jsonResponse.foodItems.filter((item: string) => typeof item === 'string'); // Ensure items are strings

             if (calories === null || !isNaN(calories)) {
                console.log("Parsed Response:", { estimatedCalories: calories, foodItems: foodItems });
                // Return both calories and items
                return NextResponse.json({ estimatedCalories: calories, foodItems: foodItems });
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
        // Attempt to extract potential error message from the raw text if parsing fails
        const genericErrorMatch = responseText.match(/"error":\s*"([^"]+)"/);
        const errorMessage = genericErrorMatch ? genericErrorMatch[1] : 'Failed to parse AI response.';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

  } catch (error: unknown) {
    console.error('--- Uncaught Error in /api/analyze-image ---:', error); // Log any other errors
    const message = error instanceof Error ? error.message : 'Failed to analyze image due to server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 