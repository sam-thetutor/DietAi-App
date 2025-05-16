// @ts-nocheck
"use client";

import {
  useMiniKit,
  useAddFrame,
} from "@coinbase/onchainkit/minikit";
import {
  ConnectWallet,
  Wallet,
} from "@coinbase/onchainkit/wallet";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Button, Card } from "../components/DemoComponents";
import { Icon } from "../components/DemoComponents";
import Link from "next/link";
import { useAccount } from "wagmi";
import Image from "next/image";
import RewardsDashboard from "../components/RewardsDashboard";
import { useRewards } from "../contexts/RewardsContext";
import { RewardsIndicator } from "../components/RewardsIndicator";
// Define types for profile data
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

export default function ProfilePage() {
  const { setFrameReady, isFrameReady, context } = useMiniKit();
  const [frameAdded, setFrameAdded] = useState(false);
  const [profile, setProfile] = useState<HealthProfile>({
    age: "",
    gender: "",
    height: "",
    weight: "",
    goal: "maintenance",
    activityLevel: "sedentary",
    restrictions: "",
    calorieTarget: "",
  });
  const [isProfileCreated, setIsProfileCreated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const addFrame = useAddFrame();
  const { address } = useAccount();
  const { addPoints, unlockAchievement } = useRewards();

  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  // Load profile data from MongoDB API when component mounts
  useEffect(() => {
    setIsLoading(true);
    if (address) {
      fetchProfile(address);
    } else {
      setIsLoading(false);
      setIsProfileCreated(false);
    }
  }, [address]);

  // Function to fetch profile from API
  const fetchProfile = async (walletAddress: string) => {
    try {
      console.log(`Fetching profile for address: ${walletAddress}`);
      const response = await fetch(`/api/profile?address=${walletAddress}`);
      
      console.log('Profile API response:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Profile data received:', data);
        setProfile(data);
        setIsProfileCreated(true);
      } else if (response.status === 404) {
        console.log('No profile found, setting up new profile');
        // Profile not found, set default values
        setProfile({
          age: "",
          gender: "",
          height: "",
          weight: "",
          goal: "maintenance",
          activityLevel: "sedentary",
          restrictions: "",
          calorieTarget: "",
        });
        setIsProfileCreated(false);
      } else {
        // Try to get error details
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response:', errorData);
        throw new Error(errorData.error || 'Failed to fetch profile');
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      setError(`Failed to load profile: ${error.message}`);
      setIsProfileCreated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFrame = useCallback(async () => {
    const frameAdded = await addFrame();
    setFrameAdded(Boolean(frameAdded));
  }, [addFrame]);

  const saveFrameButton = useMemo(() => {
    if (context && !context.client.added) {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAddFrame}
          className="text-[var(--app-accent)] p-4"
          icon={<Icon name="plus" size="sm" />}
        >
          Save Frame
        </Button>
      );
    }

    if (frameAdded) {
      return (
        <div className="flex items-center space-x-1 text-sm font-medium text-[#0052FF] animate-fade-out">
          <Icon name="check" size="sm" className="text-[#0052FF]" />
          <span>Saved</span>
        </div>
      );
    }

    return null;
  }, [context, frameAdded, handleAddFrame]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setProfile((prevProfile) => ({
      ...prevProfile,
      [name]: value,
    }));
  };

  // Function to save profile to API
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!address) return;

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address,
          profile,
        }),
      });

      console.log("saving profile response", response);
      
      const data = await response.json();
      console.log("Response data:", data);
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save profile');
      }

      setIsProfileCreated(true);
      setSaveSuccess(true);
      
      // Check if this is the first time completing the profile
      const isProfileComplete = 
        profile.age && 
        profile.gender && 
        profile.height && 
        profile.weight && 
        profile.goal && 
        profile.activityLevel;
      
      if (isProfileComplete) {
        // Award points for completing profile
        await addPoints('complete_profile', 50, 'Completed health profile');
        
        // Unlock achievement
        await unlockAchievement('complete_profile');
      }

      setSuccessMessage("Profile saved successfully!");
    } catch (err) {
      console.error("Error saving profile:", err);
      setError(`Failed to save profile: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Basic input styling
  const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-green-200 rounded-md text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500";
  const labelClasses = "block text-sm font-medium text-gray-600 mb-1";

  return (
    <div className="flex flex-col min-h-screen font-sans text-[var(--app-foreground)] mini-app-theme from-[var(--app-background)] to-[var(--app-gray)] rounded-lg">
      <div className="w-full max-w-md mx-auto px-4 py-3">
        <header className="flex justify-between items-center mb-3 h-11">
          <div>
            <Link href="/">
              <h2 className="text-xl font-bold text-green-700 cursor-pointer">DietAI</h2>
            </Link>
            {address && (
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="absolute top-4 right-4 text-green-700 hover:bg-green-50 rounded-full transition-colors p-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
          </div>
      





          <div>{saveFrameButton}</div>
        </header>


        {isMenuOpen && address && (
          <div className="absolute right-4 top-16 bg-white shadow-lg rounded-lg border border-gray-200 z-10 w-48 py-2 animate-fadeIn">
            <Link href="/dashboard" className="block px-4 py-2 text-green-700 hover:bg-green-50">
              Dashboard
            </Link>
            <Link href="/track" className="block px-4 py-2 text-green-700 hover:bg-green-50">
              Track Meals
            </Link>
            <Link href="/profile" className="block px-4 py-2 text-green-700 hover:bg-green-50">
              Profile
            </Link>
            <Link href="/rewards" className="block px-4 py-2 text-green-700 hover:bg-green-50">
              Rewards
            </Link>
          </div>
        )}

        <main className="flex-1 min-h-[600px]">
          {!address ? (
            <div className="flex flex-col items-center justify-center h-[70vh]">
              <p className="mb-4 text-lg">Please connect your wallet to manage your profile</p>
              <Wallet>
                <ConnectWallet>
                  <Button
                    variant="secondary"
                    size="lg"
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-4"
                  >
                    Connect Wallet
                  </Button>
                </ConnectWallet>
              </Wallet>
            </div>
          ) : (
            <>
              {/* <Card title="" className="border-none flex justify-center mb-4 relative">
                <button 
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="text-green-700 hover:bg-green-50 rounded-full transition-colors p-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                {isMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-10 border border-green-100">
                    <Link href="/dashboard" passHref legacyBehavior>
                      <a className="block px-4 py-2 text-green-800 hover:bg-green-50">
                        Dashboard
                      </a>
                    </Link>
                    <Link href="/track" passHref legacyBehavior>
                      <a className="block px-4 py-2 text-green-800 hover:bg-green-50">
                        Track
                      </a>
                    </Link>
                    <Link href="/profile" passHref legacyBehavior>
                      <a className="block px-4 py-2 text-green-800 hover:bg-green-50 bg-green-100">
                        Profile
                      </a>
                    </Link>
                  </div>
                )}
              </Card> */}

              <div className="bg-gradient-to-br from-green-50 to-white p-6 rounded-xl">
                <h1 className="text-3xl font-bold text-green-700 mb-6 text-center">Your Health Profile</h1>
                
                {/* Success/Error Messages */}
                {successMessage && (
                  <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg text-center">
                    {successMessage}
                  </div>
                )}
                {error && (
                  <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-center">
                    {error}
                  </div>
                )}

                {isLoading ? (
                  <div className="text-center p-8">
                    <p>Loading profile data...</p>
                  </div>
                ) : isProfileCreated ? (
                  // Display Profile
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded-xl shadow-sm border border-green-100">
                        <h3 className="font-medium text-green-700 mb-2">Age</h3>
                        <p className="text-gray-700">{profile.age} years</p>
                      </div>
                      <div className="bg-white p-4 rounded-xl shadow-sm border border-green-100">
                        <h3 className="font-medium text-green-700 mb-2">Gender</h3>
                        <p className="text-gray-700">{profile.gender}</p>
                      </div>
                      <div className="bg-white p-4 rounded-xl shadow-sm border border-green-100">
                        <h3 className="font-medium text-green-700 mb-2">Height</h3>
                        <p className="text-gray-700">{profile.height} cm</p>
                      </div>
                      <div className="bg-white p-4 rounded-xl shadow-sm border border-green-100">
                        <h3 className="font-medium text-green-700 mb-2">Weight</h3>
                        <p className="text-gray-700">{profile.weight} kg</p>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl shadow-sm border border-green-100">
                      <h3 className="font-medium text-green-700 mb-2">Health Goal</h3>
                      <p className="text-gray-700 capitalize">{profile.goal.replace('_', ' ')}</p>
                    </div>

                    <div className="bg-white p-4 rounded-xl shadow-sm border border-green-100">
                      <h3 className="font-medium text-green-700 mb-2">Activity Level</h3>
                      <p className="text-gray-700 capitalize">{profile.activityLevel.replace('_', ' ')}</p>
                    </div>

                    <div className="bg-white p-4 rounded-xl shadow-sm border border-green-100">
                      <h3 className="font-medium text-green-700 mb-2">Dietary Restrictions</h3>
                      <p className="text-gray-700">{profile.restrictions || "None specified"}</p>
                    </div>

                    <div className="bg-white p-4 rounded-xl shadow-sm border border-green-100">
                      <h3 className="font-medium text-green-700 mb-2">Daily Calorie Target</h3>
                      <p className="text-gray-700">{profile.calorieTarget} kcal</p>
                    </div>

                    <div className="flex justify-center mt-6">
                      <Button 
                        variant="secondary" 
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => setIsProfileCreated(false)}
                      >
                        Edit Profile
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Profile Creation Form
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="age" className={labelClasses}>Age</label>
                        <input 
                          type="number" 
                          id="age" 
                          name="age" 
                          value={profile.age} 
                          onChange={handleInputChange} 
                          className={inputClasses} 
                          required 
                          min="0" 
                        />
                      </div>
                      <div>
                        <label htmlFor="gender" className={labelClasses}>Gender</label>
                        <select 
                          id="gender" 
                          name="gender" 
                          value={profile.gender} 
                          onChange={handleInputChange} 
                          className={inputClasses}
                          required
                        >
                          <option value="">Select Gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                          <option value="prefer_not_to_say">Prefer not to say</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="height" className={labelClasses}>Height (cm)</label>
                        <input 
                          type="number" 
                          id="height" 
                          name="height" 
                          value={profile.height} 
                          onChange={handleInputChange} 
                          className={inputClasses} 
                          required 
                          min="0" 
                        />
                      </div>
                      <div>
                        <label htmlFor="weight" className={labelClasses}>Weight (kg)</label>
                        <input 
                          type="number" 
                          id="weight" 
                          name="weight" 
                          value={profile.weight} 
                          onChange={handleInputChange} 
                          className={inputClasses} 
                          required 
                          min="0" 
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="goal" className={labelClasses}>Health Goal</label>
                      <select 
                        id="goal" 
                        name="goal" 
                        value={profile.goal} 
                        onChange={handleInputChange} 
                        className={inputClasses}
                        required
                      >
                        <option value="maintenance">Maintenance</option>
                        <option value="weight_loss">Weight Loss</option>
                        <option value="weight_gain">Weight Gain</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="activityLevel" className={labelClasses}>Activity Level</label>
                      <select 
                        id="activityLevel" 
                        name="activityLevel" 
                        value={profile.activityLevel} 
                        onChange={handleInputChange} 
                        className={inputClasses}
                        required
                      >
                        <option value="sedentary">Sedentary (little/no exercise)</option>
                        <option value="light">Light (exercise 1-3 days/week)</option>
                        <option value="moderate">Moderate (exercise 3-5 days/week)</option>
                        <option value="active">Active (exercise 6-7 days/week)</option>
                        <option value="very_active">Very Active (hard exercise/physical job)</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="restrictions" className={labelClasses}>Dietary Restrictions/Preferences</label>
                      <textarea 
                        id="restrictions" 
                        name="restrictions" 
                        value={profile.restrictions} 
                        onChange={handleInputChange} 
                        className={inputClasses} 
                        rows={3} 
                        placeholder="e.g., Vegetarian, Gluten-Free, Allergies..."
                      ></textarea>
                    </div>

                    <div>
                      <label htmlFor="calorieTarget" className={labelClasses}>Daily Calorie Target (kcal)</label>
                      <input 
                        type="number" 
                        id="calorieTarget" 
                        name="calorieTarget" 
                        value={profile.calorieTarget} 
                        onChange={handleInputChange} 
                        className={inputClasses} 
                        required 
                        min="0" 
                      />
                    </div>

                    <div className="flex justify-center mt-6">
                      <Button 
                        type="submit" 
                        variant="primary" 
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        {isProfileCreated ? "Update Profile" : "Save Profile"}
                      </Button>
                    </div>
                  </form>
                )}
              </div>

              {/* Health Stats Card */}
              {isProfileCreated && (
                <div className="mt-6 bg-white p-6 rounded-xl shadow-md border border-green-100">
                  <h2 className="text-xl font-bold text-green-700 mb-4">Health Stats</h2>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 p-4 rounded-lg text-center">
                      <p className="text-sm text-green-600">BMI</p>
                      <p className="text-2xl font-bold text-green-800">
                        {profile.height && profile.weight 
                          ? (Number(profile.weight) / Math.pow(Number(profile.height)/100, 2)).toFixed(1) 
                          : "N/A"}
                      </p>
                    </div>
                    
                    <div className="bg-green-50 p-4 rounded-lg text-center">
                      <p className="text-sm text-green-600">Daily Calories</p>
                      <p className="text-2xl font-bold text-green-800">{profile.calorieTarget || "N/A"}</p>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-4 bg-green-50 rounded-lg">
                    <h3 className="font-medium text-green-700 mb-2">Recommended Macros</h3>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-sm text-green-600">Protein</p>
                        <p className="font-bold text-green-800">
                          {profile.calorieTarget ? Math.round(Number(profile.calorieTarget) * 0.3 / 4) + "g" : "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-green-600">Carbs</p>
                        <p className="font-bold text-green-800">
                          {profile.calorieTarget ? Math.round(Number(profile.calorieTarget) * 0.45 / 4) + "g" : "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-green-600">Fat</p>
                        <p className="font-bold text-green-800">
                          {profile.calorieTarget ? Math.round(Number(profile.calorieTarget) * 0.25 / 9) + "g" : "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <footer className="mt-8 text-center text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} DietAI. All rights reserved.
          </footer>
        </main>
      </div>
    </div>
  );
}