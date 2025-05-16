// @ts-nocheck
"use client";

import { Card, Button } from "./DemoComponents";
import Link from "next/link";

interface MealPlanSectionProps {
  mealPlan: any;
  isLoading: boolean;
  onRefresh: () => void;
}

export default function MealPlanSection({ mealPlan, isLoading, onRefresh }: MealPlanSectionProps) {
  return (
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
              onClick={onRefresh}
              disabled={isLoading}
            >
              {isLoading ? (
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
  );
} 