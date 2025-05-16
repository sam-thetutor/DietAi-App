"use client";

import { useRewards } from "../contexts/RewardsContext";
import Link from "next/link";

export default function RewardsIndicator() {
  const { rewards, isLoading } = useRewards();

  if (isLoading || !rewards) {
    return null;
  }

  return (
    <Link href="/rewards" className="flex items-center space-x-1 px-3 py-1 bg-[var(--app-accent-light)] rounded-full hover:bg-[var(--app-accent-light)] transition-colors">
      <span className="text-[var(--app-accent)] text-sm">⭐</span>
      <span className="text-[var(--app-accent)] text-sm font-medium">{rewards.totalPoints}</span>
    </Link>
  );
} 