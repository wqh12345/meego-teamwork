import { useEffect, useState } from "react";
import { Modal, Badge, Button, Space } from "antd";
import { getPlanMessage, setJumpPayUuid,getDisplayLogic} from "../../../../api/api";
import { generateUuid,canShowTenantAdminFeature} from "../../../../util/util";
import pluginConfig from "../../../../../plugin.config.json";
export const SeatPermissionsModal = (props) => {
  const { open, code, responseData, chatUrl, onClose } = props;
  const [currentOpen, setCurrentOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    title: "",
    content: null,
    footer: null,
  });
  const handlePaymentRedirect= async () => {
    const hostname = await window.JSSDK.navigation.getHostname();
    window.JSSDK.Context.load().then(async (ctx) => {
      const mainSpace = ctx.mainSpace;
      const space = await window.JSSDK.Space.load(mainSpace?.id);
      const data={
        uuid:generateUuid(),
        value:1
      }
      try {
        const res = await setJumpPayUuid(data);
        if (res?.result) {  // 确保API调用成功后再跳转
          window.JSSDK.navigation.open(
            `https://${hostname}/${space?.simpleName}/meegoPlg/${pluginConfig.pluginId}_${pluginConfig.boardKey}?uuid=${data.uuid}`
          );
        }
      } catch (error) {
        window.JSSDK.navigation.open(
          `https://${hostname}/${space?.simpleName}/meegoPlg/${pluginConfig.pluginId}_${pluginConfig.boardKey}?uuid=${data.uuid}`
        );
      }
    });
  }
  const jumpToPay = async() => {
    try {
      const resInfo = await getDisplayLogic();
      if (resInfo?.result) {
        if ("standardProduct" in resInfo.data && !resInfo.data?.standardProduct) {
          handlePaymentRedirect()
        }else{
          window.JSSDK.navigation.open(`https://project.feishu.cn/openapp/plugin_share?appKey=${pluginConfig.pluginId}`)
        }
      }
    }catch (error) {
      window.JSSDK.navigation.open(`https://project.feishu.cn/openapp/plugin_share?appKey=${pluginConfig.pluginId}`)
    }
  }
  // 生成跳转支付页面的 URL
  const getJumpUrl = async () => {
    try {
      const hostname = await window.JSSDK.navigation.getHostname();
      const ctx = await window.JSSDK.Context.load();
      const mainSpace = ctx.mainSpace;
      const space = await window.JSSDK.Space.load(mainSpace?.id);
      const data = { uuid: generateUuid(), value: 1 };

      // 尝试调用 setJumpPayUuid，如果失败也继续跳转
      await setJumpPayUuid(data);

      return `https://${hostname}/${space?.simpleName}/meegoPlg/${pluginConfig.pluginId}_${pluginConfig.boardKey}?uuid=${data.uuid}`;
    } catch (error) {
      console.error("生成跳转链接失败:", error);
      // 失败时返回一个默认链接或空
      return "";
    }
  };

  // 根据 code 配置模态框内容
  const configModalByCode = () => {
    if (!code) return;

    switch (code) {
      case 10024: // 租户套餐已到期
        setModalConfig({
          title: "版本权限已过期",
          content: (
            <Badge
              color="#4247f6"
              text={
                <div style={{ display: "inline-block" }}>
                  你的
                  <span style={{ fontWeight: 600, color: "#4247f6" }}>
                    {responseData?.msg}
                  </span>
                  套餐已到期，请重新购买后使用
                </div>
              }
            />
          ),
          footer: (
            <Space
              style={{
                marginTop: "20px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Button onClick={() => window.JSSDK.navigation.open(chatUrl)}>
                咨询客服
              </Button>
              <Button
                type="primary"
                onClick={async () => {
                  //window.JSSDK.navigation.open(`https://project.feishu.cn/openapp/plugin_share?appKey=${pluginConfig.pluginId}`)
                  jumpToPay()
                }}
              >
                立即续费
              </Button>
            </Space>
          ),
        });
        break;

      case 10025: // 租户没有过套餐 (限时福利)
        setModalConfig({
          title: null, // 隐藏默认标题
          content: (
            <div className="modal-content-wrapper">
              <div className="modal-title">
                <span className="modal-title-icon"></span>限时福利：15天免费试用！
              </div>
              <div className="modal-content">
                <span className="modal-content-icon"></span>为感恩回馈，已为你准备好
                <span style={{ fontWeight: 600 }}>15天免费试用福利</span>
              </div>
              <div className="modal-content">
                <span className="modal-content-icon"></span>试用期间，你可以畅享所有功能，全面感受高效、透明的工时管理体验。
              </div>
              <div className="modal-content">
                <span className="modal-content-icon"></span>
                试用到期后，系统将自动进入“只读模式”，你仍可查看历史数据和页面，但无法进行新增或编辑操作。
              </div>
            </div>
          ),
          footer: (
            <div style={{ textAlign: "center", marginTop: "20px" }}>
              <div
                className="modal-btn"
                onClick={async () => {
                  //window.JSSDK.navigation.open(`https://project.feishu.cn/openapp/plugin_share?appKey=${pluginConfig.pluginId}`)
                  jumpToPay()
                }}
              >
                <span className="modal-btn-icon"></span>立即领取15天权益
              </div>
            </div>
          ),
        });
        break;

      case 10026: // 无席位权限
      default: {
        const isAdmin = sessionStorage.getItem("jwtMeegoTeamworkUserRole") === "Admin";
        let isInstalled = false;
        let isv_userRole = '';
        try {
          const raw = sessionStorage.getItem("tenantModeInfo");
          if (raw) {
            const tenantModeInfo = JSON.parse(raw);
            isInstalled = !!tenantModeInfo.install;
            isv_userRole = tenantModeInfo.userRole || '';
          }
        } catch (_) {}

        // 租户模式下 app_admin/space_admin 可配置席位
        const isTenantAdmin = isv_userRole === 'app_admin' || isv_userRole === 'space_admin';
        // 是否可以配置席位：未安装时用 isAdmin，已安装时用 isTenantAdmin
        const canConfigSeat = isInstalled ? isTenantAdmin : isAdmin;
        const showTenantAdminFeature = canShowTenantAdminFeature();
        let contentText;
        if (!isInstalled) {
          // 未安装：保持原有逻辑
          contentText = isAdmin
            ? "你的账号还未被配置可用席位。作为插件管理员，你可以点击下方按钮进行配置。"
            : "很抱歉，你的账号还未被企业配置可用席位。请联系你的企业【插件管理员】为你开通。";
        } else {
          // 已安装：根据 userRole 区分
          contentText = isTenantAdmin
            ? "您的账号还未被配置可用席位。作为应用管理员或插件管理员，您可以点击下方按钮进行配置。"
            : "很抱歉，您的账号还未被企业配置可用席位。请联系您企业的【应用管理员】或【插件管理员】为您开通。";
        }

        setModalConfig({
          title: "无席位权限",
          content: (
            <>
              <div>{contentText}</div>
              <div>若仍有问题，可随时联系我们的客服团队。</div>
            </>
          ),
          footer: (
            <Space
              style={{
                marginTop: "20px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Button onClick={() => window.JSSDK.navigation.open(chatUrl)}>
                联系客服
              </Button>
              {showTenantAdminFeature && (
                <Button
                  type="primary"
                  onClick={async () => {
                     const hostname = await window.JSSDK.navigation.getHostname();
                      window.JSSDK.Context.load().then(async (ctx) => {
                        const mainSpace = ctx.mainSpace;
                        const space = await window.JSSDK.Space.load(mainSpace?.id);
                        const data={
                          uuid:generateUuid(),
                          value:1
                        }
                        try {
                          const res = await setJumpPayUuid(data);
                          if (res?.result) {  // 确保API调用成功后再跳转
                            window.JSSDK.navigation.open(
                              `https://${hostname}/${space?.simpleName}/meegoPlg/${pluginConfig.pluginId}_${pluginConfig.boardKey}?uuid=${data.uuid}&isSeat=1`
                            );
                          }
                        } catch (error) {
                          window.JSSDK.navigation.open(
                            `https://${hostname}/${space?.simpleName}/meegoPlg/${pluginConfig.pluginId}_${pluginConfig.boardKey}?uuid=${data.uuid}&isSeat=1`
                          );
                        }
                      });
                  }}
                >
                  配置席位
                </Button>
              )}
            </Space>
          ),
        });
        break;
      }
    }
  };

  // 当 code 或 responseData 变化时，重新配置模态框
  useEffect(() => {
    configModalByCode();
  }, [code, responseData]);

  // 控制模态框显示/隐藏
  useEffect(() => {
    setCurrentOpen(open);
  }, [open]);

  // 关闭模态框
  const handleClose = () => {
    setCurrentOpen(false);
    onClose(); // 通知父组件关闭
  };

  return (
    <Modal
      title={modalConfig.title}
      open={currentOpen}
      onClose={handleClose}
      onCancel={handleClose}
      footer={modalConfig.footer}
      width={480} // 统一宽度
      className={code === 10025 ? "modal-wrap-receive" : ""} // 针对 10025 添加特殊样式
      closable={true}
      destroyOnClose={true} // 关闭时销毁组件，避免状态残留
    >
      {modalConfig.content}
    </Modal>
  );
};

export default SeatPermissionsModal;