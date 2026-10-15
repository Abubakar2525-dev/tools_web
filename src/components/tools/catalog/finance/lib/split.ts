/** Bill splitting and group settle-up. All money is handled in integer minor units (cents). */

import { allocate } from "./money";

export type SplitItem = { amount: number; people: number[] };

/**
 * Itemized split: each item is shared equally by its assigned people; tax and
 * tip (in minor units) are distributed in proportion to each person's subtotal.
 * Returns per-person subtotal, tax, tip and total, all summing exactly.
 */
export function itemizedSplit(peopleCount: number, items: SplitItem[], taxMinor: number, tipMinor: number) {
  const sub = new Array<number>(peopleCount).fill(0);
  for (const it of items) {
    const who = it.people.filter((p) => p >= 0 && p < peopleCount);
    if (!who.length || it.amount <= 0) continue;
    const parts = allocate(it.amount, who.map(() => 1));
    who.forEach((p, k) => (sub[p] += parts[k]));
  }
  const tax = allocate(taxMinor, sub);
  const tip = allocate(tipMinor, sub);
  return sub.map((s, i) => ({ subtotal: s, tax: tax[i], tip: tip[i], total: s + tax[i] + tip[i] }));
}

export type Transfer = { from: number; to: number; amount: number };

/**
 * Settles net balances (positive = is owed, negative = owes) by repeatedly
 * matching the largest debtor with the largest creditor. This needs at most
 * n − 1 transfers; finding the absolute minimum is NP-hard in general, but this
 * greedy result is optimal or close in typical groups.
 */
export function settle(balances: number[]): Transfer[] {
  const cred = balances.map((b, i) => ({ i, b })).filter((x) => x.b > 0);
  const debt = balances.map((b, i) => ({ i, b: -b })).filter((x) => x.b > 0);
  const out: Transfer[] = [];
  while (cred.length && debt.length) {
    cred.sort((a, b) => b.b - a.b || a.i - b.i);
    debt.sort((a, b) => b.b - a.b || a.i - b.i);
    const c = cred[0];
    const d = debt[0];
    const amt = Math.min(c.b, d.b);
    out.push({ from: d.i, to: c.i, amount: amt });
    c.b -= amt;
    d.b -= amt;
    if (c.b === 0) cred.shift();
    if (d.b === 0) debt.shift();
  }
  return out;
}

export type GroupExpense = { payer: number; amount: number; among: number[] };

/** Net balance per person from shared expenses (minor units). */
export function balancesFrom(peopleCount: number, expenses: GroupExpense[]) {
  const paid = new Array<number>(peopleCount).fill(0);
  const share = new Array<number>(peopleCount).fill(0);
  for (const e of expenses) {
    const among = e.among.filter((p) => p >= 0 && p < peopleCount);
    if (e.payer < 0 || e.payer >= peopleCount || !among.length || e.amount <= 0) continue;
    paid[e.payer] += e.amount;
    const parts = allocate(e.amount, among.map(() => 1));
    among.forEach((p, k) => (share[p] += parts[k]));
  }
  return paid.map((p, i) => ({ paid: p, share: share[i], net: p - share[i] }));
}
