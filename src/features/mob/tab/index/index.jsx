import React, { useState, useEffect } from "react";
import { Tabs, Spin } from "antd";
import {
  BrowserRouter,
  Route,
  Routes,
  useHistory,
  useLocation,
  useNavigate,
  MemoryRouter as Router,
} from "react-router-dom";
import MbTabBar from "../components/tab-bar/TabBar";
import MbLog from "../log/index";
import MbManagement from "../management/index";
import MbSetting from "../setting/index";
import { getToken } from "../../../../config";
import { getUserRole } from "../../../../api/api";
import "./index.less";

const MbPageIndex = () => {
  const [isShow, setIsShow] = useState(false);
  const [loginUser, setLoginUser] = useState({
    id: "",
    name: "",
    avatar: "",
  });

  const getWorkItemInfo = () => {
    window.JSSDK.Context.load().then(async (ctx) => {
      const mainSpace = ctx.mainSpace;
      const activeWorkItem = ctx.activeWorkItem;
      const selectedWorkflowNode = ctx.selectedWorkflowNode;
      setLoginUser(ctx.loginUser);
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
      <div className="mb-app">
        <div className="mb-body">
          <Routes>
            <Route
              path="/mb/log"
              element={<MbLog loginUser={loginUser} />}
            ></Route>
            <Route
              path="/mb/management"
              element={<MbManagement loginUser={loginUser} />}
            ></Route>
            {sessionStorage.getItem("jwtMeegoTeamworkUserRole") === "Admin" ? (
              <Route
                path="/mb/setting"
                element={<MbSetting loginUser={loginUser} />}
              ></Route>
            ) : null}
          </Routes>
        </div>
        <div className="mb-bottom">
          <MbTabBar />
        </div>
      </div>
    </Router>
  ) : (
    <Spin style={{ width: "100%", marginTop: "20%" }}></Spin>
  );
};
export default MbPageIndex;
