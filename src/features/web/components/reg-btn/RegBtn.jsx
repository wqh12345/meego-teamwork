import { Dropdown, Button, Modal } from 'antd';
import { useState } from 'react';
import { SeatPermissionsModal } from '../seat-permissions-modal/SeatPermissionsModal';
import { querySeatUserPermission } from '../../../../api/api';
// 假设的检查席位权限的接口函数
const checkSeatPermission = async () => {
  try {
    // 这里应该是实际的API调用
    // 为了演示，返回一个模拟的Promise
    return Promise.resolve({ result: true });
  } catch (error) {
    console.error('检查席位权限失败:', error);
    return { result: false };
  }
};

const RegBtn = (props) => {
  const [showSeatModal, setShowSeatModal] = useState(false);
  const [chatUrl, setChatUrl] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCode, setModalCode] = useState();
  const [modalResponseData, setModalResponseData] = useState(undefined);
  return (
    <>
      <Dropdown
        menu={{
          items: [
            {
              key: '1',
              label: '批量登记',
            },
            {
              key: '2',
              label: '单项登记',
            },
          ],
          onClick: async (e) => {
            // 首先检查席位权限
            const res2 = await querySeatUserPermission();
            // 如果接口返回true，显示SeatPermissionsModal
            if (res2?.result && res2?.data?.msgCode) {
              setModalCode(res2?.data?.msgCode);
              setModalResponseData(res2?.data);
              setModalOpen(true); // 显示模态框
              setChatUrl(res2?.data?.chatUrl);
              return;
            }
            
            // 否则继续原来的工时登记流程
            if (e.key === '1') {
              const batchModalHeight = window.innerHeight < 719 ? '100vh' : 750;
              const modal = await window.JSSDK.modal.open({
                entry: 'RegModal',
                width: 1070,
                height: batchModalHeight,
                maskClosable: false,
                context: {
                  wHeight: batchModalHeight,
                  title: '批量登记',
                  loginUser: props?.loginUser,
                  registrationType: 'batch',
                },
                onSubmit: (confirm) => {
                  modal.close();
                  if (confirm.confirm) {
                    if (props?.getRegStatus) props?.getRegStatus(true);
                  }
                },
              });
            } else if (e.key === '2') {
              const modalHeight = window.innerHeight < 710 ? '100vh' : 710;
              const modal = await window.JSSDK.modal.open({
                entry: 'RegModal',
                width: 745,
                height: modalHeight,
                maskClosable: false,
                context: {
                  wHeight: modalHeight,
                  title: '登记工时',
                  loginUser: props?.loginUser,
                  registrationType: 'single',
                },
                onSubmit: (confirm) => {
                  modal.close();
                  if (confirm.confirm) {
                    if (props?.getRegStatus) props?.getRegStatus(true);
                  }
                },
              });
            }
          },
        }}
        placement="bottomRight"
      >
        <Button size="small" type="primary">
          工时登记
        </Button>
      </Dropdown>
      
      {/* 席位权限模态框 */}
        <SeatPermissionsModal
        open={modalOpen}
        code={modalCode}
        responseData={modalResponseData}
        chatUrl={chatUrl} // 可以从父组件传递，也可以在子组件固定
        onClose={() => {
          setModalOpen(false);
          // 重置状态，避免下次打开时显示旧内容
          setModalCode(undefined);
          setModalResponseData(undefined);
        }}
      />
    </>
  );
};
export default RegBtn;
