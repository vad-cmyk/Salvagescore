'use client';
import { createContext, useContext, useState, useMemo, type ReactNode } from 'react';
import type { DamageFindings, ReportVerdict } from '@/types';
import type { ConditionToggleId, ToggleState } from '@/lib/resale-model/condition-adjustments';
import { applyConditionAdjustments, ALL_TOGGLE_IDS } from '@/lib/resale-model/condition-adjustments';
import { computeDealScore, scoreToVerdict } from '@/lib/deal-score';

type ReportAdjustmentContextValue = {
  toggles: ToggleState;
  setToggle: (id: ConditionToggleId, value: boolean) => void;
  clearAll: () => void;
  adjustedCeilingGbp: number;
  isPartsOnly: boolean;
  adjustedDealScore: number;
  adjustedVerdict: ReportVerdict;
  adjustedMarginPct: number;
  adjustedMarginGbp: number;
};

export const ReportAdjustmentContext = createContext<ReportAdjustmentContextValue | null>(null);

export type ReportAdjustmentProviderProps = {
  children: ReactNode;
  initialToggles: ToggleState;
  baseValueGbp: number;
  totalCostGbp: number;
  accidentCount: number;
  mileagePenalty: number;
  damage: DamageFindings;
  confidence: string;
};

export function ReportAdjustmentProvider({
  children,
  initialToggles,
  baseValueGbp,
  totalCostGbp,
  accidentCount,
  mileagePenalty,
  damage,
  confidence,
}: ReportAdjustmentProviderProps) {
  const [toggles, setToggles] = useState<ToggleState>(initialToggles);

  const adjustedCeilingGbp = useMemo(
    () => applyConditionAdjustments(baseValueGbp, toggles, accidentCount, mileagePenalty),
    [toggles, baseValueGbp, accidentCount, mileagePenalty]
  );

  const isPartsOnly = toggles.cat_b;

  const adjustedMarginGbp = adjustedCeilingGbp - totalCostGbp;
  const adjustedMarginPct = adjustedCeilingGbp > 0
    ? Math.round((adjustedMarginGbp / adjustedCeilingGbp) * 100)
    : -100;

  const adjustedDealScore = isPartsOnly ? 0
    : computeDealScore(adjustedMarginPct, damage, confidence);

  const adjustedVerdict: ReportVerdict = isPartsOnly ? 'avoid'
    : scoreToVerdict(adjustedDealScore);

  function setToggle(id: ConditionToggleId, value: boolean) {
    setToggles((prev) => ({ ...prev, [id]: value }));
  }

  function clearAll() {
    setToggles(
      Object.fromEntries(ALL_TOGGLE_IDS.map((k) => [k, false])) as ToggleState
    );
  }

  return (
    <ReportAdjustmentContext.Provider value={{
      toggles, setToggle, clearAll,
      adjustedCeilingGbp, isPartsOnly,
      adjustedDealScore, adjustedVerdict,
      adjustedMarginPct, adjustedMarginGbp,
    }}>
      {children}
    </ReportAdjustmentContext.Provider>
  );
}

export function useReportAdjustment() {
  const ctx = useContext(ReportAdjustmentContext);
  if (!ctx) throw new Error('useReportAdjustment must be inside ReportAdjustmentProvider');
  return ctx;
}
