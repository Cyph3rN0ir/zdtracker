import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  businessAccountBalancesFn,
  getBusinessFn,
  getPersonalProfileFn,
  listBusinessAccountsFn,
  listBusinessesFn,
  listBusinessTasksFn,
  listMembersFn,
  listPersonalAccountsFn,
  listPersonalBudgetsFn,
  listPersonalCategoriesFn,
  listPersonalCounterpartiesFn,
  listPersonalLoansFn,
  listPersonalProfilesFn,
  listPersonalTxExFn,
  listTransactionsFn,
  myTasksFn,
} from "@/lib/zt.functions";
import { listListsFn, listNotesFn, listTodosFn } from "@/lib/notebook.functions";
import {
  getConversationFn,
  listConversationsFn,
  listMessagesFn,
  unreadTotalFn,
} from "@/lib/chat.functions";

type NoInputLoader = () => Promise<unknown>;
type InputLoader<T> = (options: { data: T }) => Promise<unknown>;

export type OfflineLoaders = {
  listBusinesses: NoInputLoader;
  listMyTasks: NoInputLoader;
  listPersonalProfiles: NoInputLoader;
  listNotebookLists: NoInputLoader;
  listTodos: InputLoader<{
    from?: string;
    to?: string;
    listId?: string;
    includeOverdue?: boolean;
    includeUnscheduled?: boolean;
  }>;
  listNotes: InputLoader<{ listId: string }>;
  listConversations: NoInputLoader;
  unreadTotal: NoInputLoader;
  getConversation: InputLoader<{ conversationId: string }>;
  listMessages: InputLoader<{ conversationId: string; limit?: number }>;
  getBusiness: InputLoader<{ id: string }>;
  listMembers: InputLoader<{ businessId: string }>;
  listBusinessTasks: InputLoader<{ businessId: string; weekStart: string }>;
  listTransactions: InputLoader<{ businessId: string }>;
  listBusinessAccounts: InputLoader<{ businessId: string }>;
  businessAccountBalances: InputLoader<{ businessId: string }>;
  getPersonalProfile: InputLoader<{ id: string }>;
  listPersonalTransactions: InputLoader<{ profileId: string }>;
  listPersonalAccounts: InputLoader<{ profileId: string }>;
  listPersonalCategories: InputLoader<{ profileId: string }>;
  listPersonalCounterparties: InputLoader<{ profileId: string }>;
  listPersonalLoans: InputLoader<{ profileId: string }>;
  listPersonalBudgets: InputLoader<{ profileId: string }>;
};

// Server functions must be wrapped from React before they can issue an
// authenticated client RPC. Calling the definitions directly works during
// server rendering but fails in the Capacitor SPA.
export function useOfflineLoaders(): OfflineLoaders {
  const listBusinesses = useServerFn(listBusinessesFn);
  const listMyTasks = useServerFn(myTasksFn);
  const listPersonalProfiles = useServerFn(listPersonalProfilesFn);
  const listNotebookLists = useServerFn(listListsFn);
  const listTodos = useServerFn(listTodosFn);
  const listNotes = useServerFn(listNotesFn);
  const listConversations = useServerFn(listConversationsFn);
  const unreadTotal = useServerFn(unreadTotalFn);
  const getConversation = useServerFn(getConversationFn);
  const listMessages = useServerFn(listMessagesFn);
  const getBusiness = useServerFn(getBusinessFn);
  const listMembers = useServerFn(listMembersFn);
  const listBusinessTasks = useServerFn(listBusinessTasksFn);
  const listTransactions = useServerFn(listTransactionsFn);
  const listBusinessAccounts = useServerFn(listBusinessAccountsFn);
  const businessAccountBalances = useServerFn(businessAccountBalancesFn);
  const getPersonalProfile = useServerFn(getPersonalProfileFn);
  const listPersonalTransactions = useServerFn(listPersonalTxExFn);
  const listPersonalAccounts = useServerFn(listPersonalAccountsFn);
  const listPersonalCategories = useServerFn(listPersonalCategoriesFn);
  const listPersonalCounterparties = useServerFn(listPersonalCounterpartiesFn);
  const listPersonalLoans = useServerFn(listPersonalLoansFn);
  const listPersonalBudgets = useServerFn(listPersonalBudgetsFn);

  return useMemo(
    () => ({
      listBusinesses,
      listMyTasks,
      listPersonalProfiles,
      listNotebookLists,
      listTodos,
      listNotes,
      listConversations,
      unreadTotal,
      getConversation,
      listMessages,
      getBusiness,
      listMembers,
      listBusinessTasks,
      listTransactions,
      listBusinessAccounts,
      businessAccountBalances,
      getPersonalProfile,
      listPersonalTransactions,
      listPersonalAccounts,
      listPersonalCategories,
      listPersonalCounterparties,
      listPersonalLoans,
      listPersonalBudgets,
    }),
    [
      listBusinesses,
      listMyTasks,
      listPersonalProfiles,
      listNotebookLists,
      listTodos,
      listNotes,
      listConversations,
      unreadTotal,
      getConversation,
      listMessages,
      getBusiness,
      listMembers,
      listBusinessTasks,
      listTransactions,
      listBusinessAccounts,
      businessAccountBalances,
      getPersonalProfile,
      listPersonalTransactions,
      listPersonalAccounts,
      listPersonalCategories,
      listPersonalCounterparties,
      listPersonalLoans,
      listPersonalBudgets,
    ],
  );
}
