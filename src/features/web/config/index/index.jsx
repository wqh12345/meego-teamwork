import React, { useState, useEffect } from "react";
import TopAlert from "../../components/top-alert/TopAlert";
import PublicModal from "../../components/public-modal/PublicModal";
import CustInfoModal from "../../components/cust-info-modal/CustInfoModal";
import ExpirationModal from "../../components/expiration-modal/ExpirationModal";
import Set from "../../components/set/Set";
import { getToken } from "../../../../config";
import { getUserRole, postUserActive, getTenantModeInfo } from "../../../../api/api";
import "./index.less";
import { Spin } from "antd";
const Index = () => {
  const [isShow, setIsShow] = useState(false);
  const [isShowPublicModal, setIsShowPublicModal] = useState(false);
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
      sessionStorage.setItem("jwtMeegoTeamworkUserId", ctx.loginUser?.id);
      sessionStorage.setItem("jwtMeegoTeamworkProjectKey", mainSpace?.id);
      getToken().then(async () => {
        const res2 = await getTenantModeInfo();
        if (res2?.result){
          const data = res2.data || {};
          sessionStorage.setItem('tenantModeInfo', JSON.stringify(data));
        }
        const res = await getUserRole();
        if (res?.result) {
          sessionStorage.setItem("jwtMeegoTeamworkUserRole", res.data);
        }
        setIsShow(true);
        getUserActive();
      });
    });
  };

  useEffect(() => getWorkItemInfo(), []);

  /** 埋点：记录用户打开配置页频次 */
  const getUserActive = async () => {
    await postUserActive({
      activeType: "ConfigurationPage",
    });
  };

  return isShow ? (
    <div className="config-warp" style={{marginTop: '0'}}>
      <ExpirationModal />
      <TopAlert />
      {isShowPublicModal ? <PublicModal /> : null}
      <CustInfoModal isShowPublicModal={(val) => setIsShowPublicModal(val)} />
      <Set loginUser={loginUser} />
    </div>
  ) : (
    <Spin style={{ width: "100%", marginTop: "20%" }}></Spin>
  );
};

export default Index;
