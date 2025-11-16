import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { VideoDiscovery } from './pages/VideoDiscovery';
import TaskManagement from './pages/TaskManagement';
import AccountManagement from './pages/AccountManagement';
import VideoEditor from './pages/VideoEditor';
import PublishManagement from './pages/PublishManagement';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import SocialMonitoring from './pages/SocialMonitoring';
import Settings from './pages/Settings';
import { useAuth } from './store';

// 保护路由组件
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

// 公开路由组件
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return !isAuthenticated ? <>{children}</> : <Navigate to="/dashboard" />;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* 公开路由 */}
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } 
        />
        <Route 
          path="/register" 
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          } 
        />
        
        {/* 受保护的路由 */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="accounts" element={<AccountManagement />} />
          <Route path="discover" element={<VideoDiscovery />} />
          <Route path="tasks" element={<TaskManagement />} />
          <Route path="editor" element={<VideoEditor />} />
          <Route path="publish" element={<PublishManagement />} />
          <Route path="analytics" element={<AnalyticsDashboard />} />
          <Route path="monitoring" element={<SocialMonitoring />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        
        {/* 404页面 */}
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Router>
  );
}

export default App;