import React from 'react'
import { Modal, Button } from 'antd'
import {
  FileTextOutlined,
  UserOutlined,
  BarChartOutlined,
  TeamOutlined,
  CloseOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import './index.less'
import cardEditImg from '../../../../image/cardEditImg.png'
import profileTickImg from '../../../../image/profileTickImg.png'
import teamImg from '../../../../image/teamImg.png'
import mbmanagementImg from '../../../../image/mbmanagementImg.png'
import image from '../../../../image/image.png' 
import acIcon from '../../../../image/az-icon.png'
import linIcon from '../../../../image/link-icon.png'
import {getFsChatUrl,saveGuideDisplayed} from '../../../../api/api'
import yindaoImg from '../../../../image/yindao.png'
import { openExternalUrl } from '../../../../util/util'
// -------------------------- 图标组件 --------------------------
const SparkleIcon = () => (
  <img src={image} width="36" height="36" alt="升级" /> 
)

// 功能图标
const RegisterIcon = () => (
  <img src={cardEditImg} width="36" height="36" alt="登记" />
)

const ApproveIcon = () => (
  <img src={profileTickImg} width="36" height="36" alt="审批" />
)

const DataViewIcon = () => (
  <img src={mbmanagementImg} width="36" height="36" alt="数据查看" />
)

const TenantModeIcon = () => (
  <img src={teamImg} width="36" height="36" alt="租户管理" />
)

// -------------------------- 数据配置 --------------------------
const FEATURES = [
  {
    key: 'register',
    title: '跨空间工时登记',
    desc: '在一个页面登记多个空间的工时，无需切换空间',
    icon: <RegisterIcon />,
  },
  {
    key: 'approve',
    title: '跨空间工时审批',
    desc: '所有空间的工时审批统一管理，无需切换空间',
    icon: <ApproveIcon />,
  },
  {
    key: 'data',
    title: '跨空间数据查看',
    desc: '所有空间的工时数据统一查看，全局数据一目了然',
    icon: <DataViewIcon />,
  },
  {
    key: 'tenant',
    title: '租户管理模式',
    desc: '基于租户维度管理成员，多空间场景下更严谨的工时管理',
    icon: <TenantModeIcon />,
  },
]

const INSTALL_MANUAL_URL = 'https://ldkj.feishu.cn/wiki/TJmMwxorTigjqxkVh8XcmOOqngc'

export default function CrossSpaceUpgradeModal({
  visible,
  onClose,
  onStart,
  role = 'admin',
}) {
  const openInstallManual = () => {
    try {
      window.JSSDK.navigation.open(INSTALL_MANUAL_URL)
    } catch (e) {
      window.open(INSTALL_MANUAL_URL, '_blank')
    }
  }

  const openContactUs = async () => {
    try {
      const res = await getFsChatUrl()
      if (res?.code === 200 && res?.data) {
        window.JSSDK.navigation.open(res.data)
      }
    } catch (e) {
      console.error('获取联系客服地址失败:', e)
    }
  }

  const handleGoInstall = async () => {
    try {
      await saveGuideDisplayed()
      openExternalUrl()
    } catch (e) {
      console.error('保存引导页状态失败:', e)
    }
    // 先关闭弹窗
    onClose?.()
    // 延迟跳转，确保弹窗关闭动画完成
    setTimeout(() => {
      onStart?.()
    }, 300)
  }

  const handleKnown = async () => {
    try {
      await saveGuideDisplayed()
    } catch (e) {
      console.error('保存引导页状态失败:', e)
    }
    onClose?.()
  }

  return (
    <Modal
      open={visible}
      footer={null}
      onCancel={handleKnown}
      width={640}
      closable={false}
      maskClosable={false}
      className="cross-space-upgrade-modal"
      centered
    >
      {/* 顶部横幅图片 */}
      <img src={yindaoImg} alt="" className="modal-banner-img" />
      <div className="modal-body" style={{ position: 'relative',
    zIndex: 2 }}>
        {/* 头部 */}
        <div className="modal-header">
          <div className="header-title">
            <span className="header-icon"><SparkleIcon /></span>
            <h2>安装工时资源管理ISV，开启跨空间管理能力</h2>
          </div>
          <button className="header-close" onClick={handleKnown}>
            <CloseOutlined />
          </button>
        </div>

        {/* 副标题 */}
        <div className="section-subtitle">安装后可获得：</div>

        {/* 特性卡片网格 */}
        <div className="features-grid">
          {FEATURES.map((feature) => (
            <div key={feature.key} className="feature-card">
              <div className="feature-icon">{feature.icon}</div>
              <div className="feature-info">
                <div className="feature-title">{feature.title}</div>
                <div className="feature-desc">{feature.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 安装说明 */}
        <div className="install-notice">
          <div className="notice-title">
             <img src={acIcon} width="16" height="16"/> 安装说明
          </div>
          <div className="notice-content">
            <p>安装需要飞书租户管理员、应用管理员或具备对应权限的用户</p>
            <p>如果您具备相关权限，请 <a onClick={() => openExternalUrl()}><img src={linIcon} width="16" height="16" /> 点击此处前往安装ISV</a></p>
            <p>如果您没有对应权限，可以让管理员查阅 <a onClick={openInstallManual}><img src={linIcon} width="16" height="16" /> 工时资源管理安装手册</a>，快速完成工时配置</p>
            <p>如需帮助，请 <a onClick={openContactUs}>联系我们</a></p>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="modal-footer">
          <Button onClick={handleKnown}>我已知晓</Button>
          <Button type="primary" onClick={handleGoInstall}>前往安装ISV</Button>
        </div>
      </div>
    </Modal>
  )
}
