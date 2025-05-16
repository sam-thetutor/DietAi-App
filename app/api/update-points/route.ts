import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    // Get address from query params or request body
    const address = request.nextUrl.searchParams.get('address');
    const body = await request.json();
    
    // Use address from query params or body
    const userAddress = address || body.address;
    
    if (!userAddress) {
      return NextResponse.json({ error: 'Missing wallet address' }, { status: 400 });
    }

    // Connect to MongoDB
    const { db } = await connectToDatabase();
    
    // Update the user's points in the rewards collection
    const result = await db.collection('rewards').updateOne(
      { address: userAddress },
      { 
        $set: { 
          totalPoints: 0,  // Reset points to zero
        },
        $push: { 
          pointsHistory: {
            timestamp: new Date(),
            action: 'claim_tokens',
            points: -body.points || 0,  // Negative points to represent claiming
            description: 'Claimed points for DIET tokens'
          }
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Points updated successfully',
      updatedPoints: 0
    });
    
  } catch (error) {
    console.error('Error updating points:', error);
    return NextResponse.json({ 
      error: 'Failed to update points', 
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
} 