import React, { useState, useEffect, useMemo } from 'react';
import './HolidayConfig.css';
import { Modal, Select, Tooltip,Button,Spin} from 'antd';
import { LeftOutlined, RightOutlined, InfoCircleFilled,ExclamationCircleFilled,CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
const { Option } = Select;
// 定义日期类型
// DateItem 类型定义（用于文档说明）
// 结构: { day: number, date: Date, isCurrentMonth: boolean, isWeekend: boolean, isHoliday: boolean, holidayName?: string }
import {
  queryCountryHoliday,
  resetStandardsConfigHoliday,
  syncFutureCalendar,
  getStandardsConfigHoliday,
  operationTimeSave
} from "../../../../../../api/api";
const HolidayConfig = ({
  visible,
  onClose,
  getHolidayConfig,
  holidayConfigData,
  editId,
  isDefault,
  getRestTime,
  uuid  
}) => {
  const [holidayDefaultConfigArr, setHolidayDefaultConfigArr] = useState(() => {
    return holidayConfigData?.holidayDefaultConfigArr || new Set();
  });
  const [deadline, setDeadline] = useState(holidayConfigData?.deadline || '');
  const [loading, setLoading] = useState(false)
  const [countryRegionEnums, setCountryRegionEnums] = useState(holidayConfigData?.countryRegionEnums || []);
  const [holidayConfig, setHolidayConfig] = useState(holidayConfigData);
  const [lastAdjustDate, setLastAdjustDate] = useState(holidayConfigData?.lastSynchronizationTime || '');
  const [manuallySynchronizeTime, setManuallySynchronizeTime] = useState(holidayConfigData?.manuallySynchronizeTime || '');
  const [syncStatus, setSyncStatus] = useState(holidayConfigData?.deadline || '');
  const [restTime, setRestTime] = useState(holidayConfigData?.restTime || '');
  const [syncTime, setSyncTime] = useState(holidayConfigData?.syncTime || '');
  const [currentDate, setCurrentDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); // 默认当前年月
  const [selectedRegion, setSelectedRegion] = useState('中国');
  const [holidayMap, setHolidayMap] = useState({}); // 存储休息日状态 key: yyyy-mm-dd
  const [countryHolidayMap, setCountryHolidayMap] = useState(new Map()); // 存储国家休息日状态 key: yyyy-mm-dd
  const [operationDate, setOperationDate] = useState(holidayConfigData?.operationDate || new Map());
  const [holidayList] = useState({});
  const [countryCode, setCountryCode] = useState(holidayConfigData?.countryCode || (holidayConfigData?.countryRegionEnums && holidayConfigData.countryRegionEnums.length > 0 ? holidayConfigData.countryRegionEnums[0].countryCode : ''));
  // 当holidayConfigData更新时，同步更新相关状态
  useEffect(() => {
    // setCountryRegionEnums(holidayConfigData?.countryRegionEnums || []);
    // setHolidayConfig(holidayConfigData);
    // setHolidayDefaultConfigArr(holidayConfigData?.holidayDefaultConfigArr || new Set());
    
    // // 如果当前的国家代码不在新的countryRegionEnums中，或者没有设置国家代码，则设置为默认值
    // const newCountryRegionEnums = holidayConfigData?.countryRegionEnums || [];
    // if (newCountryRegionEnums.length > 0) {
    //   const isValidCountryCode = newCountryRegionEnums.some(region => region.countryCode === countryCode);
    //   if (!isValidCountryCode) {
    //     const defaultCountryCode = holidayConfigData?.countryCode || newCountryRegionEnums[0].countryCode;
    //     setCountryCode(defaultCountryCode);
    //   }
    // }
  }, [holidayConfigData]);  // 移除countryCode依赖，避免选择国家时触发此effect
  
  // 年份和月份选择状态
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // JS的月份从0开始，需要+1
    
  // 当countryRegionEnums更新时，确保当前选择的国家代码仍然有效
  useEffect(() => {
    // console.log('countryRegionEnums', countryRegionEnums);
    // console.log('countryCode', countryCode);
  }, [countryRegionEnums, countryCode]);
  useEffect(() => {
    //console.log('holidayDefaultConfigArr88888', holidayDefaultConfigArr);
  }, [holidayDefaultConfigArr]);
  // 初始化日历数据
  useEffect(() => {
      // // 初始化当月所有日期的休息日状态（默认周六周日为休息日）
      // const year = currentDate.getFullYear();
      // const month = currentDate.getMonth();
      // const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      // const initialHolidayMap = {};
      // for (let day = 1; day <= daysInMonth; day++) {
      //   const date = new Date(year, month, day);
      //   const dateStr = formatDate(date);
      //   const dayOfWeek = date.getDay();
      //   // 周六(6)、周日(0)默认是休息日
      //   initialHolidayMap[dateStr] = dayOfWeek === 0 || dayOfWeek === 6;
      // }
      // console.log('initialHolidayMap', initialHolidayMap);
      // setHolidayMap(initialHolidayMap);
  }, [currentDate]);
  const queryCountryHolidayData = async () => {
    let syncLocalDate=selectedYear+'-'+(selectedMonth<10?'0'+selectedMonth:selectedMonth)+'-01'
    // 检查年月是否已经存在于holidayDefaultConfigArr中
    const yearMonthPrefix = selectedYear + '-' + (selectedMonth<10?'0'+selectedMonth:selectedMonth);
    const hasDataForYearMonth = Array.from(holidayDefaultConfigArr).some(date => 
      date.startsWith(yearMonthPrefix)
    );
    // 如果年月不存在于holidayDefaultConfigArr中，则调用接口
    if (!hasDataForYearMonth) {
      const data={
        countryCode: countryCode,
        syncLocalDate:syncLocalDate+" 00:00:00"
      }
      const res = await queryCountryHoliday(data);
      if (res?.result) {
        if(res.data){
          const mergedSet = new Set(holidayDefaultConfigArr);
          if (res?.data?.holidayDefaultConfigVos){
            res?.data?.holidayDefaultConfigVos.forEach(item => {
              mergedSet.add(item.holiday);
            });
          }
          setHolidayDefaultConfigArr(mergedSet);
        };
      }
    }
  };
  const resetStandardsConfigHolidayData = async () => {
    let currentTime = dayjs().format('YYYY-MM-DD HH:mm:ss')
    //let syncLocalDate=selectedYear+'-'+(selectedMonth<10?'0'+selectedMonth:selectedMonth)+'-01'
    const data = { id: editId || '',countryCode: countryCode,syncLocalDate:currentTime,uuid:uuid}
    const res = await resetStandardsConfigHoliday(data);
    if (res?.result) {
      getStandardsConfigHolidayInfo(currentTime);
      setRestTime(currentTime)
    }
    setLoading(false);
  }
  const syncFutureCalendarData = async (deadlineTimeData) => {
    let syncDate = manuallySynchronizeTime;
    const currentDate = dayjs().format('YYYY-MM-DD');
    let result;
    let deadlineTime=''
    if (!syncDate) {
        result = dayjs().format('YYYY-MM-DD HH:mm:ss')
        deadlineTime=dayjs().format('YYYY-MM-DD HH:mm:ss')
    }else {
      //console.log('syncDate', syncDate,currentDate);
      const sync = syncDate.valueOf();
      const current = currentDate.valueOf();
      if (sync > current) {
        result = `${syncDate} 00:00:00`;
        deadlineTime=`${deadlineTimeData} 00:00:00`;
      } else {
        result = dayjs().format('YYYY-MM-DD HH:mm:ss')
        if(sync === current){
          deadlineTime=`${deadlineTimeData} 00:00:00`;
        }else{
          deadlineTime=dayjs().format('YYYY-MM-DD HH:mm:ss')
        }
      }
    }
    const data={
      deadlineTime: deadlineTime,
      countryCode: countryCode,
      syncLocalDate:result,
      uuid:uuid
    }
    if(editId){
      data.id = editId
    }
    setLoading(true);
    const res = await syncFutureCalendar(data);
    if (res?.result) {
      window.JSSDK.toast.success("同步成功")
      if(editId){
        setManuallySynchronizeTime(res?.data?.manuallySynchronizeTime || null)
      }else{
        setManuallySynchronizeTime(syncDate)
        setSyncTime(result)
      }
      setLastAdjustDate(res?.data?.lastSynchronizationTime || null)
      setSyncStatus(res?.data?.deadline || null)
      setDeadline(res?.data?.deadline || '')
    }
    setLoading(false);
  };
  // 当年份或月份变化时更新当前日期
  useEffect(() => {
      // 只在Modal可见时更新日期
      const newDate = new Date(selectedYear, selectedMonth - 1, 1); // 月份减1是因为Date构造函数的月份从0开始
      setCurrentDate(newDate);
      queryCountryHolidayData()
  }, [selectedYear, selectedMonth]);

  // 格式化日期为 yyyy-mm-dd
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 生成当月日历数据
  const generateCalendar = () => {
    const year = selectedYear;
    const month = selectedMonth - 1; // selectedMonth是1-12，而Date的月份是0-11
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const firstDayWeek = firstDayOfMonth.getDay() || 7; // 周一为1，周日为7

    // 获取上月最后几天
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const prevMonthDays = [];
    for (let i = firstDayWeek - 1; i > 0; i--) {
      const day = prevMonthLastDay - i + 1;
      const date = new Date(year, month - 1, day);
      prevMonthDays.push({
        day,
        date,
        isCurrentMonth: false,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        isHoliday: false
      });
    }

    // 获取当月天数
    const currentMonthDays = [];
    const daysInMonth = lastDayOfMonth.getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = formatDate(date);
      currentMonthDays.push({
        day,
        date,
        isCurrentMonth: true,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        isHoliday: holidayDefaultConfigArr.has(dateStr) || false,
        holidayName: holidayList[dateStr]
      });
    }

    // 获取下月开头几天
    const totalDays = prevMonthDays.length + currentMonthDays.length;
    const nextMonthDaysNeeded = 7 - (totalDays % 7) || 7;
    const nextMonthDays = [];
    for (let day = 1; day <= nextMonthDaysNeeded; day++) {
      const date = new Date(year, month + 1, day);
      nextMonthDays.push({
        day,
        date,
        isCurrentMonth: false,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        isHoliday: false
      });
    }

    // 合并并按周分组
    const allDays = [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];
    const calendarWeeks = [];
    for (let i = 0; i < allDays.length; i += 7) {
      calendarWeeks.push(allDays.slice(i, i + 7));
    }
    return calendarWeeks;
  };
  // 获取操作过的最大日期
  const getMaxOperationDate = () => {
    if (operationDate.size === 0) {
      return null;
    }
    const sortedDates = Array.from(operationDate.keys()).sort((a, b) => new Date(b) - new Date(a));
    return sortedDates[0];
  };

  useEffect(() => {
    const maxDate = getMaxOperationDate();
    //console.log('operationDate', operationDate, '最大操作日期', maxDate,lastAdjustDate);
    if (manuallySynchronizeTime) {
      const date1 = new Date(maxDate);
      const date2 = new Date(manuallySynchronizeTime);
      if (date1 > date2) {
        //console.log('maxDate 晚于 lastAdjustDate');
        setManuallySynchronizeTime(maxDate);
      } 
    }else{
      setManuallySynchronizeTime(maxDate);
    }
  }, [operationDate]);
  const saveOperationTime = async (dateStr) => {
    const data={
      uuid: uuid,
      type: "update",
      countryCode:countryCode,
      operationTime:dateStr+" 00:00:00"
    }
    const res = operationTimeSave(data);
    // if (maxDate) {
    //   const data = {
    //     uuid: uuid,
    //     operationTime: maxDate
    //   };
    //   setLoading(true);
    //   const res = await operationTimeSave(data);
    //   if (res?.result) {
    //     window.JSSDK.toast.success("保存成功");
    //   }
    //   setLoading(false);
    // }
  };
  // 切换休息日状态
  const toggleHoliday = (date,day) => {
    if (!date) return;
    const dateStr = formatDate(date);
    saveOperationTime(dateStr);
    // 非当前月日期不可点击
    if (date.getMonth() !== currentDate.getMonth()) return;
    if (!operationDate.has(dateStr)){
      setOperationDate(prev => {
          const newMap = new Map(prev);
          newMap.set(dateStr, day.isHoliday);
          return newMap;
        })
    }
    if (day.isHoliday){
      setHolidayDefaultConfigArr(prev => {
        const newSet = new Set(prev);
        newSet.delete(dateStr);
        return newSet;
      });
    }else{
      setHolidayDefaultConfigArr(prev => {
        const newSet = new Set(prev);
        newSet.add(dateStr);
        return newSet;
      });
    };
    //setLastAdjustDate(dateStr);
    // setHolidayMap(prev => ({
    //   ...prev,
    //   [dateStr]: !prev[dateStr]
    // }));
  };
    const getStandardsConfigHolidayInfo = async (restTime) => {
      let syncLocalDate=selectedYear+'-'+(selectedMonth<10?'0'+selectedMonth:selectedMonth)+'-01'
       const data={
        isDefault: isDefault || false,
        countryCode: countryCode,
        syncLocalDate:syncLocalDate+" 00:00:00"
      }
      if (editId) {
        data.id = editId
      }
      if (restTime) {
        data.restTime = restTime
      }
      setLoading(true);
      const res = await getStandardsConfigHoliday(data);
      if (res?.result) {
        if (res?.data) {
          const holidayDefaultConfigArr = new Set();
          if (res?.data?.holidayDefaultConfigVos){
            res?.data?.holidayDefaultConfigVos.forEach((config) => {
              holidayDefaultConfigArr.add(config.holiday);
            });
          }
          setHolidayDefaultConfigArr(holidayDefaultConfigArr)
          setOperationDate(new Map())
          setLastAdjustDate(res?.data?.lastSynchronizationTime || '')
          setManuallySynchronizeTime(res?.data?.manuallySynchronizeTime || '')
          setSyncStatus(res?.data?.deadline || '')
          setDeadline(res?.data?.deadline || '')
        }
      } 
      setLoading(false);
    };
  // 重置休息日配置
  const resetHolidayConfig = () => {
     Modal.confirm({
      title: "确认重置？",
      icon: <ExclamationCircleFilled />,
      content: "是否重置当前国家/地区的所有休息日？重置后，日历视图所有数据将被清空，系统将根据最新API重新生成日历",
      closeIcon: <CloseOutlined />,
      width: 480,
      centered: true,
      async onOk() {
        setLoading(true);
        resetStandardsConfigHolidayData()
      },
      onCancel() {
      },
    });
  };
  // 1. 使用安全的日期解析
  const parseDateSafe = (str) => {
  const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  // 同步未来日历
  const handleSyncFutureCalendar = () => {
    let syncDate = manuallySynchronizeTime;
    const currentDate = dayjs().format('YYYY-MM-DD');
    let result;
    let syncContent='';
    if (!syncDate) {
        result = currentDate
        syncContent=`本次操作将刷新${result}（今天）及之后的法定节假日配置，${result}之前的数据保持不变，是否确认同步？`
    }else {
      const sync = syncDate.valueOf();
      const current = currentDate.valueOf();
      if (sync >= current) {
        // 3. 加1天
        const nextDay = new Date(sync);
        nextDay.setDate(nextDay.getDate() + 1);
        
        // 4. 使用本地时间格式化
        const year = nextDay.getFullYear();
        const month = String(nextDay.getMonth() + 1).padStart(2, '0');
        const day = String(nextDay.getDate()).padStart(2, '0');
        result = `${year}-${month}-${day}`;
      } else {
        result = currentDate;
      }
      syncContent=`为了保护您的手动配置，本次操作将刷新${result}及之后的法定节假日配置，${result}之前的所有数据将严格保留，不做任何改动。是否确认同步？`
    }
    // 模拟同步操作
     Modal.confirm({
      title: "确认同步未来日历？",
      icon: <ExclamationCircleFilled />,
      content: syncContent,
      closeIcon: <CloseOutlined />,
      width: 480,
      centered: true,
      async onOk() {
        syncFutureCalendarData(result)
      },
      onCancel() {
      },
    });
  };

  // 确定保存
  const confirmConfig = () => {
    getRestTime(restTime)
    getHolidayConfig({
      syncTime: syncTime,
      restTime: restTime,
      countryRegionEnums: countryRegionEnums,
      holidayDefaultConfigArr: holidayDefaultConfigArr,
      operationDate: operationDate,
      lastSynchronizationTime: lastAdjustDate,
      manuallySynchronizeTime: manuallySynchronizeTime,
      countryCode: countryCode,
      syncStatus: syncStatus,
      deadline: deadline,
      id: editId
    })
  };

  const calendarWeeks = useMemo(() => generateCalendar(), [selectedYear, selectedMonth, holidayDefaultConfigArr]);
  const currentMonthText = `${selectedYear}年${selectedMonth}月`;
  const saveCountryData = async(val) => {
    setCountryHolidayMap(prev => {
        const newMap = new Map(prev);
        newMap.set(countryCode, {
          holidayConfigArr: holidayDefaultConfigArr,
          lastAdjustDate: lastAdjustDate,
          manuallySynchronizeTime: manuallySynchronizeTime,
          operationDate: operationDate,
          syncStatus: syncStatus,
          restTime: restTime,
          syncTime: syncTime
        });
        return newMap
    });
    let syncLocalDate=selectedYear+'-'+(selectedMonth<10?'0'+selectedMonth:selectedMonth)+'-01'
    const data={
      countryCode: val,
      syncLocalDate:syncLocalDate+" 00:00:00"
    }
    if (countryHolidayMap.has(val) && countryHolidayMap.get(val).restTime) {
        let restTimeData = countryHolidayMap.get(val).restTime;
        data.restTime = restTimeData
    }
    if(editId){
      data.id=editId
    }
    data.uuid=uuid
    setLoading(true);
    const res = await queryCountryHoliday(data);
    if (res?.result) {
      let holidayConfigArr = new Set()
      if (countryHolidayMap.has(val)) {
      const countryHolidayInfo = countryHolidayMap.get(val)
      holidayConfigArr=countryHolidayInfo.holidayConfigArr
      setLastAdjustDate(countryHolidayInfo.lastAdjustDate)
      setManuallySynchronizeTime(countryHolidayInfo.manuallySynchronizeTime)
      setOperationDate(countryHolidayInfo.operationDate)
      }else{
        setLastAdjustDate('')
        setManuallySynchronizeTime('')
        setOperationDate(new Map())
      }
      if(res?.data){
        if (!countryHolidayMap.has(val)) {
          holidayConfigArr = new Set(holidayConfigArr)
          if (res?.data?.holidayDefaultConfigVos){
            res?.data?.holidayDefaultConfigVos.forEach(item => {
              holidayConfigArr.add(item.holiday)
            })
          }
        }
        if (res?.data?.lastSynchronizationTime) {
          setLastAdjustDate(res?.data?.lastSynchronizationTime)
        }
        setSyncStatus(res?.data?.deadline || '')
        setDeadline(res?.data?.deadline || '')
        setManuallySynchronizeTime(res?.data?.manuallySynchronizeTime || '')
      };
      setHolidayDefaultConfigArr(holidayConfigArr)
    }
    setLoading(false);
    setCountryCode(val);
  };
  return (
    <div className="holiday-config-modal">
      <Spin spinning={loading}>
      {/* 同步状态说明 */}
      <div className="sync-status">
        <p>手动配置截止至：{manuallySynchronizeTime ? manuallySynchronizeTime : '暂无手动编辑记录'}</p>
        {syncStatus && lastAdjustDate && <p>同步状态说明：上次同步时间：{lastAdjustDate}；系统已自动更新{deadline}之后的数据</p>}
        {!syncStatus && <p>同步状态说明：上次同步时间：{lastAdjustDate}；系统已根据国家/地区法定节假日接口刷新全量数据</p>}
        <p ><span className="system-sync">• 系统自动同步已开启</span> <span>自动同步说明：每月1号，自动更新节假日
          <Tooltip title="自动同步说明：
          1、系统于每月1号自动同步最新节假日。
          2、系统仅更新最后编辑日期与当月1日两者中较晚日期之后的数据，以最大限度保留您的手动配置。
          3、若没有编辑过数据，将同步每月1号后的数据。" styles={{maxWidth:'420px'}}>
          <InfoCircleFilled  style={{ marginLeft: '4px', color: '#bbbbbb' }} />
        </Tooltip></span></p>
      </div>

      {/* 国家/地区选择 */}
      <div className="region-select">
        <label className='region-label'>国家/地区设置</label>
        <p className="region-tip">进行国家或地区切换操作时，系统会保留当前国家或地区的数据</p>
        <Select
            value={countryCode}
            onChange={(val) => saveCountryData(val)}
            style={{ width: 250 }}
            size="middle"
          >
            {countryRegionEnums.map((regionEnum, index) => (
              <Option key={index} value={regionEnum.countryCode}>
                {regionEnum.countryName}
              </Option>
            ))}
          </Select>
      </div>

      {/* 日历区域 */}
      <div className="calendar-container">
        {/* 年月选择 */}
        <div className="month-nav" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
          <button 
            onClick={() => {
              let newMonth = selectedMonth - 1;
              let newYear = selectedYear;
              if (newMonth < 1) {
                newMonth = 12;
                newYear -= 1;
              }
              setSelectedYear(newYear);
              setSelectedMonth(newMonth);
            }} 
            className="month-btn"
          >
            <LeftOutlined />
          </button>
          <Select
            value={selectedYear}
            onChange={setSelectedYear}
            style={{ width: 100 }}
            size="middle"
          >
            {Array.from({ length: 10 }, (_, i) => 2020 + i).map(year => (
              <Option key={year} value={year}>{year}年</Option>
            ))}
          </Select>
          <Select
            value={selectedMonth}
            onChange={setSelectedMonth}
            style={{ width: 80 }}
            size="middle"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
              <Option key={month} value={month}>{month}月</Option>
            ))}
          </Select>
          <button 
            onClick={() => {
              let newMonth = selectedMonth + 1;
              let newYear = selectedYear;
              if (newMonth > 12) {
                newMonth = 1;
                newYear += 1;
              }
              setSelectedYear(newYear);
              setSelectedMonth(newMonth);
            }} 
            className="month-btn"
          >
           <RightOutlined />
          </button>
        </div>

        {/* 星期表头 */}
        <div className="week-header">
          <div>周一</div>
          <div>周二</div>
          <div>周三</div>
          <div>周四</div>
          <div>周五</div>
          <div>周六</div>
          <div>周日</div>
        </div>

        {/* 日历网格 */}
        <div className="calendar-grid">
          {calendarWeeks.map((week, weekIndex) => (
            <div key={weekIndex} className="calendar-week">
              {week.map((day, dayIndex) => {
                const dateStr = formatDate(day.date);
                let isHoliday
                if (holidayDefaultConfigArr.has(dateStr)) {
                  isHoliday = true;
                }else{
                  isHoliday = false;
                }
                //const isHolidayLabel = holidayList[dateStr];
                
                // return (
                //   <div 
                //     key={dayIndex}
                //     className={`calendar-cell 
                //       ${!day.isCurrentMonth ? 'other-month' : ''} 
                //       ${isHoliday ? 'holiday' : ''}
                //       ${day.isWeekend ? 'weekend' : ''}`}
                //     onClick={() => toggleHoliday(day.date)}
                //   >
                //     <span className="day-number">{day.day}</span>
                //     {isHolidayLabel && <span className="holiday-label">{isHolidayLabel}</span>}
                //   </div>
                // );
                return (
                  <div 
                    key={dayIndex}
                    className={`calendar-cell 
                       ${!day.isCurrentMonth ? 'other-month' :isHoliday ? 'holiday' : ''} 
                     `}
                    onClick={() => toggleHoliday(day.date,day)}
                  >
                    <span className="day-number">{day.isCurrentMonth ? day.day: day.day}</span>
                    {/* {isHolidayLabel && <span className="holiday-label">{isHolidayLabel}</span>} */}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* 图例说明 */}
        <div className="legend">
          <span className="legend-item">
            <span className="legend-box work-day"></span> 工作日
          </span>
          <span className="legend-item">
            <span className="legend-box holiday-day"></span> 休息日
          </span>
          <span className="legend-tip">注：点击单元格可配置休息日，再次点击取消</span>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="modal-footer">
        <Button onClick={() => resetHolidayConfig()}>
            重置
          </Button>
          <Button type="default" className="sync-btn" onClick={() => handleSyncFutureCalendar()}>
            同步未来日历
          </Button>
          <Button type="primary" onClick={() => confirmConfig()}>
            确定
          </Button>
      </div>
    </Spin>
    </div>
  );
};

export default HolidayConfig;
