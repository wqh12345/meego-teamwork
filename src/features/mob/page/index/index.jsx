import React, { useState, useEffect } from "react";
import { Tabs, Spin } from "antd";
import {
  BrowserRouter,
  Route,
  Routes,
  //useHistory,
  useLocation,
  useNavigate,
  MemoryRouter as Router,
} from "react-router-dom";
import VConsole from "vconsole";
import MbTabBar from "../components/tab-bar/TabBar";
import MbLog from "../log/index";
import MbManagement from "../management/index";
import MbSetting from "../setting/index";
import MbApproval from "../approval/index";
import Registration from "../log/Registration";
import ApprovalDetail from "../approval/ApprovalDetail";
import { getToken } from "../../../../config";
import { getUserRole } from "../../../../api/api";

// 初始化 vConsole 调试插件（必须在 flexible 之前）
//const vConsole = new VConsole({ theme: 'dark' });
// console.log('[vConsole] 调试插件已初始化');

// 引入 rem 自适应方案（在 vConsole 之后，以便查看日志）
import("../../../../util/flexible").then(() => {
  console.log('[Flexible] 模块加载完成');
});

// 需要隐藏 TabBar 的全屏页面路由
const fullScreenRoutes = [
  '/mb/log/registration',
  '/mb/approval/detail'
];

// 检查是否为全屏页面
const isFullScreenRoute = (pathname) => {
  return fullScreenRoutes.some(route => pathname.startsWith(route));
};

// 布局组件 MainLayout
const MainLayout = ({ children, loginUser }) => {
  const location = useLocation();
  const isFullScreen = isFullScreenRoute(location.pathname);

  return (
    <div className="h-screen flex flex-col">
      {/* 主体区域 */}
      <div className={`flex-1 overflow-hidden ${isFullScreen ? '' : 'pb-[88px]'}`}>
        {children}
      </div>
      {/* 底部导航 - 仅在非全屏页面显示 */}
      {!isFullScreen && <MbTabBar />}
    </div>
  );
};

const MbPageIndex = () => {
  const [isShow, setIsShow] = useState(false);
  const [loginUser, setLoginUser] = useState({
    id: "",
    name: "",
    avatar: "",
  });

  const getWorkItemInfo = () => {
    window.JSSDK.Context.load().then((ctx) => {
      const mainSpace = ctx.mainSpace;
      const activeWorkItem = ctx.activeWorkItem;
      const selectedWorkflowNode = ctx.selectedWorkflowNode;
      setLoginUser(ctx.loginUser);
      // 保存登录用户信息到 sessionStorage
      sessionStorage.setItem("jwtMeegoTeamworkLoginUser", JSON.stringify(ctx.loginUser));
      sessionStorage.setItem("jwtMeegoTeamworkUserKey", ctx.loginUser?.id || '');
      sessionStorage.setItem("jwtMeegoTeamworkProjectKey", mainSpace.id);
      getToken().then(async () => {
        const res = await getUserRole();
        if (res?.result) {
          sessionStorage.setItem("jwtMeegoTeamworkUserRole", res.data);
        }
        setIsShow(true);
      });
    });
  };

  useEffect(() => getWorkItemInfo(), []);

  return isShow ? (
    <Router initialEntries={["/mb/log"]}>
      <MainLayout loginUser={loginUser}>
        <Routes>
          <Route
            path="/mb/log"
            element={<MbLog loginUser={loginUser} />}
          ></Route>
          <Route
            path="/mb/log/registration"
            element={<Registration />}
          ></Route>
          <Route
            path="/mb/log/registration/:id"
            element={<Registration />}
          ></Route>
          <Route
            path="/mb/management"
            element={<MbManagement loginUser={loginUser} />}
          ></Route>
          <Route
            path="/mb/approval"
            element={<MbApproval loginUser={loginUser} />}
          ></Route>
          <Route
            path="/mb/approval/detail/:type/:id"
            element={<ApprovalDetail />}
          ></Route>
          {sessionStorage.getItem("jwtMeegoTeamworkUserRole") === "Admin" ? (
            <Route
              path="/mb/setting"
              element={<MbSetting loginUser={loginUser} />}
            ></Route>
          ) : null}
        </Routes>
      </MainLayout>
    </Router>
  ) : (
    <div className="w-full mt-[20%]">
      {/* <Spin /> */}
    </div>
  );
};
export default MbPageIndex;
