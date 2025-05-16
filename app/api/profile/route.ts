import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    // Get address from query params
    const address = request.nextUrl.searchParams.get('address');
    
    if (!address) {
      return NextResponse.json({ error: 'Missing wallet address' }, { status: 400 });
    }

    // Connect to MongoDB
    const { db } = await connectToDatabase();
    
    // Find the profile data for this user
    const userData = await db.collection('profiles').findOne({ address });
    
    if (!userData) {
      return NextResponse.json({ 
        age: "",
        gender: "",
        height: "",
        weight: "",
        goal: "maintenance",
        activityLevel: "moderate",
        restrictions: "",
        calorieTarget: ""
      });
    }
    
    return NextResponse.json(userData.profile);
    
  } catch (error) {
    console.error('Error retrieving profile data:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch profile', 
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { address, profile } = await request.json();

    if (!address) {
      return NextResponse.json({ error: 'Missing wallet address' }, { status: 400 });
    }

    if (!profile || typeof profile !== 'object') {
      return NextResponse.json({ error: 'Invalid profile data format' }, { status: 400 });
    }

    // Connect to MongoDB
    const { db } = await connectToDatabase();
    
    // Update or insert the profile data for this user
    const result = await db.collection('profiles').updateOne(
      { address },
      { $set: { address, profile, updatedAt: new Date() } },
      { upsert: true }
    );

    return NextResponse.json({ 
      success: true, 
      message: result.upsertedCount > 0 ? 'Profile created' : 'Profile updated' 
    });
    
  } catch (error) {
    console.error('Error saving profile data:', error);
    return NextResponse.json({ 
      error: 'Failed to save profile data', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 