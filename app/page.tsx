"use client";

import {
  useMiniKit,
} from "@coinbase/onchainkit/minikit";

import {
  ConnectWallet,
  Wallet,
} from "@coinbase/onchainkit/wallet";
import { useEffect, useState } from "react";
import { Button,  } from "./components/DemoComponents";
import Link from "next/link";
import Image from "next/image";
import { useAccount } from "wagmi";

export default function App() {
  const { setFrameReady, isFrameReady } = useMiniKit();
  // const [frameAdded, setFrameAdded] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // const addFrame = useAddFrame();
   const { address } = useAccount();

  // const openUrl = useOpenUrl();

  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  // const handleAddFrame = useCallback(async () => {
  //   const frameAdded = await addFrame();
  //   setFrameAdded(Boolean(frameAdded));
  // }, [addFrame]);

  // const saveFrameButton = useMemo(() => {
  //   if (context && !context.client.added) {
  //     return (
  //       <Button
  //         variant="ghost"
  //         size="sm"
  //         onClick={handleAddFrame}
  //         className="text-[var(--app-accent)] p-4"
  //         icon={<Icon name="plus" size="sm" />}
  //       >
  //         Save Frame
  //       </Button>
  //     );
  //   }

  //   if (frameAdded) {
  //     return (
  //       <div className="flex items-center space-x-1 text-sm font-medium text-[#0052FF] animate-fade-out">
  //         <Icon name="check" size="sm" className="text-[#0052FF]" />
  //         <span>Saved</span>
  //       </div>
  //     );
  //   }

  //   return null;
  // }, [context, frameAdded, handleAddFrame]);

  return (
    <div className="flex flex-col min-h-screen font-sans text-[var(--app-foreground)] mini-app-theme from-[var(--app-background)] to-[var(--app-gray)]">
      <div className="w-full max-w-md mx-auto px-4 py-3">
        
      
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
          <div className="text-center space-y-8 bg-gradient-to-br from-green-50 to-white p-6 rounded-xl relative">
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
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex justify-center items-center">
                <h2 className="text-6xl font-semibold text-green-700 mb-2">
                  DietAI
                </h2>
              </div>

              <Image src="/foood.jpg" alt="DietAI" width={400} height={400} />

              <div className="space-y-4">
                <p className="text-lg text-gray-600 max-w-xl mx-auto">
                  AI-Powered Diet Tracking with Web3 Rewards{" "}
                </p>
              </div>

              <div className="flex justify-center gap-4 mt-8">
                {!address ? (
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
                ) : (
                  <Link href="/dashboard" className="inline-block">
                    <Button
                      variant="primary"
                      size="lg"
                      className="bg-green-600 hover:bg-green-700 text-white px-6 py-4"
                    >
                      Go to Dashboard
                    </Button>
                  </Link>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 mt-8">
                <div className="bg-white p-6 rounded-xl shadow-md border border-green-50">
                  <div className="flex justify-center mb-4 text-green-500">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-12 w-12"
                    >
                      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                      <path d="M5 3v4" />
                      <path d="M19 17v4" />
                      <path d="M3 5h4" />
                      <path d="M17 19h4" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-green-700">
                    AI-Powered Insights
                  </h3>
                  <p className="text-gray-600">
                    Receive personalized nutrition advice with real-time data
                    analysis.
                  </p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-md border border-green-50">
                  <div className="flex justify-center mb-4 text-green-500">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-12 w-12"
                    >
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-green-700">
                    Blockchain Security
                  </h3>
                  <p className="text-gray-600">
                    Your data is encrypted and stored securely using blockchain
                    technology.
                  </p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-md border border-green-50">
                  <div className="flex justify-center mb-4 text-green-500">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-12 w-12"
                    >
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-green-700">
                    All-in-One Tracking
                  </h3>
                  <p className="text-gray-600">
                    Track your meals, workouts, and progress seamlessly in one
                    dashboard.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <footer className="mt-8 text-center text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} CaloAI. All rights reserved.
          </footer>
        </main>
      </div>
    </div>
  );
}
