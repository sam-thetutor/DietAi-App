// @ts-nocheck
"use client";

import { useAccount } from "wagmi";
import { ConnectWallet } from "@coinbase/onchainkit/wallet";
import RewardsDashboard from "../components/RewardsDashboard";
import Link from "next/link";
import { Button, Icon } from "../components/DemoComponents";
import { useState } from "react";

export default function RewardsPage() {
  const { address } = useAccount();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (

    <div className="flex flex-col min-h-screen font-sans text-[var(--app-foreground)] mini-app-theme from-[var(--app-background)] to-[var(--app-gray)]">
    <div className="w-full max-w-md mx-auto px-4 py-3">
      


    <div className="flex flex-col min-h-screen font-sans text-green-700">
      <div className="w-full max-w-md mx-auto px-4 py-3">
        <header className="flex justify-between items-center mb-2 h-11">
          <Link href="/dashboard" className="flex items-center text-green-700 hover:text-green-800 transition-colors">
            <span className="text-2xl font-bold">DietAI</span>
          </Link>
          <div>

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


        {/* <div className="mb-6">
          <h1 className="text-2xl font-bold text-green-700">Rewards & Achievements</h1>
          <p className="text-sm text-gray-600 mt-1">
            Track your progress and earn points as you use CaloAI
          </p>
        </div> */}

        <main >
          <RewardsDashboard />
        </main>
      </div>
    </div>
    </div>
    </div>
  );
} 