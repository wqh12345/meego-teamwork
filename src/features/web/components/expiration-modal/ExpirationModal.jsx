import { useEffect, useState } from "react";
import { Modal, Badge, Button, Space } from "antd";
import { getPlanMessage, setJumpPayUuid,getDisplayLogic} from "../../../../api/api";
import { generateUuid} from "../../../../util/util";
import pluginConfig from "../../../../../plugin.config.json";

export const ExpirationModal = ({ open: controlledOpen, onClose, onNeedShow }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [planInfo, setPlanInfo] = useState({});

  // 支持受控和非受控两种模式
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (val) => {
    if (controlledOpen === undefined) {
      setInternalOpen(val);
    }
    if (val && onNeedShow) onNeedShow(true);
  };
  const handleClose = () => {
    setInternalOpen(false);
    onNeedShow?.(false);
    onClose?.();
  };

  const getMessage = async () => {
    const res = await getPlanMessage();
    if (res?.data) {
      setPlanInfo(res.data);
      res?.result && setOpen(true);
    }
//     const plan={
//         "messageContent": "当前仅前10个席位用户可用，请续费升级或重新分配席位",
//         "planName": "基础版",
//         "remainingTime": null,
//         "chatUrl": "https://applink.larksuite.com/client/chat/chatter/add_by_link?link_token=a8er9221-1ddf-47f3-a29b-654478rkgebi",
//         "planStartTime": "2025-11-18",
//         "planEndTime": "2025-12-07",
//         "msgType": 2
//     }
// setPlanInfo(plan);
// setOpen(true)
  };
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
            `https://${hostname}/${space?.simpleName}/meegoPlg/${pluginConfig.pluginId}_${pluginConfig.boardKey}?uuid=${data.uuid}&isSeat=1`
          );
        }
      } catch (error) {
        window.JSSDK.navigation.open(
          `https://${hostname}/${space?.simpleName}/meegoPlg/${pluginConfig.pluginId}_${pluginConfig.boardKey}?uuid=${data.uuid}&isSeat=1`
        );
      }
    });
  }
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
  useEffect(() => {
    getMessage();
  }, []);

  return (
    <Modal
      title={planInfo?.msgType === 2 ? "席位超额" : "权限即将过期"}
      open={open}
      onCancel={handleClose}
      footer={
        <Space
          style={{
            marginTop: "20px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {/* msgType=1: 显示原来的按钮 */}
          {planInfo?.msgType === 1 && (
            <>
              <Button
                onClick={() => {
                  window.JSSDK.navigation.open(planInfo?.chatUrl);
                  handleClose();
                }}
              >
                咨询客服
              </Button>
              <Button
                type="primary"
                onClick={async () => {
                  await jumpToPay();
                  handleClose();
                }}
              >
                立即续费
              </Button>
            </>
          )}
          
          {/* msgType=2: 显示重新分配和续费升级按钮 */}
          {planInfo?.msgType === 2 && (
            <>
              <Button
                onClick={async () => {
                  await jumpPayPage();
                  handleClose();
                }}
              >
                重新分配
              </Button>
              <Button
                type="primary"
                onClick={async () => {
                  await jumpToPay();
                  handleClose();
                }}
              >
                续费升级
              </Button>
            </>
          )}
        </Space>
      }
    >
      {planInfo?.msgType === 1 && (planInfo?.remainingTime === 0 ? (
        <Badge
          color="#4247f6"
          text={
            <div style={{ display: "inline-block" }}>
              您的
              <span style={{ fontWeight: 600, color: "#4247f6" }}>
                {planInfo?.planName}
              </span>
              套餐将在今天到期，为避免影响正常使用，请及时续费
            </div>
          }
        />
      ) : (
        <Badge
          color="#4247f6"
          text={
            <div style={{ display: "inline-block" }}>
              您的
              <span style={{ fontWeight: 600, color: "#4247f6" }}>
                {planInfo?.planName}
              </span>
              套餐将在{planInfo?.remainingTime}
              天后到期，为避免影响正常使用，请及时续费
            </div>
          }
        />
      ))}
      {planInfo?.msgType === 2 && (
        <div>{planInfo?.messageContent}</div>
      )}
    </Modal>
  );
};
export default ExpirationModal;
