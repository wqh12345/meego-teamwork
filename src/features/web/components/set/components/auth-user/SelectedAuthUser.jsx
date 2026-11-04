import React, { Component } from "react";
import { Button, Avatar, Input, Checkbox, Tooltip, Spin, Empty } from "antd";
import { filterDuplicates, debounce } from "../../../../../../util/util";
import {
  getProjectMemberList,
  getProjectAllStaff,
  queryAuthAllUser,
  searchAuthUser,
  queryAuthTeamList,
  postSearchMember
} from "../../../../../../api/api";
import { SearchOutlined, CloseOutlined, UserOutlined } from "@ant-design/icons";
import "./SelectedAuthUser.css";
import { UserTag } from '@lark-project/ui-kit-plugin';
class SelectedUser extends Component {
  constructor(props) {
    super(props);
    this.state = {
      type: "",
      searchKey: "",
      deptId: "0",
      isSpinning: true,
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
      defaultSelectedKeys: [],
      departNum: 0,
      userList: [],
      isDisabledTreeData: false,
    };
    this.handleSearchChange = debounce(this.onSearchKeyChange, 800).bind(this);
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
    const { treeData } = this.state;
    let { selectedDeparts, selectedUsers, selectedDepartIds, selectedUserIds } =
      nextProps.selectedUser;
    if (!selectedDepartIds.length) {
      const isDisabledTreeData = false;
      this.setState({ isDisabledTreeData, departNum: 0 });
    }
    if (treeData.length) {
      treeData?.forEach((item) => {
        if (
          selectedUserIds.includes(item.userKey) &&
          !JSON.stringify(selectedUsers).includes(item.userKey)
        )
          selectedUsers.push(item);
      });
    }

    this.setState({
      selectedDepartIds,
      selectedUserIds,
      defaultSelectedKeys: selectedDepartIds.concat(selectedUserIds),
    });
  }
  /** 获取所有人员 */
  getProjectMember = async () => {
    const { selectedUserIds } = this.props.selectedUser;
    if (this.props.type === "teams") {
      const data = {
       teamName:'',
      };
      const res = await queryAuthTeamList(data);
      if (res?.result) {
        const userInfoVos = res.data;
        const selectedUsers = [];
        for (const item of userInfoVos) {
          item.userKey = item.teamId || "";
          item.userName = item.teamName || "";
          item.avatarUrl = 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png'
          item.isUser = true;
          item.isLeaf = true;
          item.icon = (
            <Avatar
              size={20}
              src={item.avatarUrl}
              icon={<img alt="" src={UserOutlined} />}
            />
          );
          if (selectedUserIds.indexOf(item.userKey) !== -1) {
            selectedUsers.push(item);
          }
        }
        console.log('userInfoVos88888',selectedUsers)
        const treeData = userInfoVos;
        this.setState({
          treeData: userInfoVos,
          projectMemberList: userInfoVos,
          selectedUsers,
          isSpinning: false,
        });
      }
    } else {
      const res = await queryAuthAllUser();
      if (res?.result) {
        const userInfoVos = res.data;
        for (const item of userInfoVos) {
          item.isUser = true;
          item.isLeaf = true;
          item.icon = (
            <Avatar
              size={20}
              src={item.avatarUrl}
              icon={<img alt="" src={UserOutlined} />}
            />
          );
        }
        const treeData = userInfoVos;
        this.setState({
          treeData: userInfoVos,
          projectMemberList: userInfoVos,
          isSpinning: false,
        });
      }
    }
  };
  /** 根据姓名模糊搜索 */
  getSearchUserList = async () => {
    this.setState({ isSpinning: true });
    const { searchKey, projectMemberList } = this.state;
    if (!searchKey) {
      this.getProjectMember();
      return;
    }
    if (this.props.type === "teams") {
      const data = {
       teamName:searchKey.trim(),
      };
      const res = await queryAuthTeamList(data);
      if (res?.result) {
        const userInfoVos = res.data;
        const selectedUsers = [];
        for (const item of userInfoVos) {
          item.userKey = item.teamId || "";
          item.userName = item.teamName || "";
          item.avatarUrl = 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png'
          item.isUser = true;
          item.isLeaf = true;
          item.icon = (
            <Avatar
              size={20}
              src={item.avatarUrl}
              icon={<img alt="" src={UserOutlined} />}
            />
          );
          // if (selectedUserIds.indexOf(item.userKey) !== -1) {
          //   selectedUsers.push(item);
          // }
        }
        const treeData = userInfoVos;
        this.setState({
          treeData: userInfoVos,
          isSpinning: false,
        });
      }
      this.setState({ isSpinning: false });
    }else{
        const data = {
          query: searchKey.trim(),
        };
        const res = await postSearchMember(data);
        if (res?.result) {
          for (const item of res.data) {
            item.isLeaf = true;
            item.isUser = true;
            item.avatarUrl = item.staffAvatarUrl || "";
            item.userName = item.staffName || "";
            item.userKey = item.staffUserKey || "";
            item.icon = (
              <Avatar
                size={20}
                src={item.avatarUrl}
                icon={<img alt="" src={UserOutlined} />}
              />
            );
          }
          this.setState({ treeData: res.data, isSpinning: false });
        }
        this.setState({ isSpinning: false });
    }
  };

  /** 输入姓名关键字 */
  onSearchKeyChange = (e) => {
    this.getSearchUserList();
  };

  /** 选中的全部人员 */
  onAllCheck = (checkedKeys, info) => {
    // console.log('onAllCheck', checkedKeys, info);
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
      selectedDepartIds = [info.node.userKey];
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
    });
  };
  /** 选中的人或者部门 */
  onCheck = (e) => {
    const {
      deptId,
      checkedKeys,
      treeData,
      selectedUserIds,
      selectedUsers,
      selectedDepartIds,
      selectedDeparts,
    } = this.state;
    const CheckboxValueType = [];
    const delCheckedIds = [];
    // 找出被删除的元素
    for (const i of treeData) {
      if (e.length) {
        if (e.indexOf(i.userKey) !== -1) {
          CheckboxValueType.push(i);
        } else {
          delCheckedIds.push(i.userKey);
        }
      } else {
        delCheckedIds.push(i.userKey);
      }
    }
    for (const delItem of delCheckedIds) {
      if (selectedUserIds.indexOf(delItem) !== -1)
        selectedUserIds.splice(selectedUserIds.indexOf(delItem), 1);
      if (JSON.stringify(selectedUsers).indexOf(delItem) !== -1) {
        for (const index in selectedUsers) {
          if (selectedUsers[index].userKey === delItem)
            selectedUsers.splice(index, 1);
        }
      }
    }
    if (!checkedKeys.length) {
      checkedKeys.push({
        deptId: deptId,
        checked: CheckboxValueType,
      });
      for (const item of CheckboxValueType) {
        if (item.isUser) {
          if (selectedUserIds.indexOf(item.userKey) === -1) {
            selectedUserIds.push(item.userKey);
            selectedUsers.push(item);
          }
        } else {
          if (selectedDepartIds.indexOf(item.userKey) === -1) {
            selectedDepartIds.push(item.userKey);
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
            if (delCheckedIds.indexOf(item.checked[index].userKey) !== -1) {
              item.checked.splice(index, 1);
            } else {
              if (selectedUserIds.indexOf(item.checked[index].userKey) === -1) {
                selectedUserIds.push(item.checked[index].userKey);
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
              if (selectedUserIds.indexOf(i.userKey) === -1) {
                selectedUserIds.push(i.userKey);
                selectedUsers.push(i);
              }
            } else {
              if (selectedDepartIds.indexOf(i.userKey) === -1) {
                selectedDepartIds.push(i.userKey);
                selectedDeparts.push(i);
              }
            }
          }
        } else {
          for (const i in item.checked) {
            if (delCheckedIds.indexOf(item.checked[i].userKey) !== -1) {
              item.checked.splice(i, 1);
              continue;
            }
            if (item.checked[i].isUser) {
              if (selectedUserIds.indexOf(item.checked[i].userKey) === -1) {
                selectedUserIds.push(item.checked[i].userKey);
                selectedUsers.push(item.checked[i]);
              }
            } else {
              if (selectedDepartIds.indexOf(item.checked[i].userKey) === -1) {
                selectedDepartIds.push(item.checked[i].userKey);
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
            if (selectedUserIds.indexOf(item.userKey) === -1) {
              selectedUserIds.push(item.userKey);
              selectedUsers.push(item);
            }
          } else {
            if (selectedDepartIds.indexOf(item.userKey) === -1) {
              selectedDepartIds.push(item.userKey);
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
    this.props.getSelectedUser({
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
      selectedUserIds.splice(selectedUserIds.indexOf(item.userKey), 1);
      let delIndex = 0;
      selectedUsers.forEach((user, index) => {
        if (user.userKey === item.userKey) {
          delIndex = index;
        }
      });
      selectedUsers.splice(delIndex, 1);
    }
    for (const key of checkedKeys) {
      let isBreak = false;
      if (key.deptId === item.parentId) {
        const checked = [];
        for (const i in key.checked) {
          if (key.checked[i].userKey !== item.userKey) {
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
  render() {
    return (
      <div className="auth-selected-user-warp">
        <div className="selected-user-left">
          <div className="select-input">
            <Input
              placeholder="请输入关键词"
              value={this.state.searchKey}
              suffix={<SearchOutlined style={{ color: "#BBBBBB" }} />}
              onChange={(e) => {
                this.setState({ searchKey: e.target.value });
                this.handleSearchChange(e);
              }}
            />
          </div>
          <Spin spinning={this.state.isSpinning} tip="数据加载中...">
            <div className="select-content">
              <Checkbox.Group
                value={this.state.defaultSelectedKeys}
                onChange={this.onCheck}
              >
                {this.state.treeData?.map((item) => {
                  return (
                    <div className="select-item" key={item.userKey}>
                      <Checkbox
                        value={item.userKey}
                        disabled={
                          this.state.isDisabledTreeData || item.disabled
                        }
                      >
                        {this.props.type === "teams"?(<span><Avatar
                            size={20}
                            src={item.avatarUrl}
                            icon={<img alt="" src={UserOutlined} />}
                          /> <Tooltip title={item.userName}>
                          <span className="select-item-txt">
                            {item.userName}
                          </span>
                        </Tooltip></span>):<UserTag userId={item.userKey} name={item.userName} avatar={item.avatarUrl} />}
                       
                      </Checkbox>
                    </div>
                  );
                })}
              </Checkbox.Group>
              {!this.state.treeData?.length && !this.state.isSpinning ? (
                <div className="empty-data">
                  <Empty
                    image={require("../../../../../../image/no-data-table.png")}
                    styles={{
                      image: {
                        height: 90,
                        width: 90,
                        margin: "auto",
                        marginBottom: 10,
                      },
                    }}
                    description={
                      <span style={{ color: "#727272", fontSize: "12px" }}>
                        暂无数据
                      </span>
                    }
                  />
                </div>
              ) : null}
            </div>
          </Spin>
        </div>
        <div className="selected-user-right">
          <div className="selected-title">
            <div>
              已选<span className="selected-num">{this.state.selectedUsers.length}</span>
            {this.props.type === "teams"? "个团队" : "人"}
            </div>
            {this.state.selectedUsers.length > 0 && (<div>
              <span className="clear-selected" onClick={this.onClearSelectedClick}>清空</span>
            </div>)}
          </div>
          <div className="selected-content">
            {this.state.selectedUsers.map((item, index) => {
              return (
                <div key={index} className="selected-item">
                  <div className="selected-item-left">
                    {this.props.type === "teams"?(<span><Avatar
                            size={20}
                            src={item.avatarUrl}
                            icon={<img alt="" src={UserOutlined} />}
                          /> <Tooltip title={item.userName}>
                          <span className="selected-item-name">
                            {item.userName}
                          </span>
                        </Tooltip></span>):<UserTag userId={item.userKey} name={item.userName} avatar={item.avatarUrl} />}
                  </div>
                  <Button
                    size="small"
                    type="text"
                    icon={<CloseOutlined />}
                    onClick={() => this.onDelSelectedClick(item, index, "user")}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
}
export default SelectedUser;
