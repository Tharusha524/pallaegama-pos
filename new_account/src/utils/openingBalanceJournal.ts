import { normalizeJournalLineAmounts } from "./journalAmount";
import {
  balanceSheetAmount,
  balanceSheetCategoryForAccount,
  chartMastersToTypeMap,
  formatBsAmount,
  isBalanceSheetAccount,
  isProfitAndLossAccount,
  type ChartGroupMeta,
} from "./trialAccountBalance";

export interface OpeningBalanceLine {
  accountCode?: string;
  selectedAccountCode?: string;
  debit?: string | number;
  credit?: string | number;
}

export interface OpeningBalanceSummary {
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  liabilitiesPlusEquity: number;
  difference: number;
  equationBalanced: boolean;
  hasBalanceSheetLines: boolean;
  hasProfitAndLossLines: boolean;
  grossPostedDebit: number;
  grossPostedCredit: number;
}

/**
 * Opening balance journal: net Assets must equal net Liabilities + Equity.
 * Retained earnings loss (type 7) is a positive Debit in the journal → negative equity on BS.
 */
export function computeOpeningBalanceSummary(
  lines: OpeningBalanceLine[],
  accountTypeByCode: Map<string, number>,
  chartGroupMeta?: Map<number, ChartGroupMeta>
): OpeningBalanceSummary {
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;
  let grossPostedDebit = 0;
  let grossPostedCredit = 0;
  let hasBalanceSheetLines = false;
  let hasProfitAndLossLines = false;

  lines.forEach((line) => {
    const code = String(line.selectedAccountCode || line.accountCode || "").trim();
    if (!code) return;

    const accountType = accountTypeByCode.get(code) ?? 0;
    const { debit, credit } = normalizeJournalLineAmounts(line.debit, line.credit);
    if (Math.abs(debit) < 0.001 && Math.abs(credit) < 0.001) return;

    if (isProfitAndLossAccount(accountType, chartGroupMeta)) {
      hasProfitAndLossLines = true;
    }

    if (!isBalanceSheetAccount(accountType, chartGroupMeta)) return;

    hasBalanceSheetLines = true;

    grossPostedDebit += debit;
    grossPostedCredit += credit;

    const glNet = debit - credit;
    const bsAmount = balanceSheetAmount(glNet, accountType, chartGroupMeta);

    const category = balanceSheetCategoryForAccount(accountType, chartGroupMeta);
    if (category === "assets") totalAssets += bsAmount;
    else if (category === "liabilities") totalLiabilities += bsAmount;
    else if (category === "equity") totalEquity += bsAmount;
  });

  const liabilitiesPlusEquity = totalLiabilities + totalEquity;
  const difference = totalAssets - liabilitiesPlusEquity;

  return {
    totalAssets: round2(totalAssets),
    totalLiabilities: round2(totalLiabilities),
    totalEquity: round2(totalEquity),
    liabilitiesPlusEquity: round2(liabilitiesPlusEquity),
    difference: round2(difference),
    equationBalanced: Math.abs(difference) <= 0.01,
    hasBalanceSheetLines,
    hasProfitAndLossLines,
    grossPostedDebit: round2(grossPostedDebit),
    grossPostedCredit: round2(grossPostedCredit),
  };
}

/**
 * When debit/credit columns balance but Assets ≠ L+E, explain that P&L lines are excluded.
 */
export function getOpeningBalanceEquationHint(
  summary: OpeningBalanceSummary,
  journalColumnBalanced = false
): string | null {
  if (!summary.hasBalanceSheetLines || summary.equationBalanced) {
    return null;
  }

  if (journalColumnBalanced && summary.hasProfitAndLossLines) {
    return "Debit and credit columns balance, but Income/Expense accounts are not part of the balance sheet equation. Offset asset or liability lines with another balance sheet account (e.g. Retained Earnings), not Income or Expense.";
  }

  if (journalColumnBalanced) {
    return "Debit and credit columns balance, but net Assets must equal Liabilities + Equity. Add or adjust Liability or Equity lines.";
  }

  return "Fix debit/credit column balance first, then ensure net Assets equals Liabilities + Equity.";
}

export { formatBsAmount, chartMastersToTypeMap };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
