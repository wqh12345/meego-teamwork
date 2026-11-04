import React, { Component } from "react";
import { Popup, Button } from "antd-mobile";
import { Avatar, Checkbox, Tooltip, Input } from "antd";
import { filterDuplicates } from "../../../../util/util";
import { SearchOutlined, CloseOutlined, UserOutlined } from "@ant-design/icons";
import { getProjectMemberList, getProjectAllStaff, postSearchMember } from "../../../../api/api";
import searchIcon from "../../../../image/search.png";
import rightOutlineIcon from "../../../../image/RightOutline.png";
import leftOutlineIcon from "../../../../image/LeftOutline.png";
import mbCloseIcon from "../../../../image/mb-close.png";
import "./SelectedUser.less";

class MbSelectedUser extends Component {
  constructor(props) {
    super(props);
    this.state = {
      type: "",
      isLockSearch: false,
      searchKey: "",
      deptId: "0",
      fieldNames: {
        title: "name",
        key: "id",
      },
      tenantUserNumber: 0,
      allTree: [
        {
          name: "全部员工",
          id: "0",
          isLeaf: true,
          parentId: "0",
        },
      ],
      checkboxOptions: {
        label: "name",
        value: "id",
        disabled: "disabled",
      },
      projectMemberList: [],
      treeData: [],
      initTreeData: [],
      selectedUsers: [],
      selectedUserIds: [],
      selectedDeparts: [],
      selectedDepartIds: [],
      checkedKeys: [],
      selectedDepartsCopy: [],
      selectedUsersCopy: [],
      selectedDepartIdsCopy: [],
      selectedUserIdsCopy: [],
      checkedKeysCopy: [],
      defaultSelectedKeys: [],
      departNum: 0,
      userList: [],
      isDisabledTreeData: false,
      isSelectedOpen: false,
    };
  }
  // 创建阶段
  componentDidMount() {
    const {
      selectedDeparts,
      selectedUsers,
      selectedDepartIds,
      selectedUserIds,
    } = this.props.selectedUser;
    this.setState({
      selectedDeparts,
      selectedUsers,
      selectedDepartIds,
      selectedUserIds,
      defaultSelectedKeys: selectedDepartIds.concat(selectedUserIds),
    });
    this.getProjectMember();
  }
  componentWillReceiveProps(nextProps) {
    const {
      selectedDeparts,
      selectedUsers,
      selectedDepartIds,
      selectedUserIds,
    } = nextProps.selectedUser;
    if (!selectedDepartIds.length) {
      const isDisabledTreeData = false;
      this.setState({ isDisabledTreeData, departNum: 0 });
    }
    this.setState({
      selectedDeparts,
      selectedUsers,
      selectedDepartIds,
      selectedUserIds,
      defaultSelectedKeys: selectedDepartIds.concat(selectedUserIds),
    });
  }
  /** 获取所有人员 */
  getProjectMember = async () => {
    const { selectedUserIds } = this.props.selectedUser;
    if (this.props.type === "all") {
      const res = await getProjectAllStaff();
      if (res?.result && res.data.length) {
        const userInfoVos = res.data;
        const selectedUsers = [];
        for (const item of userInfoVos) {
          item.isUser = true;
          item.isLeaf = true;
          item.icon = (
            <Avatar
              size={20}
              src={item.staffAvatarUrl}
              icon={<img alt="" src={UserOutlined} />}
            />
          );
          if (selectedUserIds.indexOf(item.staffId) !== -1) {
            selectedUsers.push(item);
          }
        }
        const treeData = userInfoVos;
        this.setState({
          treeData: userInfoVos,
          projectMemberList: userInfoVos,
          selectedUsers,
        });
      }
    } else {
      const res = await getProjectMemberList();
      if (res?.result && res.data.length) {
        const userInfoVos = res.data;
        for (const item of userInfoVos) {
          item.isUser = true;
          item.isLeaf = true;
          item.icon = (
            <Avatar
              size={20}
              src={item.staffAvatarUrl}
              icon={<img alt="" src={UserOutlined} />}
            />
          );
        }
        const treeData = userInfoVos;
        this.setState({
          treeData: userInfoVos,
          projectMemberList: userInfoVos,
        });
      }
    }
  };

  /** 根据姓名模糊搜索 */
  getSearchUserList = async () => {
    const { searchKey, projectMemberList } = this.state;
    if (!searchKey) {
      this.getProjectMember();
      return;
    }
    const data = {
      query: searchKey.replace(/\s+/g, ""),
    };
    // const treeData = [];
    // projectMemberList.filter((item) => {
    //   if (item.staffName.includes(data.name)) {
    //     treeData.push(item);
    //   }
    // });
    // this.setState({ treeData });
    const res = await postSearchMember(data);
    if (res && res.code === 200) {
      for (const item of res.data) {
        item.isLeaf = true;
        item.isUser = true;
        item.icon = (
          <Avatar
            size={20}
            src={item.staffAvatarUrl}
            icon={<img alt="" src={UserOutlined} />}
          />
        );
      }
    this.setState({ treeData: res.data });
    }
  };

  /** 输入姓名关键字 */
  onSearchKeyChange = (e) => {
    this.setState({ searchKey: e.target.value }, () => {
      this.getSearchUserList();
    });
  };
  /** 为IOS锁定输入 */
  onLockSearchStatus = (e) => {
    switch (e.type) {
      case "compositionstart":
        this.setState({ isLockSearch: true });
        break;
      case "compositionend":
        this.setState({ isLockSearch: false });
        this.getSearchUserList();
        break;
      default:
        break;
    }
  };
  /** 选中的全部人员 */
  onAllCheck = (checkedKeys, info) => {
    let {
      selectedDeparts,
      selectedUsers,
      selectedDepartIds,
      selectedUserIds,
      departNum,
      isDisabledTreeData,
    } = this.state;
    const keys = [];
    if (info.checked) {
      selectedDepartIds = [info.node.staffId];
      selectedDeparts = [info.node];
      selectedUserIds = [];
      selectedUsers = [];
      departNum = info.node.userNumber;
      keys.push({
        deptId: "0",
        checked: [info.node],
      });
      isDisabledTreeData = true;
    } else {
      selectedDepartIds = [];
      selectedDeparts = [];
      departNum = 0;
      isDisabledTreeData = false;
    }
    this.setState({
      selectedDeparts,
      selectedUsers,
      selectedDepartIds,
      selectedUserIds,
      isDisabledTreeData,
      departNum,
      checkedKeys: keys,
    });
    this.props.getSelectedUser({
      selectedDeparts,
      selectedUsers,
      selectedDepartIds,
      selectedUserIds,
      checkedKeys: keys,
      departNum,
    });
  };
  /** 选中的人或者部门 */
  onCheck = (e) => {
    // console.log(e);
    if (e.indexOf("0") !== -1) {
      let {
        selectedDeparts,
        selectedUsers,
        selectedDepartIds,
        selectedUserIds,
        departNum,
        isDisabledTreeData,
        allTree,
        defaultSelectedKeys,
      } = this.state;
      const keys = [];
      selectedDepartIds = ["0"];
      defaultSelectedKeys = ["0"];
      selectedDeparts = [allTree[0]];
      selectedUserIds = [];
      selectedUsers = [];
      departNum = allTree[0].userNumber;
      keys.push({
        deptId: "0",
        checked: [allTree[0]],
      });
      isDisabledTreeData = true;
      this.setState({
        selectedDeparts,
        selectedUsers,
        selectedDepartIds,
        selectedUserIds,
        isDisabledTreeData,
        departNum,
        checkedKeys: keys,
        defaultSelectedKeys,
      });
      this.props.getSelectedUser({
        selectedDeparts,
        selectedUsers,
        selectedDepartIds,
        selectedUserIds,
        checkedKeys: keys,
      });
      return;
    }

    const { deptId, checkedKeys, treeData } = this.state;
    const CheckboxValueType = [];
    const delCheckedIds = [];
    for (const i of treeData) {
      if (e.length) {
        if (e.indexOf(i.staffId) !== -1) {
          CheckboxValueType.push(i);
        } else {
          delCheckedIds.push(i.staffId);
        }
      } else {
        delCheckedIds.push(i.staffId);
      }
    }
    const selectedUserIds = [];
    const selectedUsers = [];
    const selectedDepartIds = [];
    const selectedDeparts = [];
    if (!checkedKeys.length) {
      checkedKeys.push({
        deptId: deptId,
        checked: CheckboxValueType,
      });
      for (const item of CheckboxValueType) {
        if (item.isUser) {
          if (selectedUserIds.indexOf(item.staffId) === -1) {
            selectedUserIds.push(item.staffId);
            selectedUsers.push(item);
          }
        } else {
          if (selectedDepartIds.indexOf(item.staffId) === -1) {
            selectedDepartIds.push(item.staffId);
            selectedDeparts.push(item);
          }
        }
      }
    } else {
      let isAdd = true;
      for (const item of checkedKeys) {
        if (item.deptId === "-LDKJ6666" && item.deptId === deptId) {
          isAdd = false;
          item.checked = item.checked.concat(CheckboxValueType);
          for (const index in item.checked) {
            if (delCheckedIds.indexOf(item.checked[index].staffId) !== -1) {
              item.checked.splice(index, 1);
            } else {
              if (selectedUserIds.indexOf(item.checked[index].staffId) === -1) {
                selectedUserIds.push(item.checked[index].staffId);
                selectedUsers.push(item.checked[index]);
              }
            }
          }
          item.checked = filterDuplicates(item.checked);
          continue;
        }
        if (item.deptId === deptId) {
          isAdd = false;
          item.checked = CheckboxValueType;
          for (const i of item.checked) {
            if (i.isUser) {
              if (selectedUserIds.indexOf(i.staffId) === -1) {
                selectedUserIds.push(i.staffId);
                selectedUsers.push(i);
              }
            } else {
              if (selectedDepartIds.indexOf(i.staffId) === -1) {
                selectedDepartIds.push(i.staffId);
                selectedDeparts.push(i);
              }
            }
          }
        } else {
          for (const i in item.checked) {
            if (delCheckedIds.indexOf(item.checked[i].staffId) !== -1) {
              item.checked.splice(i, 1);
              continue;
            }
            if (item.checked[i].isUser) {
              if (selectedUserIds.indexOf(item.checked[i].staffId) === -1) {
                selectedUserIds.push(item.checked[i].staffId);
                selectedUsers.push(item.checked[i]);
              }
            } else {
              if (selectedDepartIds.indexOf(item.checked[i].staffId) === -1) {
                selectedDepartIds.push(item.checked[i].staffId);
                selectedDeparts.push(item.checked[i]);
              }
            }
          }
        }
      }
      if (isAdd) {
        checkedKeys.push({
          deptId: deptId,
          checked: CheckboxValueType,
        });
        for (const item of CheckboxValueType) {
          if (item.isUser) {
            if (selectedUserIds.indexOf(item.staffId) === -1) {
              selectedUserIds.push(item.staffId);
              selectedUsers.push(item);
            }
          } else {
            if (selectedDepartIds.indexOf(item.staffId) === -1) {
              selectedDepartIds.push(item.staffId);
              selectedDeparts.push(item);
            }
          }
        }
      }
    }
    let departNum = 0;
    for (let item of selectedDeparts) {
      departNum += item.userNumber;
    }
    const defaultSelectedKeys = selectedDepartIds.concat(selectedUserIds);
    this.setState({
      selectedDeparts,
      selectedUsers,
      selectedDepartIds,
      selectedUserIds,
      departNum,
      defaultSelectedKeys,
      checkedKeys,
    });
    this.props.getSelectedUser({
      selectedDeparts,
      selectedUsers,
      selectedDepartIds,
      selectedUserIds,
      checkedKeys,
      departNum,
    });
  };
  /** 清空选择的人或者部门 */
  onClearSelectedClick = () => {
    const { selectedDepartIds } = this.state;
    if (selectedDepartIds[0] === "0") {
      this.setState({ isDisabledTreeData: false });
    }
    this.setState({
      selectedDeparts: [],
      selectedUsers: [],
      selectedDepartIds: [],
      selectedUserIds: [],
      checkedKeys: [],
    });
  };
  /** 一个一个删除选择的人或者部门 */
  onDelSelectedClick = (item, index, type) => {
    const {
      selectedDeparts,
      selectedUsers,
      selectedDepartIds,
      selectedUserIds,
      checkedKeys,
    } = this.state;
    if (selectedDepartIds[0] === "0") {
      this.setState({ isDisabledTreeData: false });
    }
    if (type === "user") {
      selectedUserIds.splice(index, 1);
      selectedUsers.splice(index, 1);
    } else {
      selectedDepartIds.splice(index, 1);
      selectedDeparts.splice(index, 1);
    }
    for (const key of checkedKeys) {
      let isBreak = false;
      if (key.deptId === item.parentId) {
        const checked = [];
        for (const i in key.checked) {
          if (key.checked[i].staffId !== item.staffId) {
            checked.push(key.checked[i]);
          }
        }
        key.checked = checked;
        isBreak = true;
      }
      if (isBreak) break;
    }
    let departNum = 0;
    for (let item of selectedDeparts) {
      departNum += item.userNumber;
    }
    this.setState({
      selectedDeparts,
      selectedUsers,
      selectedDepartIds,
      selectedUserIds,
      checkedKeys,
      departNum,
    });
    this.props.getSelectedUser({
      selectedDeparts,
      selectedUsers,
      selectedDepartIds,
      selectedUserIds,
      checkedKeys,
      departNum,
    });
  };
  getUserNum = () => {
    const { selectedDeparts, selectedUserIds } = this.state;
    let num = 0;
    for (const item of selectedDeparts) {
      num += item.userNumber;
    }
    num += selectedUserIds.length;
    return num;
  };
  onSelectedOpen = () => {
    const {
      selectedDeparts,
      selectedUsers,
      selectedDepartIds,
      selectedUserIds,
      checkedKeys,
    } = this.state;
    this.setState({
      selectedDepartsCopy: superCopy(selectedDeparts),
      selectedUsersCopy: superCopy(selectedUsers),
      selectedDepartIdsCopy: superCopy(selectedDepartIds),
      selectedUserIdsCopy: superCopy(selectedUserIds),
      checkedKeysCopy: superCopy(checkedKeys),
      isSelectedOpen: true,
    });
  };
  handleSelectedCancel = () => {
    const {
      selectedDepartsCopy,
      selectedUsersCopy,
      selectedDepartIdsCopy,
      selectedUserIdsCopy,
      checkedKeysCopy,
    } = this.state;
    this.setState(
      {
        selectedDeparts: selectedDepartsCopy,
        selectedUsers: selectedUsersCopy,
        selectedDepartIds: selectedDepartIdsCopy,
        selectedUserIds: selectedUserIdsCopy,
        checkedKeys: checkedKeysCopy,
      },
      () => {
        this.setState({
          selectedDepartsCopy: [],
          selectedUsersCopy: [],
          selectedDepartIdsCopy: [],
          selectedUserIdsCopy: [],
          checkedKeysCopy: [],
          isSelectedOpen: false,
        });
      }
    );
  };
  handleSelectOk = () => {
    const {
      selectedDeparts,
      selectedUsers,
      selectedDepartIds,
      selectedUserIds,
      checkedKeys,
      departNum,
    } = this.state;
    this.setState({ isSelectedOpen: false });
    this.props.getSelectedUser({
      selectedDeparts,
      selectedUsers,
      selectedDepartIds,
      selectedUserIds,
      checkedKeys,
      departNum,
    });
  };
  render() {
    return (
      <div className="mb-selected-user-warp">
        <div className="warp-top">
          <div className="select-input">
            <Input
              onCompositionStart={this.onLockSearchStatus}
              onCompositionEnd={this.onLockSearchStatus}
              placeholder="请输入关键词"
              value={this.state.searchKey}
              onChange={this.onSearchKeyChange}
            />
            <img className="search-icon" src={searchIcon} alt="" />
          </div>
        </div>
        <div className="warp-content">
          {this.state.selectedUsers.length >
          0 ? (
            <div className="warp-top">
              <div className="warp-top-left">
                {this.state.selectedUsers.map((item, index) => {
                  return (
                    <div className="select-item-box" key={index}>
                      <Avatar
                        key={index}
                        size={40}
                        src={item.staffAvatarUrl}
                        icon={<img src={UserOutlined} alt="" />}
                      />
                      <div className="select-item-box-txt">
                        {item.staffName}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="warp-top-right" onClick={this.onSelectedOpen}>
                <img src={rightOutlineIcon} alt="" />
              </div>
            </div>
          ) : null}
          <div className="select-top"></div>
          <div
            style={{
              height:
                this.state.selectedUsers.length +
                  this.state.selectedDeparts.length >
                0
                  ? "calc(100vh - 300px)"
                  : "calc(100vh - 200px)",
            }}
            className="select-content"
          >
            <Checkbox.Group
              disabled={this.state.isDisabledTreeData}
              value={this.state.defaultSelectedKeys}
              onChange={this.onCheck}
            >
              {this.state.treeData.map((item, index) => {
                return (
                  <div className="select-item" key={index}>
                    <Checkbox value={item.staffId} disabled={item.disabled}>
                      {item.isUser ? (
                        <Avatar
                          size={20}
                          src={item.staffAvatarUrl}
                          icon={<img src={UserOutlined} />}
                        />
                      ) : null}
                      <span className="select-item-txt">{item.staffName}</span>
                    </Checkbox>
                  </div>
                );
              })}
            </Checkbox.Group>
          </div>
        </div>
        <Popup
          visible={this.state.isSelectedOpen}
          onMaskClick={this.handleSelectedCancel}
          onClose={this.handleSelectedCancel}
          bodyStyle={{
            borderTopLeftRadius: "16px",
            borderTopRightRadius: "16px",
            minHeight: "90vh",
            padding: "20px",
            boxSizing: "border-box",
          }}
        >
          <div className="popup-header">
            <div className="popup-header-left">
              <img
                onClick={this.handleSelectedCancel}
                className="leftOutline-icon"
                src={leftOutlineIcon}
                alt=""
              />
            </div>
            <div className="popup-header-center popup-title">已选</div>
            <div className="popup-header-right">
              <span onClick={this.onClearSelectedClick}>清空</span>
            </div>
          </div>
          <div className="popup-body">
            <div className="selected-content">
              {this.state.selectedUsers.map((item, index) => {
                return (
                  <div key={index} className="selected-item">
                    <div className="selected-item-left">
                      <Avatar
                        size={40}
                        src={item.staffAvatarUrl}
                        icon={<img alt="" src={UserOutlined} />}
                      />
                      <span className="selected-item-name">
                        {item.staffName}
                      </span>
                    </div>
                    <div className="selected-item-right">
                      <img
                        className="close-icon"
                        onClick={() =>
                          this.onDelSelectedClick(item, index, "user")
                        }
                        src={mbCloseIcon}
                        alt=""
                      />
                    </div>
                  </div>
                );
              })}
              {this.state.selectedDeparts.map((item, index) => {
                return (
                  <div key={index} className="selected-item">
                    <div className="selected-item-left">
                      {item.staffId === "0" ? (
                        <div className="tenant-user">全</div>
                      ) : null}
                      <span className="selected-item-name">
                        {item.staffName}
                      </span>
                    </div>
                    <div className="selected-item-right">
                      <img
                        className="close-icon"
                        onClick={() =>
                          this.onDelSelectedClick(item, index, "depart")
                        }
                        src={mbCloseIcon}
                        alt=""
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="popup-footer">
            <Button onClick={this.handleSelectOk} color="primary" fill="solid">
              确定
            </Button>
          </div>
        </Popup>
      </div>
    );
  }
}
export default MbSelectedUser;
