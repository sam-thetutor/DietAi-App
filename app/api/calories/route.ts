import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';


export async function POST(request: NextRequest) {
  try {
    const { address, calorieData } = await request.json();
    
    console.log("POST /api/calories - Received data:", { address, dataSize: Object.keys(calorieData || {}).length });

    if (!address) {
      return NextResponse.json({ error: 'Missing wallet address' }, { status: 400 });
    }

    if (!calorieData || typeof calorieData !== 'object') {
      return NextResponse.json({ error: 'Invalid calorie data format' }, { status: 400 });
    }

    // Connect to MongoDB
    const { db } = await connectToDatabase();
    
    // Update or insert the calorie data for this user
    const result = await db.collection('calories').updateOne(
      { address },
      { $set: { address, calorieData, updatedAt: new Date() } },
      { upsert: true }
    );

    console.log("POST /api/calories - Save result:", { 
      matched: result.matchedCount, 
      modified: result.modifiedCount,
      upserted: result.upsertedCount
    });

    return NextResponse.json({ 
      success: true, 
      message: result.upsertedCount > 0 ? 'Calorie data created' : 'Calorie data updated' 
    });
    
  } catch (error) {
    console.error('Error saving calorie data:', error);
    return NextResponse.json({ 
      error: 'Failed to save calorie data', 
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get address from query params
    const address = request.nextUrl.searchParams.get('address');
    
    console.log("GET /api/calories - Request for address:", address);
    
    if (!address) {
      return NextResponse.json({ error: 'Missing wallet address' }, { status: 400 });
    }

    // Connect to MongoDB
    const { db } = await connectToDatabase();
    
    // Find the calorie data for this user
    const userData = await db.collection('calories').findOne({ address });
    
    console.log("GET /api/calories - Found data:", userData ? "Yes" : "No");
    
    if (!userData) {
      return NextResponse.json({ calorieData: {} }); // Return empty object if no data found
    }
    
    console.log("GET /api/calories - Returning data with keys:", Object.keys(userData.calorieData || {}));
    
    return NextResponse.json({ calorieData: userData.calorieData });
    
  } catch (error) {
    console.error('Error retrieving calorie data:', error);
    return NextResponse.json({ 
      error: 'Failed to retrieve calorie data', 
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
} 