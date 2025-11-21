import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  User, 
  Search, 
  Video, 
  Edit3, 
  Send, 
  Settings,
  BarChart3,
  Monitor,
  MessageCircle
} from 'lucide-react';

const menuItems = [
  { path: '/dashboard', icon: Home, label: '仪表盘' },
  { path: '/accounts', icon: User, label: '账号管理' },
  { path: '/discover', icon: Search, label: '视频发现' },
  { path: '/wechat', icon: MessageCircle, label: '公众号热点' },
  { path: '/tasks', icon: Video, label: '任务管理' },
  { path: '/editor', icon: Edit3, label: '视频编辑' },
  { path: '/publish', icon: Send, label: '发布管理' },
  { path: '/analytics', icon: BarChart3, label: '数据分析' },
  { path: '/monitoring', icon: Monitor, label: '社交监控' },
  { path: '/settings', icon: Settings, label: '系统设置' },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();

  return (
    <div className="w-64 bg-white shadow-lg">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-blue-600">短视频搬运工具</h1>
      </div>
      
      <nav className="mt-6">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center px-6 py-3 text-sm font-medium transition-colors duration-200 ${
                isActive
                  ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className="w-5 h-5 mr-3" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};