// @ts-nocheck
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAccount } from 'wagmi';
import { toast } from 'react-hot-toast';
import { UserRewards } from '@/app/api/rewards/route';

interface RewardsContextType {
  rewards: UserRewards | null;
  isLoading: boolean;
  addPoints: (action: string, points: number, description?: string) => Promise<void>;
  unlockAchievement: (achievementId: string) => Promise<void>;
  refreshRewards: () => Promise<void>;
}

const RewardsContext = createContext<RewardsContextType | undefined>(undefined);

export function RewardsProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const [rewards, setRewards] = useState<UserRewards | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load rewards data
  const loadRewards = async () => {
    if (!address) {
      setRewards(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`/api/rewards?address=${address}`);
      if (response.ok) {
        const data = await response.json();
        setRewards(data);
      }
    } catch (error) {
      console.error('Error loading rewards:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Add points
  const addPoints = async (action: string, points: number, description?: string) => {
    if (!address) return;

    try {
      const response = await fetch('/api/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, action, points, description })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Show toast notification
        toast.success(`+${points} points earned!`);
        
        // If leveled up, show special notification
        if (data.levelUp) {
          toast.success(`🎉 Level Up! You're now level ${data.currentLevel}!`, {
            duration: 5000,
            icon: '🌟'
          });
        }
        
        // Refresh rewards data
        await loadRewards();
      }
    } catch (error) {
      console.error('Error adding points:', error);
    }
  };

  // Unlock achievement
  const unlockAchievement = async (achievementId: string) => {
    if (!address) return;

    try {
      const response = await fetch('/api/rewards/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, achievementId })
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          // Show achievement unlocked notification
          toast.success(`🏆 Achievement Unlocked: ${data.achievement.name}`, {
            duration: 5000,
            icon: data.achievement.icon
          });
          
          // If points were awarded
          if (data.pointsAwarded > 0) {
            toast.success(`+${data.pointsAwarded} points earned!`);
          }
          
          // Refresh rewards data
          await loadRewards();
        }
      }
    } catch (error) {
      console.error('Error unlocking achievement:', error);
    }
  };

  // Refresh rewards
  const refreshRewards = async () => {
    await loadRewards();
  };

  // Load rewards on mount or when address changes
  useEffect(() => {
    loadRewards();
  }, [address]);

  return (
    <RewardsContext.Provider value={{ 
      rewards, 
      isLoading, 
      addPoints, 
      unlockAchievement,
      refreshRewards
    }}>
      {children}
    </RewardsContext.Provider>
  );
}

export function useRewards() {
  const context = useContext(RewardsContext);
  if (context === undefined) {
    throw new Error('useRewards must be used within a RewardsProvider');
  }
  return context;
} 