"use client";

import { useRewards } from "@/app/contexts/RewardsContext";
import { Card, Button } from "./DemoComponents";
import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { ConnectWallet } from "@coinbase/onchainkit/wallet";
import { formatUnits, parseUnits } from "viem";
import tokenABI from "@/lib/abi/tokencontract.json";
import { 
  Transaction, 
  TransactionButton, 
  TransactionStatus, 
  TransactionStatusLabel, 
  TransactionStatusAction 
} from "@coinbase/onchainkit/transaction";
import type { TransactionError, TransactionResponse } from "@coinbase/onchainkit/transaction";
import { publicClient } from "@/lib/hook/client"; // Import the publicClient from your client setup
import claimABI from "@/lib/abi/claimcontract.json";
import { base } from "wagmi/chains";

// DIET Token contract address on Base mainnet
const DIET_TOKEN_ADDRESS = "0x580717a2136d0da2a89D82775755f567a1d74122";

// Update the contract address
const CLAIM_CONTRACT_ADDRESS = "0x811bF806bdF488595a4F8984E925A4DBa29e7B5E";

export default function RewardsDashboard() {
  const { rewards, isLoading, refreshRewards } = useRewards();
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState<'overview' | 'achievements' | 'history' | 'wallet'>('overview');
  const [walletSubTab, setWalletSubTab] = useState<'balance' | 'send' | 'receive'>('balance');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [transactionStatus, setTransactionStatus] = useState<{type: string, message: string, isError: boolean} | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  
  // State for token balance and loading state
  const [tokenDecimals, setTokenDecimals] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [formattedBalance, setFormattedBalance] = useState("0.00");

  // Wrap fetchTokenBalance in useCallback
  const fetchTokenBalance = useCallback(async () => {
    if (!address) return;
    
    setIsLoadingBalance(true);
    try {
      // Fetch token decimals
      const decimals = await publicClient.readContract({
        address: DIET_TOKEN_ADDRESS as `0x${string}`,
        abi: tokenABI,
        functionName: 'decimals',
      }) as number;
      console.log("token decimals:",decimals)
      setTokenDecimals(decimals);
      
      // Fetch token balance
      const balance = await publicClient.readContract({
        address: DIET_TOKEN_ADDRESS as `0x${string}`,
        abi: tokenABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      }) as bigint;
      
      // Format the balance
      const formatted = formatUnits(balance, decimals);
      setFormattedBalance(parseFloat(formatted).toFixed(2));
      
      console.log("DIET token balance:", formatted);
    } catch (error) {
      console.error("Error fetching token balance:", error);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [address]);

  // Fetch balance when address changes or after transactions
  useEffect(() => {
    fetchTokenBalance();
  }, [address, fetchTokenBalance]);

  // Reset transaction status after 5 seconds
  useEffect(() => {
    if (transactionStatus) {
      const timer = setTimeout(() => {
        setTransactionStatus(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [transactionStatus]);

  // Reset copied status after 2 seconds
  useEffect(() => {
    if (isCopied) {
      const timer = setTimeout(() => {
        setIsCopied(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isCopied]);

  // Generate claim transaction contracts
  const generateClaimContracts = useMemo(() => {
    return () => {
      if (!address || !rewards || rewards?.totalPoints <= 0) {
        return [];
      }
      
      try {
        // Convert points to DIET tokens (100 points = 1 DIET)
        // Multiply by 1e18 for token decimals
        const tokenAmount = parseUnits((rewards.totalPoints * 0.01).toString(), 18);
        
        return [{
          address: CLAIM_CONTRACT_ADDRESS as `0x${string}`,
          abi: claimABI,
          functionName: 'claim',
          args: [tokenAmount],
        }];
      } catch (error) {
        console.error("Error generating claim contracts:", error);
        return [];
      }
    };
  }, [address, rewards]);

  // Handle claim transaction success
  const handleClaimSuccess = (response: TransactionResponse) => {
    console.log("Claim transaction successful:", response);
    
    // Get the points before resetting
    const pointsClaimed = rewards?.totalPoints || 0;
    
    // Set a flag in localStorage to prevent duplicate calls
    const transactionHash = response.transactionReceipts[0]?.transactionHash;
    const claimKey = `claim_processed_${transactionHash}`;
    
    // Check if this transaction has already been processed
    if (localStorage.getItem(claimKey)) {
      console.log("Transaction already processed, skipping update");
      return;
    }
    
    setTransactionStatus({
      type: 'claim',
      message: `Successfully claimed ${pointsClaimed} points as DIET tokens!`,
      isError: false
    });

    // Update the user's points in the database
    const updatePoints = async () => {
      try {
        // Mark this transaction as being processed
        localStorage.setItem(claimKey, 'true');
        
        const response = await fetch(`/api/update-points?address=${address}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            address: address,
            points: pointsClaimed
          })
        });
        
        if (response.ok) {
          console.log("Points updated successfully");
          // Refresh rewards data to show updated points
          if (typeof refreshRewards === 'function') {
            refreshRewards();
          }
        } else {
          console.error("Failed to update points:", await response.text());
        }
      } catch (error) {
        console.error("Error updating points:", error);
      }
    };

    // Execute update only once
    updatePoints();
    
    // Refresh the token balance after a delay
    setTimeout(() => {
      fetchTokenBalance();
    }, 2000);
  };

  // Handle claim transaction error
  const handleClaimError = (error: TransactionError) => {
    console.error("Claim transaction error:", error);
    setTransactionStatus({
      type: 'claim',
      message: `Failed to claim tokens: ${error.message || 'Unknown error'}`,
      isError: true
    });
  };

  // Generate transaction contracts for sending tokens
  const generateTransferContracts = useMemo(() => {
    return () => {
      if (!tokenDecimals || !recipientAddress || !sendAmount || parseFloat(sendAmount) <= 0) {
        return [];
      }
      
      try {
        // Convert the amount to the correct units for the token
        const amountInSmallestUnit = parseUnits(sendAmount, tokenDecimals);
        
        return [
          {
            address: DIET_TOKEN_ADDRESS as `0x${string}`,
            abi: tokenABI,
            functionName: 'transfer',
            args: [recipientAddress as `0x${string}`, amountInSmallestUnit],
          },
        ];
      } catch (error) {
        console.error("Error generating transfer contracts:", error);
        return [];
      }
    };
  }, [recipientAddress, sendAmount, tokenDecimals]);

  // Handle transaction success
  const handleTransactionSuccess = (response: TransactionResponse) => {
    console.log("Transaction successful:", response);
    setTransactionStatus({
      type: 'send',
      message: `Successfully sent ${sendAmount} DIET to ${recipientAddress.substring(0, 6)}...${recipientAddress.substring(recipientAddress.length - 4)}!`,
      isError: false
    });
    
    setSendAmount('');
    setRecipientAddress('');
    
    // Refresh the token balance after a delay
    setTimeout(() => {
      fetchTokenBalance();
    }, 2000);
  };

  // Handle transaction error
  const handleTransactionError = (error: TransactionError) => {
    console.error("Transaction error:", error);
    setTransactionStatus({
      type: 'send',
      message: `Failed to send tokens: ${error.message || 'Unknown error'}`,
      isError: true
    });
  };

  // Function to copy wallet address to clipboard
  const copyToClipboard = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setIsCopied(true);
    }
  };

  // Wallet tab content
  const renderWalletContent = () => {
    switch (walletSubTab) {
      case 'balance':
        return (
          <div className="space-y-6 min-h-[600px]">
            <div className="text-center">
              <h3 className="font-semibold text-lg mb-1">Your Rewards Wallet</h3>
              <p className="text-sm text-[var(--app-foreground-muted)]">
                Claim your points and manage your DIET tokens
              </p>
            </div>

            {/* Balances */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[var(--app-gray)] p-4 rounded-lg text-center">
                <p className="text-sm text-[var(--app-foreground-muted)]">Available Points</p>
                <p className="text-2xl font-bold text-green-600">{rewards?.totalPoints || 0}</p>
                <p className="text-xs text-[var(--app-foreground-muted)] mt-1">≈ {((rewards?.totalPoints || 0) * 0.01).toFixed(2)} DIET</p>
              </div>
              <div className="bg-[var(--app-gray)] p-4 rounded-lg text-center">
                <p className="text-sm text-[var(--app-foreground-muted)]">DIET Balance</p>
                {isLoadingBalance ? (
                  <div className="flex justify-center items-center h-8">
                    <svg className="animate-spin h-5 w-5 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-green-600">{formattedBalance}</p>
                    <p className="text-xs text-[var(--app-foreground-muted)] mt-1">≈ ${(parseFloat(formattedBalance) * 0.1).toFixed(2)}</p>
                  </>
                )}
              </div>
            </div>

            {/* Transaction Status */}
            {transactionStatus && (
              <div className={`p-3 rounded-lg text-center ${transactionStatus.isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {transactionStatus.message}
              </div>
            )}

            {/* Claim Section */}
            <div className="border border-[var(--app-card-border)] rounded-lg p-4">
              <h4 className="font-medium mb-3">Claim Rewards</h4>
              <p className="text-sm text-[var(--app-foreground-muted)] mb-4">
                Convert your earned points to DIET tokens at a rate of 100 points = 1 DIET
              </p>
              <Transaction
                chainId={base.id}
                contracts={generateClaimContracts()}
                onSuccess={handleClaimSuccess}
                onError={handleClaimError}
              >
                <TransactionButton 
                  disabled={rewards?.totalPoints === 0}
                  text={`Claim ${(rewards?.totalPoints || 0) * 0.01} DIET`}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                </TransactionButton>
                <TransactionStatus>
                  <div className="mt-2 text-center">
                    <TransactionStatusLabel className="text-sm" />
                    <TransactionStatusAction className="mt-1" />
                  </div>
                </TransactionStatus>
              </Transaction>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setWalletSubTab('send')}
              >
                <span className="flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Send
                </span>
              </Button>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setWalletSubTab('receive')}
              >
                <span className="flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Receive
                </span>
              </Button>
            </div>
          </div>
        );
      
      case 'send':
        return (
          <div className="space-y-6 min-h-[600px]">
            <div className="flex items-center">
              <button 
                onClick={() => setWalletSubTab('balance')}
                className="mr-2 p-1 rounded-full hover:bg-gray-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h3 className="font-semibold text-lg">Send DIET Tokens</h3>
            </div>
              
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--app-foreground-muted)] mb-1">
                  Recipient Address
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  className="w-full px-3 py-2 border border-[var(--app-card-border)] rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[var(--app-foreground-muted)] mb-1">
                  Amount (DIET)
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-[var(--app-card-border)] rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                />
                <div className="flex justify-between mt-1">
                  <button 
                    className="text-xs text-green-600"
                    onClick={() => setSendAmount((parseFloat(formattedBalance) * 0.25).toFixed(2))}
                    disabled={isLoadingBalance}
                  >
                    25%
                  </button>
                  <button 
                    className="text-xs text-green-600"
                    onClick={() => setSendAmount((parseFloat(formattedBalance) * 0.5).toFixed(2))}
                    disabled={isLoadingBalance}
                  >
                    50%
                  </button>
                  <button 
                    className="text-xs text-green-600"
                    onClick={() => setSendAmount((parseFloat(formattedBalance) * 0.75).toFixed(2))}
                    disabled={isLoadingBalance}
                  >
                    75%
                  </button>
                  <button 
                    className="text-xs text-green-600"
                    onClick={() => setSendAmount(formattedBalance)}
                    disabled={isLoadingBalance}
                  >
                    Max
                  </button>
                </div>
              </div>
              
              {/* Transaction component from OnchainKit */}
              <Transaction
                chainId={base.id}
                contracts={generateTransferContracts()}
                onSuccess={handleTransactionSuccess}
                onError={handleTransactionError}
              >
                <TransactionButton 
                  text="Send DIET Tokens"
                  disabled={!recipientAddress || !sendAmount || parseFloat(sendAmount) <= 0 || parseFloat(sendAmount) > parseFloat(formattedBalance)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                </TransactionButton>
                <TransactionStatus>
                  <div className="mt-2 text-center">
                    <TransactionStatusLabel className="text-sm" />
                    <TransactionStatusAction className="mt-1" />
                  </div>
                </TransactionStatus>
              </Transaction>
            </div>
          </div>
        );
      
      case 'receive':
        return (
          <div className="space-y-6 min-h-[600px]">
            <div className="flex items-center">
              <button 
                onClick={() => setWalletSubTab('balance')}
                className="mr-2 p-1 rounded-full hover:bg-gray-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h3 className="font-semibold text-lg">Receive DIET Tokens</h3>
            </div>
            
            <div className="text-center">
              <p className="text-sm text-[var(--app-foreground-muted)] mb-4">
                Scan this QR code or copy your wallet address to receive DIET tokens
              </p>
              
              {/* QR Code */}
              <div className="bg-white p-4 rounded-lg inline-flex mb-4">
                {address ? (
                  <div className="w-48 h-48 bg-[var(--app-gray)] flex items-center justify-center">
                    {/* In a real app, you would generate a QR code here */}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-[var(--app-foreground-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-48 h-48 bg-[var(--app-gray)] flex items-center justify-center">
                    <p className="text-sm text-[var(--app-foreground-muted)]">Connect wallet to view QR code</p>
                  </div>
                )}
              </div>
              
              {/* Wallet Address */}
              <div className="border border-[var(--app-card-border)] rounded-lg p-3 flex items-center justify-between">
                <div className="truncate text-sm flex-1 text-left">
                  {address || "Connect wallet to view address"}
                </div>
                {address && (
                  <button 
                    onClick={copyToClipboard}
                    className="ml-2 p-2 rounded-md hover:bg-[var(--app-gray)]"
                  >
                    {isCopied ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--app-foreground-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
              
              <p className="text-xs text-[var(--app-foreground-muted)] mt-4">
                Only send DIET tokens to this address. Sending other tokens may result in permanent loss.
              </p>
            </div>
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <Card className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center">
          <svg className="animate-spin h-8 w-8 text-[var(--app-accent)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-2 text-[var(--app-foreground-muted)]">Loading rewards...</p>
        </div>
      </Card>
    );
  }

  if (!rewards) {
    return (
      <Card className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--app-foreground-muted)]">Connect your wallet to view rewards</p>
          <ConnectWallet className="mt-4" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-0 overflow-hidden shadow-sm border border-[var(--app-card-border)] bg-white">
      {/* Tabs */}
      <div className="flex border-b border-[var(--app-card-border)]">
        <button 
          className={`flex-1 py-3 text-sm font-medium ${activeTab === 'overview' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`flex-1 py-3 text-sm font-medium ${activeTab === 'achievements' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('achievements')}
        >
          Achievements
        </button>
        <button 
          className={`flex-1 py-3 text-sm font-medium ${activeTab === 'history' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
        <button 
          className={`flex-1 py-3 text-sm font-medium ${activeTab === 'wallet' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-500'}`}
          onClick={() => {setActiveTab('wallet'); setWalletSubTab('balance');}}
        >
          Wallet
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Level and Points */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 text-green-600 text-2xl font-bold mb-2">
                {rewards.currentLevel}
              </div>
              <h3 className="text-lg font-semibold">Level {rewards.currentLevel}</h3>
              <p className="text-[var(--app-foreground-muted)] text-sm">
                {rewards.totalPoints} total points
              </p>
            </div>

            {/* Progress to Next Level */}
            {rewards.currentLevel < 10 && (
              <div>
                <div className="flex justify-between text-xs text-[var(--app-foreground-muted)] mb-1">
                  <span>Level {rewards?.currentLevel}</span>
                  <span>{rewards?.pointsToNextLevel || 0} points to Level {(rewards?.currentLevel || 1) + 1}</span>
                </div>
                <div className="w-full bg-[var(--app-gray)] rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full" 
                    style={{ width: `${rewards?.levelProgress || 0}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Streak */}
            <div className="bg-[var(--app-gray)] p-3 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-medium">Current Streak</h4>
                  <p className="text-[var(--app-foreground-muted)] text-sm">
                    {rewards.currentStreak} days
                  </p>
                </div>
                <div className="text-2xl">🔥</div>
              </div>
              <div className="mt-2 text-xs text-[var(--app-foreground-muted)]">
                Longest streak: {rewards.longestStreak} days
              </div>
            </div>

            {/* Ways to Earn */}
            <div>
              <h4 className="font-medium mb-2">Ways to Earn Points</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 bg-[var(--app-gray)] rounded-lg">
                  <div className="flex items-center">
                    <div className="text-sm mr-2">🍳</div>
                    <p className="text-sm">Log breakfast</p>
                  </div>
                  <div className="text-xs font-medium text-green-600">+10 pts</div>
                </div>
                <div className="flex justify-between items-center p-2 bg-[var(--app-gray)] rounded-lg">
                  <div className="flex items-center">
                    <div className="text-sm mr-2">🥪</div>
                    <p className="text-sm">Log lunch</p>
                  </div>
                  <div className="text-xs font-medium text-green-600">+10 pts</div>
                </div>
                <div className="flex justify-between items-center p-2 bg-[var(--app-gray)] rounded-lg">
                  <div className="flex items-center">
                    <div className="text-sm mr-2">🍲</div>
                    <p className="text-sm">Log dinner</p>
                  </div>
                  <div className="text-xs font-medium text-green-600">+10 pts</div>
                </div>
                <div className="flex justify-between items-center p-2 bg-[var(--app-gray)] rounded-lg">
                  <div className="flex items-center">
                    <div className="text-sm mr-2">📸</div>
                    <p className="text-sm">Upload a meal photo</p>
                  </div>
                  <div className="text-xs font-medium text-green-600">+5 pts</div>
                </div>
                <div className="flex justify-between items-center p-2 bg-[var(--app-gray)] rounded-lg">
                  <div className="flex items-center">
                    <div className="text-sm mr-2">🎯</div>
                    <p className="text-sm">Meet calorie goal</p>
                  </div>
                  <div className="text-xs font-medium text-green-600">+20 pts</div>
                </div>
              </div>
            </div>
            
            {/* Quick Links */}
            <div className="pt-2">
              <Link href="/track">
                <Button variant="primary" className="w-full mb-2">
                  Track Today&apos;s Meals
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline" className="w-full">
                  View Dashboard
                </Button>
              </Link>
            </div>
          </div>
        )}

        {activeTab === 'achievements' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Your Achievements</h3>
            <div className="grid grid-cols-1 gap-3">
              {rewards.achievements.map(achievement => (
                <div 
                  key={achievement.id} 
                  className={`flex items-center p-3 rounded-lg ${achievement.isUnlocked ? 'bg-green-100' : 'bg-gray-100 opacity-70'}`}
                >
                  <div className="text-2xl mr-4">{achievement.icon}</div>
                  <div className="flex-1">
                    <p className="font-medium">{achievement.name}</p>
                    <p className="text-xs text-[var(--app-foreground-muted)]">{achievement.description}</p>
                    {achievement.isUnlocked && achievement.dateUnlocked && (
                      <p className="text-xs text-green-600 mt-1">
                        Unlocked on {new Date(achievement.dateUnlocked).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {achievement.isUnlocked ? (
                    <div className="text-green-600 text-xl">✓</div>
                  ) : (
                    <div className="text-xs font-medium text-gray-500">+{achievement.pointsAwarded} pts</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Points History</h3>
            {rewards.pointsHistory.length > 0 ? (
              <div className="space-y-2">
                {rewards.pointsHistory.slice().reverse().map((transaction, index) => (
                  <div key={index} className="flex justify-between items-center p-2 border-b border-[var(--app-card-border)] last:border-b-0">
                    <div>
                      <p className="text-sm font-medium">{transaction.description}</p>
                      <p className="text-xs text-[var(--app-foreground-muted)]">
                        {new Date(transaction.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-sm font-medium text-green-600">+{transaction.points}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--app-foreground-muted)] text-center py-4">
                Don&apos;t have any points yet? Track your meals to earn points!
              </p>
            )}
          </div>
        )}

        {activeTab === 'wallet' && renderWalletContent()}
      </div>
    </Card>
  );
} 