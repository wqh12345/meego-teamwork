import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import LogPage from '../pages/Log';
import ApprovalPage from '../pages/Approval';
import Registration from '../pages/Log/Registration';
import ApprovalDetail from '../pages/Approval/ApprovalDetail';

// 路由配置
const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/log" replace />,
  },
  {
    path: '/log',
    element: <LogPage />,
  },
  {
    path: '/log/registration',
    element: <Registration />,
  },
  {
    path: '/log/registration/:id',
    element: <Registration />,
  },
  {
    path: '/approval',
    element: <ApprovalPage />,
  },
  {
    path: '/approval/detail/:type/:id',
    element: <ApprovalDetail />,
  },
]);

export default router;
