import React, { useEffect, useState } from "react";
import { Button, Modal } from "antd";
import { NotificationFilled } from "@ant-design/icons";
import Marquee from "react-fast-marquee";
import {
  getFullScreenAnnouncement,
  getConfirmFullScreenAnnouncement,
} from "../../../../api/api";
import "./PublicModal.less";

const PublicModal = () => {
  const [isShow, setIsShow] = useState(false);
  const [publicModalInfo, setPublicModalInfo] = useState({});

  useEffect(() => {
    getPublicModal();
  }, []);

  const getPublicModal = async () => {
    const res = await getFullScreenAnnouncement();
    if (res?.result && res?.data) {
      setPublicModalInfo(res.data);
      setIsShow(true);
    }
  };
  const onCancel = async () => {
    setIsShow(false);
  };
  const onOk = async () => {
    await getConfirmFullScreenAnnouncement(publicModalInfo?.id);
    setIsShow(false);
    if (publicModalInfo?.buttonUrl) {
      window.JSSDK.navigation.open(publicModalInfo?.buttonUrl);
    }
  };
  return (
    <Modal
      className="public-modal-warp"
      title={
        <img
          src={publicModalInfo?.backgroundUrl}
          className="public-modal-header"
        />
      }
      open={isShow}
      width={648}
      closable={publicModalInfo?.canClosed}
      keyboard={publicModalInfo?.canClosed}
      maskClosable={publicModalInfo?.canClosed}
      footer={
        <Button type="primary" onClick={onOk}>
          {publicModalInfo?.buttonText}
        </Button>
      }
      onCancel={onCancel}
    >
      <div dangerouslySetInnerHTML={{ __html: publicModalInfo?.content }} />
    </Modal>
  );
};
export default PublicModal;
