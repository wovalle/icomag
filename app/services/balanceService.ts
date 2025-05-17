import { and, gte } from "drizzle-orm";
import { transactions } from "../../database/schema";
import { RepositoryFactory } from "../repositories/RepositoryFactory";

const CURRENT_BALANCE_KEY = "current_balance";
const BALANCE_DATE_KEY = "balance_date";

export class BalanceService {
  private repositoryFactory: RepositoryFactory;

  constructor(repositoryFactory: RepositoryFactory) {
    this.repositoryFactory = repositoryFactory;
  }

  /**
   * Set the current balance and the date it was recorded
   */
  async setCurrentBalance(balance: number, date: Date): Promise<void> {
    const kvStore = this.repositoryFactory.getKVStoreRepository();

    await kvStore.set(CURRENT_BALANCE_KEY, balance.toString());
    await kvStore.set(BALANCE_DATE_KEY, date.getTime().toString());
  }

  /**
   * Get the current balance and the date it was recorded
   */
  async getCurrentBalance(): Promise<{ balance: number; date: Date } | null> {
    const kvStore = this.repositoryFactory.getKVStoreRepository();

    const balanceStr = await kvStore.get(CURRENT_BALANCE_KEY);
    const dateStr = await kvStore.get(BALANCE_DATE_KEY);

    if (!balanceStr || !dateStr) {
      return null;
    }

    return {
      balance: parseFloat(balanceStr),
      date: new Date(parseInt(dateStr)),
    };
  }

  /**
   * Calculate the estimated current balance by adding all transactions since the last recorded balance
   */
  async getEstimatedBalance(): Promise<{
    currentBalance: number | null;
    estimatedBalance: number | null;
    balanceDate: Date | null;
    transactionsSince: number;
  }> {
    const currentBalance = await this.getCurrentBalance();

    if (!currentBalance) {
      return {
        currentBalance: null,
        estimatedBalance: null,
        balanceDate: null,
        transactionsSince: 0,
      };
    }

    const transactionsRepo = this.repositoryFactory.getTransactionsRepository();

    // Get all transactions since the balance date
    const recentTransactions = await transactionsRepo.findMany({
      where: and(
        gte(transactions.date, Math.floor(currentBalance.date.getTime() / 1000))
      ),
    });

    // Calculate the sum of all transactions since the balance date
    let transactionSum = 0;
    for (const transaction of recentTransactions) {
      if (transaction.type === "debit") {
        // Money coming in
        transactionSum += transaction.amount;
      } else if (transaction.type === "credit") {
        // Money going out
        transactionSum -= transaction.amount;
      }
    }

    return {
      currentBalance: currentBalance.balance,
      estimatedBalance: currentBalance.balance + transactionSum,
      balanceDate: currentBalance.date,
      transactionsSince: recentTransactions.length,
    };
  }
}
