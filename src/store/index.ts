import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 用户状态接口
interface User {
  id: string;
  email: string;
  name: string;
  plan: 'free' | 'premium' | 'enterprise';
  usage_count: number;
  max_daily_tasks: number;
}

// 任务状态接口
export interface Task {
  id: string;
  user_id: string;
  task_type: 'download' | 'process' | 'publish' | 'batch';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  source_config: any;
  target_config: any;
  processing_config: any;
  progress: number;
  error_message?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

// 账号状态接口
interface Account {
  id: string;
  user_id: string;
  platform: 'douyin' | 'kuaishou' | 'xiaohongshu' | 'bilibili' | 'wechat';
  username: string;
  is_active: boolean;
  account_info: any;
  created_at: string;
}

// 应用状态接口
interface AppState {
  // 用户相关
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // 任务相关
  tasks: Task[];
  currentTask: Task | null;
  
  // 账号相关
  accounts: Account[];
  
  // 通知相关
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
    timestamp: string;
  }>;
  
  // 方法
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  setCurrentTask: (task: Task | null) => void;
  setAccounts: (accounts: Account[]) => void;
  addAccount: (account: Account) => void;
  removeAccount: (accountId: string) => void;
  addNotification: (notification: Omit<AppState['notifications'][0], 'id' | 'timestamp'>) => void;
  removeNotification: (notificationId: string) => void;
  clearNotifications: () => void;
}

// 创建状态存储
export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // 初始状态
      user: null,
      isAuthenticated: false,
      isLoading: false,
      tasks: [],
      currentTask: null,
      accounts: [],
      notifications: [],
      
      // 用户相关方法
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setLoading: (loading) => set({ isLoading: loading }),
      
      // 任务相关方法
      setTasks: (tasks) => set({ tasks }),
      addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),
      updateTask: (taskId, updates) => set((state) => ({
        tasks: state.tasks.map(task => 
          task.id === taskId ? { ...task, ...updates } : task
        ),
        currentTask: state.currentTask?.id === taskId 
          ? { ...state.currentTask, ...updates } 
          : state.currentTask
      })),
      setCurrentTask: (task) => set({ currentTask: task }),
      
      // 账号相关方法
      setAccounts: (accounts) => set({ accounts }),
      addAccount: (account) => set((state) => ({ 
        accounts: [...state.accounts, account] 
      })),
      removeAccount: (accountId) => set((state) => ({
        accounts: state.accounts.filter(account => account.id !== accountId)
      })),
      
      // 通知相关方法
      addNotification: (notification) => set((state) => ({
        notifications: [{
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toISOString(),
          ...notification
        }, ...state.notifications]
      })),
      removeNotification: (notificationId) => set((state) => ({
        notifications: state.notifications.filter(n => n.id !== notificationId)
      })),
      clearNotifications: () => set({ notifications: [] }),
    }),
    {
      name: 'short-video-tool-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        accounts: state.accounts,
      }),
    }
  )
);

// 选择器钩子
export const useAuth = () => {
  const { user, isAuthenticated, setUser, setLoading } = useStore();
  return { user, isAuthenticated, setUser, setLoading };
};

export const useTasks = () => {
  const { tasks, currentTask, setTasks, addTask, updateTask, setCurrentTask } = useStore();
  return { tasks, currentTask, setTasks, addTask, updateTask, setCurrentTask };
};

export const useAccounts = () => {
  const { accounts, setAccounts, addAccount, removeAccount } = useStore();
  return { accounts, setAccounts, addAccount, removeAccount };
};

export const useNotifications = () => {
  const { notifications, addNotification, removeNotification, clearNotifications } = useStore();
  return { notifications, addNotification, removeNotification, clearNotifications };
};