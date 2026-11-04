import React, { Component, useEffect, useState } from "react";
import { Alert, Table, Button, Avatar, Modal, message, Space } from "antd";
import { Stepper, Popup } from "antd-mobile";
import {
  UserOutlined,
  EditOutlined,
  CloseOutlined,
  ExclamationCircleFilled,
} from "@ant-design/icons";
import {
  getStandWorkHour,
  postUpdateStandWorkHour,
  getProjectAdminList,
  postSetProjectAdmin,
  postSetProjectMember,
} from "../../../../api/api";
import MbSelectedUser from "../../components/selected-user/SelectedUser";
import "./index.less";

class MbSetting extends Component {
  constructor(props) {
    super(props);
    this.state = {
      workHour: 8,
      standWorkHour: 8,
      isWorkHourOpen: false,
      authorityLoading: false,
      authorityColumns: [
        {
          title: "成员",
          dataIndex: "name",
          key: "name",
          width: 130,
          render: (_, record) => (
            <div className="table-columns-item">
              <Avatar
                src={record.staffAvatarUrl}
                size={18}
                icon={<UserOutlined />}
              />
              <div className="table-columns-item-right">
                <div className="right-name">
                  {record.staffName ? record.staffName : "--"}
                </div>
              </div>
            </div>
          ),
        },
        {
          title: "添加人",
          dataIndex: "operateUser",
          key: "operateUser",
          width: 130,
          render: (_, record) => (
            <div className="table-columns-item">
              {record.operatorAvatarUrl ? (
                <Avatar
                  src={record.operatorAvatarUrl}
                  size={18}
                  icon={<UserOutlined />}
                />
              ) : null}
              <div className="table-columns-item-right">
                <div className="right-name">
                  {record.operatorName ? record.operatorName : "--"}
                </div>
              </div>
            </div>
          ),
        },
        {
          title: "添加时间",
          dataIndex: "operationTime",
          key: "operationTime",
          width: 180,
        },
        {
          title: "操作",
          key: "operate",
          width: 120,
          fixed: "right",
          render: (_, record) => (
            <Space size="middle">
              {record.staffUserKey === props?.loginUser.id ? (
                "当前账号"
              ) : (
                <Button
                  className="opt-btn"
                  type="link"
                  onClick={() => this.onDelAuthorityClick(record)}
                >
                  删除
                </Button>
              )}
            </Space>
          ),
        },
      ],
      authorityList: {
        list: [],
      },
      authorityParams: {
        pagination: {
          current: 1,
          pageSize: 10,
        },
      },
      isSelectedUserOpen: false,
      selected: {
        selectedDeparts: [],
        selectedUsers: [],
        selectedDepartIds: [],
        selectedUserIds: [],
        checkedKeys: [],
      },
    };
  }
  componentDidMount() {
    this.getWorkHour();
    this.fetchData();
  }
  /** 查询组织标准工时 */
  getWorkHour = async () => {
    const res = await getStandWorkHour();
    if (res?.result) {
      this.setState({
        workHour: res.data.standWorkHour,
        standWorkHour: res.data.standWorkHour,
      });
    }
  };
  /** 设置组织标准工时 */
  postWorkHour = async () => {
    const data = {
      standWorkHour: this.state.workHour,
    };
    const res = await postUpdateStandWorkHour(data);
    if (res?.result) {
      this.getWorkHour();
      message.success("修改成功");
      this.setState({
        isWorkHourOpen: false,
      });
    }
  };

  /** 获取管理员列表 */
  fetchData = async () => {
    const { selected } = this.state;
    const res = await getProjectAdminList();
    if (res?.result) {
      const authorityList = this.state.authorityList;
      authorityList.list = res.data;
      for (const item of res.data) {
        selected.selectedUserIds.push(item.staffId);
      }
      this.setState({ authorityList, selected });
    }
  };

  /** 填写标准工时 */
  onWorkHourClick = () => {
    this.setState({
      workHour: this.state.standWorkHour,
      isWorkHourOpen: true,
    });
  };

  /** 关闭填写标准工时弹窗 */
  handleWorkHourCancel = () => {
    this.setState({
      isWorkHourOpen: false,
    });
  };

  /** 设置工作时长 */
  onWorkHourChange = (value) => {
    this.setState({ workHour: value });
  };

  /** 添加管理员 */
  onAddAuthorityClick = async () => {
    const data = {
      userId: this.state.selected.selectedUserIds,
    };
    const res = await postSetProjectAdmin(data);
    if (res?.result) {
      message.success("添加成功");
      this.fetchData();
    }
  };

  /** 删除管理员 */
  onDelAuthorityClick = (item) => {
    const _this = this;
    Modal.confirm({
      title: "确定删除？",
      icon: <ExclamationCircleFilled />,
      content: "您即将删除该成员的插件管理权限，此操作不可撤销。",
      closeIcon: <CloseOutlined />,
      okText: "确定",
      cancelText: "取消",
      async onOk() {
        const data = {
          userId: [item.staffId],
        };
        const res = await postSetProjectMember(data);
        if (res?.result) {
          _this.fetchData();
          message.success("删除成功");
        }
      },
      onCancel() {
        // message.success('操作成功');
      },
    });
  };

  /** 选择人员 */
  onSelectedUserOpen = () => {
    const { selected } = this.state;
    selected.selectedUsers = [];
    this.setState({
      selected,
      isSelectedUserOpen: true,
      newSelected: this.state.selected,
    });
  };

  handleSelectedUserCancel = () => {
    const { newSelected } = this.state;
    const person = newSelected.selectedUsers.concat(
      newSelected.selectedDeparts
    );
    this.setState({ isSelectedUserOpen: false, person, selected: newSelected });
  };

  handleSelectedUserOk = () => {
    const { selected } = this.state;
    this.setState({ isSelectedUserOpen: false, newSelected: selected }, () => {
      this.onAddAuthorityClick();
    });
  };

  getSelectedUser = (e) => {
    this.setState({ selected: e });
  };

  render() {
    return (
      <div className="mb-setting-warp">
        <div className="setting-box">
          <div className="setting-title">登记设置</div>
          <Alert
            className="setting-alert"
            message="提示：设置后，将按标准工作时长换算人天"
            type="info"
            showIcon
          />
          <div className="setting-content">
            <span>1人天标准工作时长：{this.state.standWorkHour}小时</span>
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={this.onWorkHourClick}
            />
          </div>
        </div>
        <div className="setting-box">
          <div className="setting-title between">
            <span>插件管理员</span>
            <Button
              size="small"
              type="primary"
              onClick={this.onSelectedUserOpen}
            >
              添加
            </Button>
          </div>
          <div className="setting-content">
            <div>
              管理员拥有在【工时管理】模块中对团队成员工时进行查看、管理、下载等高级权限
            </div>
          </div>
          <Table
            className="setting-table"
            size="small"
            loading={this.state.authorityLoading}
            columns={this.state.authorityColumns}
            dataSource={this.state.authorityList.list}
            pagination={false}
            scroll={{
              y: "calc(100vh - 200px)",
            }}
          />
        </div>
        <Popup
          destroyOnClose
          showCloseButton
          visible={this.state.isWorkHourOpen}
          onMaskClick={this.handleWorkHourCancel}
          onClose={this.handleWorkHourCancel}
          bodyStyle={{
            borderTopLeftRadius: "16px",
            borderTopRightRadius: "16px",
            minHeight: "60vh",
            padding: "20px",
            boxSizing: "border-box",
          }}
        >
          <div className="popup-header">
            <span className="popup-title">编辑时长</span>
          </div>
          <div className="popup-content">
            <div className="box">
              <div className="setting-modal-title">1人天标准工作时长</div>
              <div>
                <Stepper
                  value={this.state.workHour}
                  onChange={this.onWorkHourChange}
                  min={1}
                  max={24}
                />
              </div>
            </div>
          </div>
          <div className="popup-footer">
            <Button className="cancel-btn" onClick={this.handleWorkHourCancel}>
              取消
            </Button>
            <Button
              className="confirm-btn"
              type="primary"
              onClick={this.postWorkHour}
            >
              确定
            </Button>
          </div>
        </Popup>
        <Popup
          destroyOnClose
          showCloseButton
          visible={this.state.isSelectedUserOpen}
          onMaskClick={this.handleSelectedUserCancel}
          onClose={this.handleSelectedUserCancel}
          bodyStyle={{
            borderTopLeftRadius: "16px",
            borderTopRightRadius: "16px",
            minHeight: "60vh",
            padding: "20px",
            boxSizing: "border-box",
          }}
        >
          <div className="popup-header">
            <span className="popup-title">选择成员</span>
          </div>
          <div className="popup-content">
            <MbSelectedUser
              type="authority"
              getSelectedUser={this.getSelectedUser}
              selectedUser={this.state.selected}
            />
          </div>
          <div className="popup-footer">
            <Button
              className="cancel-btn"
              onClick={this.handleSelectedUserCancel}
            >
              取消
            </Button>
            <Button
              className="confirm-btn"
              disabled={!this.state.selected.selectedUserIds.length}
              type="primary"
              onClick={this.handleSelectedUserOk}
            >
              确定
            </Button>
          </div>
        </Popup>
      </div>
    );
  }
}
export default MbSetting;
