import React, { useState, useEffect } from "react";
import { Tabs, Button, Dropdown, Spin, Modal } from "antd";
import {
  QuestionOutlined,
  ReadOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import Resource from "../resource";
import Log from "../log";
import Approval from "../approval";
import Management from "../management";
import Set from "../../components/set/Set";
import Pay from "../pay";
import { getToken } from "../../../../config";
import {
  getUserRole,
  getSyncMeego,
  getJudgeProjectHasAdmin,
  getSyncStateMeego,
  postUserActive,
  getPayJumpInfo,
  setJumpPayUuid,
  getTenantModeInfo,
} from "../../../../api/api";
import { getUrlState, generateUuid, canShowTenantAdminFeature } from "../../../../util/util";
import TopAlert from "../../components/top-alert/TopAlert";
import PublicModal from "../../components/public-modal/PublicModal";
import CustInfoModal from "../../components/cust-info-modal/CustInfoModal";
import ExpirationModal from "../../components/expiration-modal/ExpirationModal";
import IsvGuidePage from "../../components/isv-guide";
import CrossSpaceUpgradeModal from "../../components/CrossSpaceUpgradeModal";
import { refreshTenantCustomFieldConfig } from "../../hooks/useTenantCustomFieldConfig";
import pluginConfig from "../../../../../plugin.config.json";
import "./index.less";

const Index = () => {
  const [current, setCurrent] = useState("resource");
  const [hasAuth, setHasAuth] = useState(false);
  const [isShow, setIsShow] = useState(false);
  const [isShowPublicModal, setIsShowPublicModal] = useState(false);
  const [loginUser, setLoginUser] = useState({
    id: "",
    name: "",
    avatar: "",
  });
  const [spaceInfo, setSpaceInfo] = useState({});
  const [isFromHref, setIsFromHref] = useState(false);
  const [userRole, setUserRole] = useState('member'); // 用户角色状态
  const [mode, setMode] = useState(''); // 用户角色状态
  const [showIsvGuide, setShowIsvGuide] = useState(false); // ISV引导页状态
  const [showCrossSpaceUpgrade, setShowCrossSpaceUpgrade] = useState(false); // 跨空间升级弹窗状态

  // 弹窗优先级状态管理
  const [needExpirationModal, setNeedExpirationModal] = useState(false); // 权益弹窗是否需要显示
  const [needCustInfoModal, setNeedCustInfoModal] = useState(false); // 留资弹窗是否需要显示
  const [showExpirationModal, setShowExpirationModal] = useState(false); // 权益弹窗当前是否显示
  const [showCustInfoModal, setShowCustInfoModal] = useState(false); // 留资弹窗当前是否显示
  // ===================== 新增：浏览器刷新监听与跳转逻辑 =====================
  useEffect(() => {
    // 1. 监听浏览器「刷新/关闭」事件（beforeunload）
    const handleBeforeUnload = (e) => {
      // 记录「刷新状态」到sessionStorage（刷新后页面会重新加载，需通过存储状态判断）
      sessionStorage.setItem("isBrowserRefreshed", "true");
      // 记录「刷新后跳转目标」（可自定义：内部Tab键/外部链接）
      // 示例1：跳转内部Tab（如“资源管理”）
      sessionStorage.setItem("refreshRedirectTarget", "resource");
      // 示例2：跳转外部页面（需替换为实际链接，与现有JSSDK导航逻辑保持一致）
      // sessionStorage.setItem("refreshRedirectUrl", `https://${hostname}/${spaceInfo?.simpleName}/resource`);

      // 浏览器安全限制：beforeunload事件中无法直接跳转，需通过存储状态在刷新后执行
      // 以下代码用于触发浏览器默认提示（可选，可删除）
      e.preventDefault();
      e.returnValue = ""; // 部分浏览器要求必须设置returnValue
      return "";
    };

    // 添加事件监听
    window.addEventListener("beforeunload", handleBeforeUnload);

    // 组件卸载时清除监听（防止内存泄漏）
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [spaceInfo]); // 依赖spaceInfo（若跳转外部页面需用到空间信息）

  // 2. 刷新后页面重新加载：检查状态并执行跳转
  useEffect(() => {
    const checkRefreshAndRedirect = async () => {
      // 获取存储的刷新状态和跳转目标
      const isRefreshed = sessionStorage.getItem("isBrowserRefreshed");
      const redirectTargetTab = sessionStorage.getItem("refreshRedirectTarget"); // 内部Tab键
      const redirectExternalUrl = sessionStorage.getItem("refreshRedirectUrl"); // 外部链接
      // getWorkItemInfo()
      // setCurrent("pay");

      window.JSSDK.Context.load().then(async (ctx) => {
        const mainSpace = ctx.mainSpace;
        const space = await window.JSSDK.Space.load(mainSpace?.id);
        setSpaceInfo(space);
        setLoginUser(ctx.loginUser);
        sessionStorage.setItem("jwtMeegoTeamworkUserId", ctx.loginUser.id);
        sessionStorage.setItem("jwtMeegoTeamworkProjectKey", mainSpace.id);
        getToken().then(async () => {
          // 若存在刷新状态，执行跳转逻辑
          if (isRefreshed === "true") {
            // 场景1：跳转内部Tab（如“资源管理”）
            if (redirectTargetTab) {
              setCurrent("resource");
              //console.log(`刷新后跳转到内部Tab：${redirectTargetTab}`);
            }
            // 场景2：跳转外部页面（使用现有JSSDK导航方法，避免直接用window.location）
            if (redirectExternalUrl) {
              try {
                await window.JSSDK.navigation.open(redirectExternalUrl, "_self"); // _self表示当前窗口打开
                //console.log(`刷新后跳转到外部页面：${redirectExternalUrl}`);
              } catch (error) {
                console.error("刷新后跳转外部页面失败：", error);
                // 降级方案：若JSSDK导航失败，使用原生location
                window.location.href = redirectExternalUrl;
              }
            }

            // 清除存储状态（避免下次加载时重复跳转）
            sessionStorage.removeItem("isBrowserRefreshed");
            sessionStorage.removeItem("refreshRedirectTarget");
            sessionStorage.removeItem("refreshRedirectUrl");
          } else {
            const jumptab = async () => {
              const parentHref = await window.JSSDK.navigation.getHref();
              const state = getUrlState(parentHref);
              console.log("state", state);
              if (state?.jumpUrl) {
                const approvalInfo = {
                  id: state?.id,
                  approvalId: state?.approvalId,
                  leftMenu: 'self-approve',
                  curApprovalType: state.single === "true" ? "single" : "all"
                };
                sessionStorage.setItem("approvalInfo", JSON.stringify(approvalInfo));
                setCurrent("approval");
                const jumpUrl = state?.jumpUrl;
              } else {
                //console.log("jumpUrl", state?.uuid);
                if (state?.uuid) {
                  if(state?.isSeat == 1){
                    console.log("isSeat", state?.isSeat);
                    sessionStorage.setItem("jumpPayUuid", state.uuid);
                  }
                  const info = await getPayJumpInfo({ "uuid": state.uuid });
                  if (info?.result && info?.data == 1) {
                    const data = {
                      uuid: state.uuid,
                      value: 0
                    };
                    setJumpPayUuid(data);
                    setCurrent("pay");
                  }
                } else {
                  //console.log("0000");
                  setCurrent("resource");
                }
              }
            }
            jumptab()
          }
          const showIsvGuide= await getTenantModeInfoData();
          if (showIsvGuide) {
            setHasAuth(true);
            setIsShow(true);
            syncMeego();
          }else{
            checkedHasAuth();
          }
          const res = await getUserRole();
          if (res?.result) {
            sessionStorage.setItem("jwtMeegoTeamworkUserRole", res.data);
          }
          getUserActive();
        });
      });
    };

    // 页面初始化时执行检查
    checkRefreshAndRedirect();
  }, []);
  // ===================== 刷新跳转逻辑结束 =====================

  const getWorkItemInfo = async () => {
    window.JSSDK.Context.load().then(async (ctx) => {
      const mainSpace = ctx.mainSpace;
      const space = await window.JSSDK.Space.load(mainSpace?.id);
      setSpaceInfo(space);
      setLoginUser(ctx.loginUser);
      sessionStorage.setItem("jwtMeegoTeamworkUserId", ctx.loginUser.id);
      sessionStorage.setItem("jwtMeegoTeamworkProjectKey", mainSpace.id);
      getToken().then(async () => {
       

        checkedHasAuth();
        const res = await getUserRole();
        if (res?.result) {
          sessionStorage.setItem("jwtMeegoTeamworkUserRole", res.data);
        }
        getUserActive();
      });
    });
  };

  useEffect(() => {
    //getWorkItemInfo();
  }, []);

  /** 埋点：记录用户打开Page页频次 */
  const getUserActive = async () => {
    await postUserActive({
      activeType: "PluginInternal",
    });
  };

  const onClick = (key) => {
    if (key === current) {
      return;
    }

    if (sessionStorage.getItem("approvalInfo")) {
      sessionStorage.removeItem("approvalInfo");
    }
    if (sessionStorage.getItem("jumpPayUuid")) {
      sessionStorage.removeItem("jumpPayUuid");
    }
    refreshTenantCustomFieldConfig();
    setCurrent(key);
    setIsFromHref(false);
  };

  const syncMeego = async () => {
    await getSyncMeego();
    await getSyncStateMeego();
  };
     /** 校验管理员权限 */
  const getTenantModeInfoData = async () => {
    const res = await getTenantModeInfo();
    if (!res?.result) return false;

    const data = res.data || {};
    sessionStorage.setItem('tenantModeInfo', JSON.stringify(data));

    // 更新状态
    //setUserRole(data.userRole);
    if (data.userRole)  setUserRole(data.userRole)
    setMode(data.mode || '');
    // 解构关键字段
    const { install, workHourPluginInstalled, guideDisplayed } = data;
    // let install = data.install, workHourPluginInstalled = data.workHourPluginInstalled, guideDisplayed = data.guideDisplayed;
    // install=false
    // workHourPluginInstalled=true
    // guideDisplayed=false
    // 已安装租户但未安装工时插件 → 展示 ISV 引导页
    if (install && !workHourPluginInstalled && !guideDisplayed) {
      return true;
    }
    if (install && workHourPluginInstalled) {
      return true;
    }
    // 未安装租户但已安装工时插件 → 展示跨空间升级弹窗
    // if (!install && workHourPluginInstalled && !guideDisplayed) {
    //   setShowCrossSpaceUpgrade(true);
    // }

    return false;
  };
  /** 判断是否有管理员 */
  const checkedHasAuth = async () => {
    const res = await getJudgeProjectHasAdmin();
    if (res?.result) {
      setHasAuth(res?.data);
      setIsShow(true);
      syncMeego();
      if (!res?.data)
        Modal.info({
          title: "使用提示",
          styles: {
            mask: {
              backgroundColor: "rgba(0, 0, 0, 0.15)",
            },
          },
          content: (
            <div>
              请联系空间管理员进入【
              <Button
                type="link"
                style={{ padding: 0 }}
                onClick={async () => {
                  const hostname = await window.JSSDK.navigation.getHostname();
                  window.JSSDK.Context.load().then(async (ctx) => {
                    const mainSpace = ctx.mainSpace;
                    const space = await window.JSSDK.Space.load(mainSpace?.id);
                    window.JSSDK.navigation.open(
                      `https://${hostname}/${space?.simpleName}/setting/integrationManagement`
                    );
                  });
                }}
              >
                空间配置-插件管理
              </Button>
              -工时资源管理-配置】，分配管理员席位后，重新进入插件即可使用。
            </div>
          ),
          footer: (
            <div
              style={{
                marginTop: "20px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Button
                type="primary"
                onClick={async () => {
                  const hostname = await window.JSSDK.navigation.getHostname();
                  window.JSSDK.Context.load().then(async (ctx) => {
                    const mainSpace = ctx.mainSpace;
                    const space = await window.JSSDK.Space.load(mainSpace?.id);
                    window.JSSDK.navigation.open(
                      `https://${hostname}/${space?.simpleName}/setting/integrationManagement`
                    );
                  });
                }}
              >
                立即配置
              </Button>
            </div>
          ),
        });
    }
  };

  const [code, setCode] = useState("");
  const getCode = () => {
    window.JSSDK.utils.getAuthCode().then(async (code) => {
      setCode(code.code);
    });
  };

  useEffect(() => getCode(), []);

  // 弹窗优先级控制逻辑
  // 优先级：1.ISV引导页 > 2.跨空间升级弹窗 > 3.权益弹窗 > 4.留资弹窗 > 5.公告弹窗
  useEffect(() => {
    if (showIsvGuide) {
      // 优先级1: ISV引导页 — 隐藏所有其他弹窗
      setShowCrossSpaceUpgrade(false);
      setShowExpirationModal(false);
      setShowCustInfoModal(false);
      setIsShowPublicModal(false);
    } else if (showCrossSpaceUpgrade) {
      // 优先级2: 跨空间升级弹窗 — 隐藏低优先级弹窗
      setShowExpirationModal(false);
      setShowCustInfoModal(false);
      setIsShowPublicModal(false);
    } else if (needExpirationModal) {
      // 优先级3: 权益弹窗 — 显示并隐藏低优先级弹窗
      setShowExpirationModal(true);
      setShowCustInfoModal(false);
      setIsShowPublicModal(false);
    } else if (needCustInfoModal) {
      // 优先级4: 留资弹窗 — 显示并隐藏更低优先级弹窗
      setShowExpirationModal(false);
      setShowCustInfoModal(true);
      setIsShowPublicModal(false);
    } else if (isShowPublicModal) {
      // 优先级5: 公告弹窗（最低优先级）
      setShowExpirationModal(false);
      setShowCustInfoModal(false);
    } else {
      // 没有弹窗需要显示，全部隐藏
      setShowExpirationModal(false);
      setShowCustInfoModal(false);
    }
  }, [showIsvGuide, showCrossSpaceUpgrade, needExpirationModal, needCustInfoModal, isShowPublicModal]);

  if (showIsvGuide) {
    return <IsvGuidePage initialRole={userRole} onComplete={() => { setShowIsvGuide(false); setCurrent("resource"); checkedHasAuth(); }} />;
  }

  return isShow ? (
    hasAuth ? (
      <div className="page-warp">
        <ExpirationModal
          open={showExpirationModal}
          onClose={() => setShowExpirationModal(false)}
          onNeedShow={(need) => setNeedExpirationModal(need)}
        />
        <TopAlert onInstallISV={() => {}} />
        <CrossSpaceUpgradeModal
          visible={showCrossSpaceUpgrade && !showIsvGuide}
          onClose={() => setShowCrossSpaceUpgrade(false)}
          onStart={() =>{} }
          role={userRole}
        />
        {isShowPublicModal && !showIsvGuide && !showCrossSpaceUpgrade && !needExpirationModal && !needCustInfoModal ? <PublicModal /> : null}
        <CustInfoModal
          open={showCustInfoModal}
          onClose={() => setShowCustInfoModal(false)}
          onNeedShow={(need) => setNeedCustInfoModal(need)}
          isShowPublicModal={(val) => setIsShowPublicModal(val)}
        />
        <Tabs
          className="page-tabs"
          destroyInactiveTabPane={true}
          centered={true}
          activeKey={current}
          defaultActiveKey="log"
          items={[
            {
              label: "资源管理",
              key: "resource",
              children: <Resource loginUser={loginUser} />,
            },
            {
              label: "工时日志",
              key: "log",
              children: <Log loginUser={loginUser} />,
            },
            {
              label: "工时审批",
              key: "approval",
              children: (
                <Approval loginUser={loginUser} isFromHref={isFromHref} />
              ),
            },
            {
              label: "工时管理",
              key: "management",
              children: <Management loginUser={loginUser} />,
            },
            (canShowTenantAdminFeature()
              ? {
                  label: "系统设置",
                  key: "sys",
                  children: <Set loginUser={loginUser} />,
                }
              : null),
            {
              label: "方案中心",
              key: "pay",
              children: <Pay loginUser={loginUser} />,
            },
          ].filter(Boolean)} // 过滤null项（非Admin时移除"插件设置"）
          onChange={onClick}
          tabBarExtraContent={<HelpBtn userRole={userRole} mode={mode} />}
        ></Tabs>
        {pluginConfig.pluginId === "MII_664AE0D1DE040001" || pluginConfig.pluginId === "MII_6695DDDC36A18001" ? (
          <div>code：{code}</div>
        ) : null}
      </div>
    ) : (
      <div className="page-warp" style={{ background: "#fff" }}></div>
    )
  ) : (
    <Spin style={{ width: "100%", marginTop: "20%" }}></Spin>
  );
};

export default Index;

const HelpBtn = ({ userRole, mode }) => {
  const projectKey = sessionStorage.getItem("jwtMeegoTeamworkProjectKey");
  const items = [
    {
      key: "1",
      icon: <ReadOutlined />,
      label: (
        <a
          type="text"
          onClick={() =>
            window.JSSDK.navigation.open(
              "https://ldkj.feishu.cn/docx/VkRid1jaqo4q1OxhSntc2wCcnXm",
              "_blank"
            )
          }
        >
          操作手册
        </a>
      ),
    },
    {
      key: "2",
      icon: <TeamOutlined />,
      label: (
        <a
          type="text"
          onClick={() =>
            window.JSSDK.navigation.open(
              "https://applink.feishu.cn/client/chat/chatter/add_by_link?link_token=993q1f97-5a93-481b-b79a-6447181961c4",
              "_blank"
            )
          }
        >
          我要咨询
        </a>
      ),
    },
  ];
  return (
    <div>
      {/* <span style={{ cursor: "pointer", marginRight: "30px", color: "#4247f6" }}
        onClick={() => {
          window.JSSDK.navigation.open(`https://applink.feishu.cn/client/web_app/open?appId=cli_a9572ba449785cc5&mode=appCenter&reload=false&lk_target_url=https%3A%2F%2Ftimeisv-web-dev.lundong.com.cn%2Fmanagement%3Fmode%3D${mode}%26projectKey%3D${projectKey}`);
        }}
      >
        ISV管理后台
      </span> */}
      {canShowTenantAdminFeature(1) && (
        <span style={{ cursor: "pointer", marginRight: "30px", color: "#4247f6" }}
          onClick={() => {
            window.JSSDK.navigation.open(`https://applink.feishu.cn/client/web_app/open?appId=${pluginConfig.timeisvAppId}&mode=appCenter&reload=false&lk_target_url=https%3A%2F%2F${pluginConfig.timeisvServerUrl}%2Fadmin%3Fmode%3D${mode}%26projectKey%3D${projectKey}`);
          }}
        >
          ISV系统设置
        </span>
      )}
    <Dropdown
      menu={{
        items,
      }}
      placement="bottomRight"
      arrow
    >
      <Button
        className="help-icon"
        type="primary"
        shape="circle"
        icon={<QuestionOutlined />}
      />
    </Dropdown>
    </div>
  );
};
