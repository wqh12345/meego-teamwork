import React, { useEffect, useState } from "react";
import { Alert } from "antd";
import { NotificationFilled } from "@ant-design/icons";
import Marquee from "react-fast-marquee";
import {
  getRollingAnnouncement,
  getCloseRollingAnnouncement,
  getTenantModeInfo,
  saveBannerDisplayed,
} from "../../../../api/api";
import { openExternalUrl } from "../../../../util/util";
import "./TopAlert.less";

const INSTALL_MANUAL_URL = 'https://ldkj.feishu.cn/wiki/TJmMwxorTigjqxkVh8XcmOOqngc'

const TopAlert = ({ onInstallISV }) => {
  const [isShow, setIsShow] = useState(false);
  const [topAlertInfo, setTopAlertInfo] = useState({});
  const [isvBannerShow, setIsvBannerShow] = useState(false);

  useEffect(() => {
    getTopAlert();
    getIsvBannerStatus();
  }, []);

  const getTopAlert = async () => {
    const res = await getRollingAnnouncement();
    if (res?.result && res?.data) {
      setTopAlertInfo(res.data);
      setIsShow(true);
    }
  };

  const getIsvBannerStatus = async () => {
    try {
      const res = await getTenantModeInfo();
      if (res?.result && res?.data) {
        const { install, workHourPluginInstalled, bannerDisplayed } = res.data;
        if (install === false && workHourPluginInstalled === true && bannerDisplayed === false) {
          setIsvBannerShow(true);
        }
      }
    } catch (e) {
      console.error('获取租户模式信息失败:', e);
    }
  };

  const onClose = async () => {
    await getCloseRollingAnnouncement(topAlertInfo?.id);
  };

  const onIsvBannerClose = async () => {
    try {
      await saveBannerDisplayed('isv_install');
    } catch (e) {
      console.error('保存黄条状态失败:', e);
    }
    setIsvBannerShow(false);
  };

  const openInstallManual = () => {
    try {
      window.JSSDK.navigation.open(INSTALL_MANUAL_URL);
    } catch (e) {
      window.open(INSTALL_MANUAL_URL, '_blank');
    }
  };

  const openContactUs = async () => {
    try {
      const { getFsChatUrl } = await import('../../../../api/api');
      const res = await getFsChatUrl();
      if (res?.code === 200 && res?.data) {
        window.JSSDK.navigation.open(res.data);
      }
    } catch (e) {
      console.error('获取联系客服地址失败:', e);
    }
  };

  return (
    <>
      {isShow ? (
        <Alert
          className="top-alert-warp"
          banner
          icon={<NotificationFilled />}
          closable={topAlertInfo?.canClosed}
          onClose={onClose}
          message={
            <div className="top-alert-content-wrapper">
              <div
                className="top-alert-content"
                dangerouslySetInnerHTML={{
                  __html: topAlertInfo?.content,
                }}
              />
            </div>
          }
        />
      ) : null}
      {/* {isvBannerShow ? (
        <Alert
          className="isv-install-banner"
          banner
          type="warning"
          closable
          showIcon={false}
          onClose={onIsvBannerClose}
          message={
            <div className="isv-banner-content">
              <span className="isv-banner-text">
                安装ISV，解锁跨空间登记、全局数据查看更多能力
              </span>
              <div className="isv-banner-actions">
                <a onClick={openInstallManual}>安装手册</a>
                <span className="isv-banner-divider">|</span>
                <a onClick={openContactUs}>联系我们</a>
                <span className="isv-banner-divider">|</span>
                <a onClick={() => openExternalUrl()} style={{ marginRight: '10px'}}>前往安装ISV</a>
              </div>
            </div>
          }
        />
      ) : null} */}
    </>
  );
};
export default TopAlert;
