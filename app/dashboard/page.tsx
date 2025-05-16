"use client";
import Link from "next/link";
import { Card, Button } from "../components/DemoComponents";
import { useState, useEffect, useMemo, useRef } from "react";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ReferenceLine
} from 'recharts'; // Import Recharts components
import { useAccount } from "wagmi";
import {
  ConnectWallet,
} from "@coinbase/onchainkit/wallet";
import { useRewards } from "../contexts/RewardsContext";
import RewardsIndicator from "../components/RewardsIndicator";

// Define types for our data
type HealthGoal = "weight_loss" | "weight_gain" | "maintenance";
type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

interface HealthProfile {
  age: string;
  gender: string;
  height: string;
  weight: string;
  goal: HealthGoal;
  activityLevel: ActivityLevel;
  restrictions: string;
  calorieTarget: string;
}

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

interface AllCalories {
  [dateKey: string]: MealCalories;
}

// New Type for Meal Plan
interface MealPlan {
    breakfast: string[];
    lunch: string[];
    supper: string[];
    generatedAt?: Date | string;
    userProfile?: {
        goal?: string;
        calorieTarget?: string;
        restrictions?: string;
    };
    favoriteFoods?: string[];
}

// Helper function to format date as YYYY-MM-DD
const formatDateKey = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Helper to calculate total calories for a meal object
const calculateDailyTotal = (meals: MealCalories | undefined): number => {
  if (!meals) return 0;
  
  let total = 0;
  
  // Sum up breakfast calories
  if (Array.isArray(meals.breakfast)) {
    total += meals.breakfast.reduce((sum, entry) => sum + (entry.calories || 0), 0);
  }
  
  // Sum up lunch calories
  if (Array.isArray(meals.lunch)) {
    total += meals.lunch.reduce((sum, entry) => sum + (entry.calories || 0), 0);
  }
  
  // Sum up supper calories
  if (Array.isArray(meals.supper)) {
    total += meals.supper.reduce((sum, entry) => sum + (entry.calories || 0), 0);
  }
  
  // Sum up snacks calories if they exist
  if (Array.isArray(meals.snacks)) {
    total += meals.snacks.reduce((sum, entry) => sum + (entry.calories || 0), 0);
  }
  
  // Sum up drinks calories if they exist
  if (Array.isArray(meals.drinks)) {
    total += meals.drinks.reduce((sum, entry) => sum + (entry.calories || 0), 0);
  }
  
  return total;
};

export default function DashboardPage() {
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [allCalories, setAllCalories] = useState<AllCalories>({});
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingCalories, setIsLoadingCalories] = useState(true);
  const { address } = useAccount();

  // // --- State for Recommendations ---
  // const [recommendations, setRecommendations] = useState<string[]>([]);
  // const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  // const [errorRecs, setErrorRecs] = useState<string | null>(null);

  // --- State for Meal Plan ---
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [isLoadingMealPlan, setIsLoadingMealPlan] = useState(true);

  const { addPoints, unlockAchievement } = useRewards();

  // Create the ref at the component level, not inside useEffect
  const isFirstMealPlanLoad = useRef(true);

  // Load Profile Data from MongoDB
  useEffect(() => {
    if (!address) {
      setIsLoadingProfile(false);
      return;
    }
    
    setIsLoadingProfile(true);
    
    fetch(`/api/profile?address=${address}`)
      .then(async (response) => {
        if (response.ok) {
          const data = await response.json();
          setProfile(data);
        } else if (response.status === 404) {
          setProfile(null);
        } else {
          console.error("Failed to fetch profile");
        }
      })
      .catch((error) => {
        console.error("Error fetching profile:", error);
      })
      .finally(() => {
        setIsLoadingProfile(false);
      });
  }, [address]);

  // Load Calorie Data from MongoDB
  useEffect(() => {
    if (!address) {
      setIsLoadingCalories(false);
      return;
    }
    
    setIsLoadingCalories(true);
    
    fetch(`/api/calories?address=${address}`)
      .then(async (response) => {
        if (response.ok) {
          const data = await response.json();
          console.log("Calories API response:", data);
          
          // Check if data.calorieData exists and use it
          if (data.calorieData && typeof data.calorieData === 'object') {
            console.log("Setting calorie data with keys:", Object.keys(data.calorieData));
            setAllCalories(data.calorieData);
          } else {
            console.log("No calorie data found in response");
            setAllCalories({});
          }
        } else if (response.status === 404) {
          console.log("Calories API returned 404");
          setAllCalories({});
        } else {
          console.error("Failed to fetch calorie data, status:", response.status);
        }
      })
      .catch((error) => {
        console.error("Error fetching calorie data:", error);
      })
      .finally(() => {
        setIsLoadingCalories(false);
      });
  }, [address]);

  // Load Meal Plan Data from MongoDB
  useEffect(() => {
    if (!address) {
      setIsLoadingMealPlan(false);
      return;
    }
    console.log("Loading meal plan for address:", address);
    
    setIsLoadingMealPlan(true);
    
    fetch(`/api/meal-plan?address=${address}`)
      .then(async (response) => {
        if (response.ok) {
          const data = await response.json();
          console.log("Meal Plan API response:", data);
          setMealPlan(data || null);
          
          // Only award points on first successful load, not on every render
          if (data && isFirstMealPlanLoad.current) {
            isFirstMealPlanLoad.current = false;
            // Use a timeout to prevent state updates during render
            setTimeout(async () => {
              try {
                await addPoints('generate_meal_plan', 15, 'Generated first meal plan');
                await unlockAchievement('generate_meal_plan');
              } catch (error) {
                console.error("Error awarding points:", error);
              }
            }, 100);
          }
        } else if (response.status === 404) {
          setMealPlan(null);
        } else {
          console.error("Failed to fetch meal plan");
        }
      })
      .catch((error) => {
        console.error("Error fetching meal plan:", error);
      })
      .finally(() => {
        setIsLoadingMealPlan(false);
      });
  }, [address, addPoints, unlockAchievement]);

  // Add this function at the beginning of your DashboardPage component
  useEffect(() => {
    // Force refresh of calorie data when the dashboard loads
    if (address) {
      const fetchLatestCalorieData = async () => {
        try {
          setIsLoadingCalories(true);
          const response = await fetch(`/api/calories?address=${address}`);
          
          if (response.ok) {
            const data = await response.json();
            console.log("Latest calorie data:", data);
            setAllCalories(data.calorieData || {});
            
            // Check if today's data exists
            const today = formatDateKey(new Date());
            if (!data.calorieData[today]) {
              console.log("No data found for today:", today);
            } else {
              console.log("Today's data found:", data.calorieData[today]);
            }
          }
        } catch (error) {
          console.error("Error fetching latest calorie data:", error);
        } finally {
          setIsLoadingCalories(false);
        }
      };
      
      fetchLatestCalorieData();
    }
  }, [address]);

  // --- Calculate Analytics ---
  const analytics = useMemo(() => {
    // Calculate today's date key
    const today = new Date();
    const todayKey = formatDateKey(today);
    
    // Get today's data
    const todayData = allCalories[todayKey];
    
    // Calculate today's total
    const todayTotal = calculateDailyTotal(todayData);
    
    // Calculate weekly data (last 7 days)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      last7Days.push(formatDateKey(date));
    }
    
    // Create chart data
    const chartData = last7Days.map(dateKey => {
      const dayName = new Date(dateKey).toLocaleDateString('en-US', { weekday: 'short' });
      const dayData = allCalories[dateKey];
      const calories = calculateDailyTotal(dayData);
      return { name: dayName, calories };
    });
    
    // Calculate weekly total
    const weeklyTotal = chartData.reduce((sum, day) => sum + day.calories, 0);
    
    // Extract common foods from the array structure
    const foodCounts: Map<string, number> = new Map();
    const allFoods: Set<string> = new Set();
    
    Object.values(allCalories).forEach(day => {
      // Type-safe way to iterate through meal types
      const mealTypes = ['breakfast', 'lunch', 'supper', 'snacks', 'drinks'] as const;
      
      mealTypes.forEach(mealType => {
        const meals = day[mealType];
        if (Array.isArray(meals)) {
          meals.forEach(entry => {
            if (entry.items && Array.isArray(entry.items)) {
              entry.items.forEach(item => {
                allFoods.add(item);
                foodCounts.set(item, (foodCounts.get(item) || 0) + 1);
              });
            }
          });
        }
      });
    });
    
    // Get top 10 common foods
    const commonFoods = [...foodCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(entry => entry[0]);
    
    // Get all logged foods (limited to 50)
    const allLoggedFoods = [...allFoods].slice(0, 50);
    
    // Check if user has a calorie target
    const hasTarget = profile && profile.calorieTarget ? true : false;
    const calorieTarget = profile ? parseInt(profile.calorieTarget || '0') : 0;
    
    return {
      todayTotal,
      todayData,
      weeklyTotal,
      chartData,
      commonFoods,
      allLoggedFoods,
      hasTarget,
      calorieTarget
    };
  }, [allCalories, profile]);

  // Loading state
  if (!address) {
    return (
      <div className="flex flex-col min-h-screen font-sans text-green-700 bg-black">
        <div className="w-full max-w-md mx-auto px-4 py-3">
          <header className="flex justify-between items-center mb-6 h-11">
            <Link href="/">
              <h2 className="text-xl font-bold text-green-700 cursor-pointer">DietAI</h2>
            </Link>
            <ConnectWallet />
          </header>
          <div className="text-center py-12">
            <p className="text-lg text-gray-600">Connect your wallet to view your dashboard</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoadingProfile || isLoadingCalories) {
    return (
      <div className="flex flex-col min-h-screen font-sans text-[var(--app-foreground)] mini-app-theme from-[var(--app-background)] to-[var(--app-gray)]">
        <div className="w-full max-w-md mx-auto px-4 py-3">
          <div className="flex justify-center items-center rounded-lg min-h-screen font-sans text-green-700 bg-white">
            <p>Loading Dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen font-sans text-[var(--app-foreground)] mini-app-theme from-[var(--app-background)] to-[var(--app-gray)]">
      <div className="w-full max-w-md mx-auto px-4 py-3">
        <div className="flex flex-col min-h-screen font-sans text-green-700 bg-white rounded-lg">
          <div className="w-full max-w-md mx-auto px-4 py-3">
            <header className="flex justify-between items-center mb-3 h-11">
              <Link href="/">
                <h2 className="text-xl font-bold text-green-700 cursor-pointer">DietAI</h2>
              </Link>
              <div className="flex items-center space-x-3">
                <RewardsIndicator />
                <Link href="/track">
                  <Button variant="outline" size="sm">
                    Track Meals
                  </Button>
                </Link>
              </div>
            </header>

            <main className="space-y-6">
              {/* Today's Meals Card */}
              <Card title="Today's Meals">
                {analytics.todayTotal > 0 ? (
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-lg font-semibold text-green-700">
                        {Array.isArray(analytics.todayData.breakfast) 
                          ? analytics.todayData.breakfast.reduce((sum, entry) => sum + entry.calories, 0)
                          : analytics.todayData.breakfast || 0}
                      </p>
                      <p className="text-xs text-gray-600">🍳 Breakfast</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-green-700">
                        {Array.isArray(analytics.todayData.lunch) 
                          ? analytics.todayData.lunch.reduce((sum, entry) => sum + entry.calories, 0)
                          : analytics.todayData.lunch || 0}
                      </p>
                      <p className="text-xs text-gray-600">🥪 Lunch</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-green-700">
                        {Array.isArray(analytics.todayData.supper) 
                          ? analytics.todayData.supper.reduce((sum, entry) => sum + entry.calories, 0)
                          : analytics.todayData.supper || 0}
                      </p>
                      <p className="text-xs text-gray-600">🍲 Supper</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-gray-600">
                    No calories logged for today yet. Go to the <Link href="/track" className="text-green-600 underline">Track</Link> page!
                  </p>
                )}
              </Card>

              {/* Weekly Trends Card */}
              <Card title="Weekly Trends">
                <div className="space-y-4">
                  <p className="text-sm text-[var(--app-foreground-muted)]">
                    Average daily intake (last 7 days): <span className="font-semibold text-[var(--app-foreground)]">{analytics.chartData.some(d => d.calories > 0) ? Math.round(analytics.chartData.reduce((a, b) => a + b.calories, 0) / analytics.chartData.length) : 0} kcal</span>
                  </p>
                  {analytics.chartData.some(d => d.calories > 0) ? (
                    <div className="h-60 w-full">
                      <ResponsiveContainer>
                        <BarChart data={analytics.chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--app-card-border)" />
                          <XAxis dataKey="name" fontSize={10} stroke="var(--app-foreground-muted)" />
                          <YAxis fontSize={10} stroke="var(--app-foreground-muted)" />
                          <Tooltip cursor={{ fill: 'var(--app-gray)' }} contentStyle={{ backgroundColor: 'var(--app-background)', borderColor: 'var(--app-card-border)', borderRadius: '0.5rem', color: 'var(--app-foreground)' }} />
                          <Bar dataKey="calories" fill="var(--app-accent)" radius={[4, 4, 0, 0]} />
                          {analytics.hasTarget && analytics.calorieTarget > 0 && (
                            <ReferenceLine y={analytics.calorieTarget} label={{ value: "Target", position: "insideTopRight", fill: "var(--app-accent-error)", fontSize: 10, dy: -5 }} stroke="var(--app-accent-error)" strokeDasharray="3 3" strokeWidth={1.5} />
                          )}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-center text-sm text-[var(--app-foreground-muted)]">Log more days to see your weekly trend chart.</p>
                  )}
                </div>
              </Card>

              {/* Food Suggestions Card
              <Card title="">
                {isLoadingRecs && (
                  <div className="flex justify-center items-center py-4">
                    <svg className="animate-spin h-5 w-5 text-[var(--app-foreground-muted)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="ml-2 text-sm text-[var(--app-foreground-muted)]">Generating suggestions...</span>
                  </div>
                )}
                {errorRecs && <p className="text-center text-sm text-red-500 px-2 py-4">{errorRecs}</p>}
                {!isLoadingRecs && !errorRecs && recommendations.length > 0 && (
                  <ul className="space-y-2 list-none text-sm text-[var(--app-foreground)] p-1">
                    {recommendations.map((rec, index) => (
                      <li key={index} className="border-b border-[var(--app-card-border)] pb-1 mb-1 last:border-b-0 last:pb-0 last:mb-0">
                        {rec}
                      </li>
                    ))}
                  </ul>
                )}
                {!isLoadingRecs && !errorRecs && recommendations.length === 0 && (
                  <>
                    {profile?.goal && analytics.commonFoods.length > 0 && (
                      <p className="text-center text-sm text-[var(--app-foreground-muted)] px-2 py-4">No specific suggestions generated currently. Try logging more varied meals!</p>
                    )}
                    {(!profile?.goal || analytics.commonFoods.length === 0) && (
                      <p className="text-center text-sm text-[var(--app-foreground-muted)] px-2 py-4">
                        Set a health goal in your <Link href="/profile" className="text-[var(--app-accent)] underline">Profile</Link> and log some meals via the <Link href="/track" className="text-[var(--app-accent)] underline">Track</Link> page to get personalized dietary suggestions.
                      </p>
                    )}
                  </>
                )}
              </Card> */}

              {/* AI Meal Plan Card */}
              <Card title="📅 AI Meal Plan Suggestions">
                {mealPlan ? (
                  <div className="space-y-4">
                    {/* Meal Plan Metadata */}
                    {mealPlan.generatedAt && (
                      <div className="text-xs text-[var(--app-foreground-muted)] mb-2">
                        <p>Generated: {new Date(mealPlan.generatedAt).toLocaleDateString()}</p>
                        {mealPlan.userProfile?.goal && (
                          <p>Based on: {mealPlan.userProfile.goal} goal, {mealPlan.userProfile.calorieTarget} calories</p>
                        )}
                        {mealPlan.favoriteFoods && mealPlan.favoriteFoods.length > 0 && (
                          <p>Favorite foods: {mealPlan.favoriteFoods.join(', ')}</p>
                        )}
                      </div>
                    )}
                    
                    <div>
                      <h4 className="font-semibold mb-2 border-b border-[var(--app-card-border)] pb-1">🍳 Breakfast</h4>
                      <ul className="space-y-1 list-disc list-inside text-sm text-[var(--app-foreground)]">
                        {mealPlan.breakfast.map((meal, index) => <li key={`b-${index}`}>{meal}</li>)}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2 border-b border-[var(--app-card-border)] pb-1">🥪 Lunch</h4>
                      <ul className="space-y-1 list-disc list-inside text-sm text-[var(--app-foreground)]">
                        {mealPlan.lunch.map((meal, index) => <li key={`l-${index}`}>{meal}</li>)}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2 border-b border-[var(--app-card-border)] pb-1">🍲 Supper</h4>
                      <ul className="space-y-1 list-disc list-inside text-sm text-[var(--app-foreground)]">
                        {mealPlan.supper.map((meal, index) => <li key={`s-${index}`}>{meal}</li>)}
                      </ul>
                    </div>
                    
                    {/* Refresh Button */}
                    <div className="flex justify-center mt-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setIsLoadingMealPlan(true);
                          fetch('/api/meal-plan', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ address })
                          })
                          .then(response => response.json())
                          .then(data => {
                            setMealPlan(data);
                            // Use a timeout to prevent state updates during render
                            setTimeout(async () => {
                              try {
                                await addPoints('refresh_meal_plan', 10, 'Refreshed meal plan');
                              } catch (error) {
                                console.error("Error awarding points:", error);
                              }
                            }, 100);
                          })
                          .catch(error => {
                            console.error("Error refreshing meal plan:", error);
                          })
                          .finally(() => {
                            setIsLoadingMealPlan(false);
                          });
                        }}
                        disabled={isLoadingMealPlan}
                      >
                        {isLoadingMealPlan ? (
                          <span className="flex items-center">
                            <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Refreshing...
                          </span>
                        ) : (
                          <span className="flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Refresh Meal Plan
                          </span>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-sm text-[var(--app-foreground-muted)] px-2 py-4">
                    No meal plan generated yet. Uploading images of new foods on the <Link href="/track" className="text-[var(--app-accent)] underline">Track</Link> page will generate one based on your profile and history.
                  </p>
                )}
              </Card>

              {/* Common Foods Card */}
              <Card title="Common Foods">
                {analytics.commonFoods.length > 0 ? (
                  <ul className="space-y-1 list-disc list-inside text-sm text-[var(--app-foreground)]">
                    {analytics.commonFoods.map((item, index) => (
                      <li key={index} className="capitalize">{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-center text-sm text-[var(--app-foreground-muted)]">
                    Upload images of your meals on the <Link href="/track" className="text-[var(--app-accent)] underline">Track</Link> page for AI to identify common foods.
                  </p>
                )}
              </Card>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}