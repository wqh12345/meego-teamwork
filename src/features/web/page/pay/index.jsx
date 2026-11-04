import React, { useState, useEffect } from "react";
import { RightOutlined } from "@ant-design/icons";
import { Col, Row, Button, Table, Modal, Badge } from "antd";
import {
  getHasFree,
  getReceiveSevenDaysFree,
  getTenantPlan,
  getPurchaseRecord,
  getPlanBenefitList,
  getFsChatUrl,
  getUserRole,
  saveSeat,
  getDisplayLogic
} from "../../../../api/api";
import payIcon from "../../../../image/pay-icon.png";
import "./index.less";
import pluginConfig from '../../../../../plugin.config.json'
import SeatSettings from "../../components/seat-settings/seatSettings";
import { generateUuid, canShowTenantAdminFeature } from "../../../../util/util";
const Pay = () => {
  const [planList, setPlanList] = useState([]);
  const [isShowFreeBtn, setIsShowFreeBtn] = useState(false);
  const [tenantPlan, setTenantPlan] = useState({});
  const [payRecords, setPayRecords] = useState([]);
  const [payVisible, setPayVisible] = useState(false);
  const [isSelectedUserOpen, setIsSelectedUserOpen] = useState(false);
  const [selected, setSelected] = useState({
    selectedDeparts: [],
    selectedUsers: [],
    selectedDepartIds: [],
    selectedUserIds: [],
    checkedKeys: [],
  });
  const [newSelected, setNewSelected] = useState({
    selectedDeparts: [],
    selectedUsers: [],
    selectedDepartIds: [],
    selectedUserIds: [],
    checkedKeys: [],
  });
  const [isSynchronous, setIsSynchronous] = useState(Boolean);
  const [logList, setLogList] = useState({
    nodeWorkHours: [],
    total: 0,
    pageNo: 1,
    pageSize: 10,
    total: 0,
  });
  const [logPagination, setLogPagination] = useState({
    current: 1,
    pageSize: 10,
  });
  const [selectedSeatCount, setSelectedSeatCount] = useState({
    uniqueSelectedCount: 0,
    seatTotal: 0,
  });

  // 解析租户模式信息，判断是否可配置席位
  let _isvUserRole = '';
  try {
    const _raw = sessionStorage.getItem("tenantModeInfo");
    if (_raw) _isvUserRole = (JSON.parse(_raw))?.userRole || '';
  } catch (_) {}
  const canConfigSeat = canShowTenantAdminFeature();

  useEffect(() => {
    getIsShowFreeBtn();
    getTenantPlanInfo();
    getPayList();
    checkUserRole();
    const jumpPayUuid = sessionStorage.getItem("jumpPayUuid");
    if (jumpPayUuid) {
      showSeatConfig()
    }
  }, []);

  /** 获取当前用户角色 */
  const checkUserRole = async () => {
    const res = await getUserRole();
    if (res?.result) {
      sessionStorage.setItem("jwtMeegoTeamworkUserRole", res.data);
    }
  };

  /** 是否显示【领取 7 天免费权益】按钮 */
  const getIsShowFreeBtn = async () => {
    const res = await getHasFree();
    if (res?.result) {
      setIsShowFreeBtn(res.data);
    }
  };

  /** 领取 7 天免费权益 */
  const getReceiveFree = async () => {
    const res = await getReceiveSevenDaysFree();
    if (res?.result) {
      window.JSSDK.toast.success("15天免费权益领取成功");
      getIsShowFreeBtn();
      getTenantPlanInfo();
      getPayList();
    }
  };

  /** 获取当前租户启用的套餐 */
  const getTenantPlanInfo = async () => {
    const res = await getTenantPlan();
    if (res?.result) {
      setTenantPlan(res.data);
    }
  };

  /** 获取套餐权益列表 */
  const getPayList = async () => {
    const res = await getPlanBenefitList();
    if (res?.result) {
      setPlanList(res.data);
    }
  };

  /** 获取购买记录 */
  const getPayRecords = async () => {
    const res = await getPurchaseRecord();
    if (res?.result) {
      setPayRecords(res.data);
      setPayVisible(true);
    }
  };

  const getPlanEndDateTxt = (planEndDate,planId) => {
    if (planEndDate && planId != 6) {
      const planEndDateArr = planEndDate.split("-");
      const day = new Date(planEndDate).getTime() - new Date().getTime();
      const dayNum = Math.floor(day / (1000 * 60 * 60 * 24)) + 1;
      return `${planEndDateArr[0]}年${planEndDateArr[1]}月${planEndDateArr[2]}日到期(剩余${dayNum}天)`;
    }
    return "";
  };
  const getChatUrl = async() => {
    const res = await getFsChatUrl()
    if (res?.code === 200) {
      if(res?.data) {
        window.JSSDK.navigation.open(res.data)
      }
    }
  };
  const showSeatConfig = async() => {
    setIsSelectedUserOpen(true);
  }
    const handleSelectedUserCancel = () => {
    setIsSelectedUserOpen(false);
    setSelected({ ...newSelected });
  };

  const handleSelectedUserOk = async() => {
    //console.log('selected', selected);
    
    // 实现右侧已选团队的所有成员和独立选择成员的不去重计算
    const formatSelectedData = () => {
      const result = [];
      let sortIndex = 1;
      
      // 处理独立选择的成员（不属于任何团队）
      selected.selectedUsers.forEach(user => {
        // 检查用户是否属于任何已选团队
        const isInSelectedTeam = selected.selectedDepartIds.some(teamId => {
          // 这里需要根据实际数据结构判断用户是否属于该团队
          // 假设用户对象中有teamId字段表示所属团队
          return user.teamId === teamId;
        });
        
        // 如果用户不属于任何已选团队，则添加到结果中（不去重）
        if (!isInSelectedTeam) {
          result.push({
            userKey: user.staffId || user.userKey,
            teamId: null,
            teamName: null,
            sort: sortIndex++
          });
        }
      });
      
      // 处理已选团队的所有成员
      selected.selectedDepartIds.forEach(teamId => {
        // 查找团队信息
        const team = selected.selectedDeparts.find(depart => depart.teamId === teamId);
        
        if (team) {
          // 获取该团队的所有成员
          const teamMembers = team.teamMemberVoList || [];
          
          // 添加团队的所有成员到结果中（不去重）
          teamMembers.forEach(member => {
            result.push({
              isAll:1,
              userKey: member.userKey,
              teamId: teamId,
              teamName: team.username || team.teamName,
              sort: sortIndex++
            });
          });
        }
      });
      
      return result;
    };
    
    // 格式化数据
    const formattedData = formatSelectedData();
    //console.log('格式化后的数据:', formattedData);
    
    // // 提交给接口的数据
    // const submitData = {
    //   selectedUsers: formattedData,
    //   selectedUserIds: formattedData.map(item => item.userKey),
    //   selectedDepartIds: selected.selectedDepartIds,
    //   selectedDeparts: selected.selectedDeparts
    // };
    
    // 验证数据
    if (!formattedData.length) {
      window.JSSDK.toast.warning("团队成员不能为空");
      return;
    }
    //setNewSelected({ ...submitData });
    const res = await saveSeat(formattedData);
    if (res?.result) {
      window.JSSDK.toast.success("保存成功");
      setIsSelectedUserOpen(false);
      getTenantPlanInfo();
    }
  };
  const getSelectedUser = (e) => {
    setSelected({ ...e });
  };
  const onSelectedCountChange = (count) => {
    setSelectedSeatCount({...count});
  }
  // /** 打开人员选择器 */
  // const onSelectedUserOpen = () => {
  //   getHistoryState().then(() => {
  //     setIsSelectedUserOpen(true);
  //   });
  // };
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
  const jumpToPay = async(openUrl) => {
    try {
      const resInfo = await getDisplayLogic();
      if (resInfo?.result) {
        if ("standardProduct" in resInfo.data && !resInfo.data?.standardProduct) {
          window.JSSDK.navigation.open(openUrl)
        }else{
          window.JSSDK.navigation.open(`https://project.feishu.cn/openapp/plugin_share?appKey=${pluginConfig.pluginId}`)
        }
      }
    }catch (error) {
      window.JSSDK.navigation.open(`https://project.feishu.cn/openapp/plugin_share?appKey=${pluginConfig.pluginId}`)
    }
  }
  return (
    <div className="pay-warp">
      <div className="pay-contact" onClick={()=>getChatUrl()}>
        <span>联系客服</span>
      </div>
      <div className="pay-warp-header">
        <div className="header-title">工时管理</div>
        <div className="header-desc">
          一键统计，迅速提升人效和项目管理的有效性
        </div>
      </div>
      <div className="pay-warp-content">
        <div className="content-top">
          <div className="top-left">
            {/* <div className="left-title">购买时长</div>
            <div className="left-desc">1年</div> */}
          </div>
          {isShowFreeBtn ? (
            <div className="top-right" onClick={getReceiveFree}>
              领取15天免费权益
            </div>
          ) : sessionStorage.getItem("jwtMeegoTeamworkUserRole") === "Admin" ? (
            <Button
              color="primary"
              variant="link"
              icon={<RightOutlined />}
              iconPosition="end"
              onClick={getPayRecords}
            >
              购买记录
            </Button>
          ) : null}
        </div>
        <Row
          gutter={[24, { xs: 8, sm: 16, md: 24, lg: 32 }]}
          className="content-middle"
        >
          {planList?.map((item) => (
            <Col span={8}>
              <div span={8} className="middle-box">
                {item.id === tenantPlan?.actPlanId && tenantPlan?.currentPlanId != 0&&(
                  <div className="box-tag">当前版本</div>
                )}
                {item.id === tenantPlan?.actPlanId && tenantPlan?.currentPlanId == 0&&(
                  <div className="box-tag">限时体验</div>
                )}
                <div
                  className="box-title"
                  style={{
                    backgroundImage: `url(${item.iconUrl})`,
                  }}
                >
                  {item.planName}
                </div>
                {item?.price ? (
                  <div className="box-price">
                    ¥ <span style={{ fontSize: "28px" }}>{item.price}/年</span>
                  </div>
                ) : item?.price==0 ? (
                  <div className="box-price">
                    ¥ <span style={{ fontSize: "28px" }}>{item.price}</span>
                  </div>
                ):null}
                <div className="box-desc">
                  {item.id === tenantPlan?.actPlanId?(
                  <div className="act-plan-seat">
                    {tenantPlan?.actPlanId!==5 &&(<div>
                      <span>成员席位：</span>
                      {tenantPlan?.maxUser&&(tenantPlan?.maxUser >= 999999 ? 
                        <span style={{ color: tenantPlan?.numOfUsers > tenantPlan?.maxUser ? 'red' : 'inherit' }}>{tenantPlan?.numOfUsers}</span> :
                        <span style={{ color: tenantPlan?.numOfUsers > tenantPlan?.maxUser ? 'red' : 'inherit' }}>
                          <span>{tenantPlan?.numOfUsers}</span>/
                          <span>{tenantPlan?.maxUser}</span>
                        </span>
                      )}
                    </div>)}
                    {canConfigSeat && tenantPlan?.actPlanId!==5 &&(<div className="seat-btn" onClick={()=>showSeatConfig()}>
                      配置席位
                    </div>)}
                  </div>
                  ):
                  item?.description?.map((desc, index) => (
                    // <Badge color={} text={desc}></Badge>
                    <div key={index} className="desc-item">
                      {desc}
                    </div>
                  ))}
                  {item.id === tenantPlan?.actPlanId && tenantPlan?.planEndDate? (
                    <div className="desc-item">
                      {getPlanEndDateTxt(tenantPlan?.planEndDate,item.id)}
                    </div>
                  ) : null}
                </div>
                <div
                  className="box-btn"
                  onClick={() => {jumpToPay(item?.openUrl)}}
                >
                  {item.id === tenantPlan?.currentPlanId
                    ? "立即续费"
                    : item?.button}
                </div>
              </div>
            </Col>
          ))}
        </Row>
        <div className="content-bottom">
          <span className="bottom-title">使用场景</span>
          <span className="bottom-desc">项目排期规划</span>
          <span className="bottom-desc">项目进度监控</span>
          <span className="bottom-desc">人效复盘</span>
        </div>
      </div>
      <Modal
        title="购买记录"
        open={payVisible}
        onCancel={() => setPayVisible(false)}
        footer={null}
      >
        <div style={{ marginTop: "20px" }}>
          <PayRecordsTable data={payRecords} />
        </div>
      </Modal>
       <Modal
        destroyOnClose
        title={<div style={{ fontSize:'18px',color: 'color: #1F2329;' }}>配置席位<span style={{ fontSize: '14px',color: '#646A73',marginLeft:'10px'}}>仅选中的用户可使用插件</span></div>}
        open={isSelectedUserOpen}
        onCancel={handleSelectedUserCancel}
        width={"745px"}
        footer={[
          <Button className="cancel-btn" onClick={handleSelectedUserCancel}>
            取消
          </Button>,
          <Button
            disabled={!selected.selectedUserIds.length && !selected.selectedDepartIds.length || (selectedSeatCount.uniqueSelectedCount > selectedSeatCount.seatTotal)}
            type="primary"
            onClick={handleSelectedUserOk}
          >
            确定
          </Button>,
        ]}
      > 
        <SeatSettings
          type="all"
          getSelectedUser={getSelectedUser}
          onSelectedCountChange={onSelectedCountChange}
          projectId={2}
          selectedUser={selected}
        />
      </Modal>
    </div>
  );
};
export default Pay;

const PayRecordsTable = (props) => {
  const columns = [
    {
      title: "套餐名称",
      dataIndex: "planName",
      key: "planName",
      width: 80,
    },
    {
      title: "生效时间",
      dataIndex: "planStartDate",
      key: "planStartDate",
      width: 80,
    },
    {
      title: "到期时间",
      dataIndex: "planEndDate",
      key: "planEndDate",
      width: 80,
      render: (text) => {
        return text?text:'暂无期限'
      },
    },
  ];
  return (
    <Table
      size="small"
      columns={columns}
      dataSource={props.data}
      pagination={false}
      rowKey="id"
      scroll={{
        y: "400px",
      }}
    />
  );
};
