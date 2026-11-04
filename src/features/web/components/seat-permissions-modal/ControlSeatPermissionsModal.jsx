import { useEffect, useState } from "react";
import { Modal, Badge, Button, Space } from "antd";
import { getPlanMessage, setJumpPayUuid} from "../../../../api/api";
import { generateUuid,canShowTenantAdminFeature} from "../../../../util/util";
import pluginConfig from "../../../../../plugin.config.json";

export const SeatPermissionsModal = (props) => {
  const [open, setOpen] = useState();
  const [planInfo, setPlanInfo] = useState({});
  const jumpPayPage = async () => {
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
  useEffect(() => {
    setOpen(props.open);
  }, [props.open]);

  // 添加防抖处理，防止频繁点击导致的异常
  const handleClose = () => {
    setOpen(false);
    // 通知父组件模态框已关闭，允许再次显示
    if (props.onClose) {
      props.onClose();
    }
  };
  const showTenantAdminFeature = canShowTenantAdminFeature();

  // 获取租户模式信息
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
  const isTenantAdmin = isv_userRole === 'app_admin' || isv_userRole === 'space_admin';

  // 根据安装状态和角色计算提示文本
  let contentText;
  if (!isInstalled) {
    contentText = isAdmin
      ? "你的账号还未被配置可用席位。作为插件管理员，你可以点击下方按钮进行配置。"
      : "很抱歉，你的账号还未被企业配置可用席位。请联系你的企业【插件管理员】为你开通。";
  } else {
    contentText = isTenantAdmin
      ? "您的账号还未被配置可用席位。作为应用管理员或插件管理员，您可以点击下方按钮进行配置。"
      : "很抱歉，您的账号还未被企业配置可用席位。请联系您企业的【应用管理员】或【插件管理员】为您开通。";
  }

    return (
    <div>
      <div>
        <div>
        {contentText}
      </div>
      <div>若仍有问题，可随时联系我们的客服团队。</div>
      </div>
      <div>
        {
        showTenantAdminFeature ? (
          <Space
            style={{
              marginTop: "20px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Button
              onClick={() => window.JSSDK.navigation.open(props.chatUrl)}
            >
              联系客服
            </Button>
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
                        `https://${hostname}/${space?.simpleName}/meegoPlg/${pluginConfig.pluginId}_${pluginConfig.boardKey}?uuid=${data.uuid}&&isSeat=1`
                      );
                    }
                  } catch (error) {
                    window.JSSDK.navigation.open(
                      `https://${hostname}/${space?.simpleName}/meegoPlg/${pluginConfig.pluginId}_${pluginConfig.boardKey}?uuid=${data.uuid}&&isSeat=1`
                    );
                  }
                });
              }}
            >
              配置席位
            </Button>
          </Space>
        ) : (
          <Space
            style={{
              marginTop: "20px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Button
              type="primary"
              onClick={() => window.JSSDK.navigation.open(props.chatUrl)}
            >
              联系客服
            </Button>
          </Space>
        )
      }
      </div>
    </div>
  );
};
export default SeatPermissionsModal;

