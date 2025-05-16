"use client";

import { useEffect, useState, useRef } from "react";
import { Button, Card } from "../components/DemoComponents";
import Link from "next/link";
import { useAccount } from "wagmi";
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; // Default styling for the calendar
import CameraModal from './CameraModal';
import { toast } from "react-hot-toast";
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

// Helper function to format date as YYYY-MM-DD
const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// First, add this function to calculate total calories for a day
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
  
  return total;
};

export default function TrackPage() {
  const { address } = useAccount();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [allCalories, setAllCalories] = useState<AllCalories>({});
  const [currentCalories, setCurrentCalories] = useState<MealCalories>({
    breakfast: [],
    lunch: [],
    supper: [],
    snacks: [],
    drinks: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<HealthProfile | null>(null);

  // State for Camera Modal
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [currentMealType, setCurrentMealType] = useState<'breakfast' | 'lunch' | 'supper' | null>(null);

  // State for AI analysis loading
  const [isAnalyzing, setIsAnalyzing] = useState<null | 'breakfast' | 'lunch' | 'supper'>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // State for Save Changes loading
  const [isSaving, setIsSaving] = useState(false);

  // Refs for hidden file inputs
  const breakfastFileRef = useRef<HTMLInputElement>(null);
  const lunchFileRef = useRef<HTMLInputElement>(null);
  const supperFileRef = useRef<HTMLInputElement>(null);

  const { addPoints, unlockAchievement } = useRewards();
  
  // Update the useEffect for loading data for the selected date
  useEffect(() => {
    const dateKey = formatDateKey(selectedDate);
    const dayData = allCalories[dateKey];
    
    console.log(`Loading data for date: ${dateKey}`, dayData);
    
    // Initialize with empty arrays for all meal types
    const newCurrentCalories = {
      breakfast: [],
      lunch: [],
      supper: [],
      snacks: [],
      drinks: [],
    };
    
    // If we have data for this date, populate it
    if (dayData) {
      // Handle breakfast data
      if (Array.isArray(dayData.breakfast)) {
        newCurrentCalories.breakfast = [...dayData.breakfast];
      }
      
      // Handle lunch data
      if (Array.isArray(dayData.lunch)) {
        newCurrentCalories.lunch = [...dayData.lunch];
      }
      
      // Handle supper data
      if (Array.isArray(dayData.supper)) {
        newCurrentCalories.supper = [...dayData.supper];
      }
      
      // Handle snacks data if it exists
      if (Array.isArray(dayData.snacks)) {
        newCurrentCalories.snacks = [...dayData.snacks];
      }
      
      // Handle drinks data if it exists
      if (Array.isArray(dayData.drinks)) {
        newCurrentCalories.drinks = [...dayData.drinks];
      }
    }
    
    setCurrentCalories(newCurrentCalories);
  }, [selectedDate, allCalories]);

  // Update the initial data loading function
  useEffect(() => {
    const loadInitialData = async () => {
      if (!address) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        // Load Profile from API
        const profileResponse = await fetch(`/api/profile?address=${address}`);
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          setProfile(profileData);
        }

        // Load Calories from API
        const caloriesResponse = await fetch(`/api/calories?address=${address}`);
        if (caloriesResponse.ok) {
          const caloriesData = await caloriesResponse.json();
          console.log("Loaded calorie data from API:", caloriesData);
          
          // Check if data.calorieData exists and use it
          if (caloriesData.calorieData && typeof caloriesData.calorieData === 'object') {
            console.log("Setting calorie data with keys:", Object.keys(caloriesData.calorieData));
            setAllCalories(caloriesData.calorieData);
          } else {
            console.log("No calorie data found in response");
          }
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [address]);

  // Handle file input change
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, mealType: 'breakfast' | 'lunch' | 'supper') => {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = '';
    setIsAnalyzing(mealType);
    setAnalysisError(null);

    try {
      const imageDataUrl = await readFileAsDataURL(file);
      await handleCaptureSuccess(imageDataUrl, mealType);
    } catch (error: any) {
      console.error("Error processing file:", error);
      setAnalysisError(error.message || "Failed to process file");
      setIsAnalyzing(null);
    }
  };

  // Helper function to read file as Data URL
  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        return reject(new Error("Invalid file type. Please select an image."));
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string' && reader.result.startsWith('data:image/')) {
          resolve(reader.result);
        } else {
          reject(new Error("Failed to read file as valid image data URL."));
        }
      };
      reader.onerror = () => {
        reject(new Error("Error reading file."));
      };
      reader.readAsDataURL(file);
    });
  };

  // Modify the handleCaptureSuccess function to not save automatically
  const handleCaptureSuccess = async (imageDataUrl: string, mealType: 'breakfast' | 'lunch' | 'supper') => {
    setCurrentMealType(mealType);
    setIsAnalyzing(mealType);
    
    try {
      // Call the API to analyze the image
      const response = await fetch('/api/analyze-food', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imageDataUrl }),
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      const data = await response.json();
      console.log("AI Analysis Result:", data);
      
      // Update the current calories state with the new data
      // But don't save to the database yet
      setCurrentCalories(prev => {
        const newCalories = { ...prev };
        
        // Create a new entry
        const newEntry = {
          calories: data.calories || 0,
          items: data.items || [],
          timestamp: new Date().toISOString(),
          imageUrl: imageDataUrl,
        };
        
        // Add the new entry to the appropriate meal type
        if (Array.isArray(newCalories[mealType])) {
          newCalories[mealType] = [...newCalories[mealType], newEntry];
        } else {
          newCalories[mealType] = [newEntry];
        }
        
        return newCalories;
      });
      
      // Show success message
      toast.success(`${mealType.charAt(0).toUpperCase() + mealType.slice(1)} analyzed successfully!`);
      
      // Award points for uploading a meal photo
      // But don't save to database yet - this will happen when they click save
      try {
        await addPoints('upload_meal_photo', 5, 'Uploaded a meal photo');
      } catch (error) {
        console.error("Error awarding points:", error);
      }
      
    } catch (error) {
      console.error("Error analyzing image:", error);
      toast.error("Failed to analyze image. Please try again.");
    } finally {
      setIsAnalyzing(null);
    }
  };

  // Modify the handleSaveChanges function to save everything at once
  const handleSaveChanges = async () => {
    if (!address) {
      toast.error("Please connect your wallet to save data");
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Format the date key
      const dateKey = formatDateKey(selectedDate);
      
      // Create a copy of the allCalories object
      const updatedAllCalories = { ...allCalories };
      
      // Update or add the data for the selected date
      updatedAllCalories[dateKey] = currentCalories;
      
      // Save to the database
      const response = await fetch('/api/calories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address,
          calorieData: updatedAllCalories,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      // Update the local state
      setAllCalories(updatedAllCalories);
      
      // Show success message
      toast.success("Meal data saved successfully!");
      
      // Award points for logging meals
      try {
        // Check which meal types have data
        const hasMeals = {
          breakfast: Array.isArray(currentCalories.breakfast) && currentCalories.breakfast.length > 0,
          lunch: Array.isArray(currentCalories.lunch) && currentCalories.lunch.length > 0,
          supper: Array.isArray(currentCalories.supper) && currentCalories.supper.length > 0,
        };
        
        // Award points for each meal type
        if (hasMeals.breakfast) {
          await addPoints('log_breakfast', 10, 'Logged breakfast');
        }
        if (hasMeals.lunch) {
          await addPoints('log_lunch', 10, 'Logged lunch');
        }
        if (hasMeals.supper) {
          await addPoints('log_supper', 10, 'Logged dinner');
        }
        
        // Check for first meal achievement
        if (hasMeals.breakfast || hasMeals.lunch || hasMeals.supper) {
          await unlockAchievement('first_meal');
        }
        
        // Check for try 10 foods achievement
        const allFoods = new Set();
        
        Object.values(allCalories).forEach(day => {
          ['breakfast', 'lunch', 'supper'].forEach(meal => {
            if (Array.isArray(day[meal])) {
              day[meal].forEach(entry => {
                if (entry.items) {
                  entry.items.forEach(item => allFoods.add(item));
                }
              });
            }
          });
        });
        
        // Add current items
        Object.values(currentCalories).forEach(mealEntries => {
          if (Array.isArray(mealEntries)) {
            mealEntries.forEach(entry => {
              if (entry.items) {
                entry.items.forEach(item => allFoods.add(item));
              }
            });
          }
        });
        
        // Check if we've reached 10 unique foods
        if (allFoods.size >= 10) {
          await unlockAchievement('try_10_foods');
        }
        
      } catch (error) {
        console.error("Error awarding points:", error);
      }
      
    } catch (error) {
      console.error("Error saving data:", error);
      toast.error("Failed to save data. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle upload click
  const handleUploadClick = (mealType: 'breakfast' | 'lunch' | 'supper') => {
    setCurrentMealType(mealType);
    if (mealType === 'breakfast' && breakfastFileRef.current) {
      breakfastFileRef.current.click();
    } else if (mealType === 'lunch' && lunchFileRef.current) {
      lunchFileRef.current.click();
    } else if (mealType === 'supper' && supperFileRef.current) {
      supperFileRef.current.click();
    }
  };

  // Open camera
  const openCamera = (mealType: 'breakfast' | 'lunch' | 'supper') => {
    setCurrentMealType(mealType);
    setIsCameraModalOpen(true);
  };

  // Calculate total calories for the day
  const totalCalories = currentCalories.breakfast.reduce((sum, item) => sum + item.calories, 0) +
                        currentCalories.lunch.reduce((sum, item) => sum + item.calories, 0) +
                        currentCalories.supper.reduce((sum, item) => sum + item.calories, 0);

  // Then update the tileContent function to show calories
  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    // Only add content to month view
    if (view !== 'month') return null;
    
    const dateKey = formatDateKey(date);
    const dayData = allCalories[dateKey];
    
    if (!dayData) return null;
    
    const totalCalories = calculateDailyTotal(dayData);
    
    if (totalCalories <= 0) return null;
    
    return (
      <div className="calendar-tile-content">
        <div className="calories-indicator">{totalCalories}</div>
      </div>
    );
  };

  // Styling classes
  const labelClasses = "block text-sm font-medium text-gray-600 mb-1";

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen font-sans text-[var(--app-foreground)] mini-app-theme from-[var(--app-background)] to-[var(--app-gray)]">
      <div className="w-full max-w-md mx-auto px-4 py-3">
        

      <div className="flex justify-center items-center bg-white min-h-screen">
        <svg className="animate-spin h-10 w-10 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="ml-2 text-lg text-gray-600">Loading...</span>
      </div>
      </div>
      </div>
    );
  }

  return (
    <>
     <div className="flex flex-col min-h-screen font-sans text-[var(--app-foreground)] mini-app-theme from-[var(--app-background)] to-[var(--app-gray)]">
      <div className="w-full max-w-md mx-auto px-4 py-3">
        

    
      <div className="min-h-screen bg-white rounded-lg text-gray-800">
        <div className="container mx-auto px-4 py-8 max-w-md">
          {/* Header */}
          <header className="mb-6 flex justify-between items-center">
            <div>
              <Link href="/">
                <h2 className="text-xl font-bold text-green-700 cursor-pointer">DietAI</h2>
              </Link>
            </div>
            <div className="flex items-center space-x-3">
              <RewardsIndicator />
              <Link href="/dashboard">
                <Button variant="outline" size="sm">Dashboard</Button>
              </Link>
            </div>
          </header>

          {/* Calendar Section */}
          <section className="mb-6">
            <Card title="Select Date">
              <div className="calorie-calendar-container">
                <Calendar
                  onChange={setSelectedDate}
                  value={selectedDate}
                  maxDate={new Date()}
                  tileContent={tileContent}
                  tileClassName={({ date, view }) => {
                    if (view !== 'month') return '';
                    const dateKey = formatDateKey(date);
                    return allCalories[dateKey] && calculateDailyTotal(allCalories[dateKey]) > 0 ? 'has-data' : '';
                  }}
                  className="w-full border-none"
                />
              </div>
            </Card>
          </section>

          {/* Calorie Logging Card */}
          <section className="mb-6">
            <Card title={`Log for ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}>
              <div className="space-y-4">
                {/* Display Total for the day */}
                <div className="text-center p-3 bg-gray-50 rounded-lg mb-4">
                  <p className="text-sm text-gray-600">Total Calories Logged</p>
                  <p className="text-3xl font-bold text-green-600">{totalCalories}</p>
                  {profile?.calorieTarget && (
                    <p className="text-xs text-gray-500 mt-1">
                      Target: {profile.calorieTarget} kcal
                    </p>
                  )}
                </div>

                {/* Error message */}
                {analysisError && (
                  <div className="text-center p-2 bg-red-100 text-red-700 rounded-md text-sm">
                    {analysisError}
                  </div>
                )}

                {/* Breakfast Input Group */}
                <div>
                  <label htmlFor="breakfast" className={labelClasses}>🍳 Breakfast</label>
                  <div className="space-y-2">
                    {currentCalories.breakfast.map((entry, index) => (
                      <div key={`breakfast-${index}`} className="p-2 bg-gray-50 rounded-md">
                        <p className="font-medium">{entry.calories} kcal</p>
                        <p className="text-sm text-gray-600">{entry.items.join(', ')}</p>
                      </div>
                    ))}
                    <div className="flex items-center space-x-2">
                      <input type="file" ref={breakfastFileRef} onChange={(e) => handleFileChange(e, 'breakfast')} accept="image/*" className="hidden" />
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => handleUploadClick('breakfast')} 
                        disabled={!!isAnalyzing}
                        className="flex-1"
                      >
                        {isAnalyzing === 'breakfast' ? (
                          <span className="flex items-center justify-center">
                            <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Analyzing...
                          </span>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            Upload Photo
                          </>
                        )}
                      </Button>
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => openCamera('breakfast')} 
                        disabled={!!isAnalyzing}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Lunch Input Group */}
                <div>
                  <label htmlFor="lunch" className={labelClasses}>🥪 Lunch</label>
                  <div className="space-y-2">
                    {currentCalories.lunch.map((entry, index) => (
                      <div key={`lunch-${index}`} className="p-2 bg-gray-50 rounded-md">
                        <p className="font-medium">{entry.calories} kcal</p>
                        <p className="text-sm text-gray-600">{entry.items.join(', ')}</p>
                      </div>
                    ))}
                    <div className="flex items-center space-x-2">
                      <input type="file" ref={lunchFileRef} onChange={(e) => handleFileChange(e, 'lunch')} accept="image/*" className="hidden" />
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => handleUploadClick('lunch')} 
                        disabled={!!isAnalyzing}
                        className="flex-1"
                      >
                        {isAnalyzing === 'lunch' ? (
                          <span className="flex items-center justify-center">
                            <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Analyzing...
                          </span>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            Upload Photo
                          </>
                        )}
                      </Button>
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => openCamera('lunch')} 
                        disabled={!!isAnalyzing}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Supper Input Group */}
                <div>
                  <label htmlFor="supper" className={labelClasses}>🍲 Supper</label>
                  <div className="space-y-2">
                    {currentCalories.supper.map((entry, index) => (
                      <div key={`supper-${index}`} className="p-2 bg-gray-50 rounded-md">
                        <p className="font-medium">{entry.calories} kcal</p>
                        <p className="text-sm text-gray-600">{entry.items.join(', ')}</p>
                      </div>
                    ))}
                    <div className="flex items-center space-x-2">
                      <input type="file" ref={supperFileRef} onChange={(e) => handleFileChange(e, 'supper')} accept="image/*" className="hidden" />
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => handleUploadClick('supper')} 
                        disabled={!!isAnalyzing}
                        className="flex-1"
                      >
                        {isAnalyzing === 'supper' ? (
                          <span className="flex items-center justify-center">
                            <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Analyzing...
                          </span>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            Upload Photo
                          </>
                        )}
                      </Button>
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => openCamera('supper')} 
                        disabled={!!isAnalyzing}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <Button 
                  onClick={handleSaveChanges} 
                  variant="primary" 
                  className="w-full flex justify-center items-center" 
                  disabled={isSaving || !!isAnalyzing}
                >
                  {isSaving ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    `Save Changes for ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                  )}
                </Button>
              </div>
            </Card>
          </section>
        </div>
        </div>
        </div>

        {/* Custom Calendar Styles */}
        <style jsx global>{`
          .react-calendar {
            background-color: transparent !important;
            border: none !important;
          }
          .react-calendar__tile {
            color: #374151;
            background-color: transparent;
            border-radius: 0.375rem;
            position: relative;
            height: 40px;
          }
          .react-calendar__tile:hover {
            background-color: #f3f4f6;
          }
          .react-calendar__month-view__days__day--neighboringMonth {
            color: #9ca3af !important;
            opacity: 0.5;
          }
          .react-calendar__navigation button {
            color: #059669;
            font-weight: bold;
          }
          .react-calendar__navigation button:disabled {
            color: #9ca3af;
            opacity: 0.6;
          }
          .react-calendar__tile--active {
            background-color: #059669 !important;
            color: white !important;
            font-weight: bold;
          }
          .react-calendar__tile--now {
            background-color: transparent !important;
            color: #059669 !important;
            font-weight: bold;
            border: 1px solid #059669;
          }
          .react-calendar__tile.has-data {
            position: relative;
          }
          .react-calendar__tile.has-data::after {
            display: none;
          }
          .react-calendar__tile--disabled {
            background-color: transparent !important;
            color: #9ca3af !important;
            opacity: 0.6;
            pointer-events: none;
          }
          .calendar-tile-content {
            display: flex;
            justify-content: center;
            align-items: flex-end;
            height: 100%;
            width: 100%;
            position: absolute;
            bottom: 0;
            left: 0;
          }
          .calories-indicator {
            font-size: 9px;
            background-color: #059669;
            color: white;
            border-radius: 10px;
            padding: 1px 4px;
            margin-bottom: 2px;
            line-height: 1;
          }
        `}</style>
      </div>

      {/* Camera Modal */}
      <CameraModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCaptureSuccess={handleCaptureSuccess}
        mealType={currentMealType}
      />
    </>
  );
}