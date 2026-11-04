/**
 * 获取当周周一和周日
 */
export function getWeekStartAndEnd() {
  const today = new Date();
  const firstDay = new Date(today);
  const lastDay = new Date(today);

  const diff = 1 - today.getDay();
  firstDay.setDate(today.getDate() + diff);
  lastDay.setDate(today.getDate() + (6 - today.getDay() + 1));

  const formattedFirstDay = `${firstDay.getFullYear()}-${(firstDay.getMonth() + 1).toString().padStart(2, '0')}-${firstDay.getDate().toString().padStart(2, '0')}`;
  const formattedLastDay = `${lastDay.getFullYear()}-${(lastDay.getMonth() + 1).toString().padStart(2, '0')}-${lastDay.getDate().toString().padStart(2, '0')}`;
  
  return { Monday: formattedFirstDay, Sunday: formattedLastDay };
}

/**
 * 获取当月第一天
 */
export function getFirstDayOfNaturalMonth() {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const firstDay = "01";
  return `${year}-${month}-${firstDay}`;
}

/**
 * 获取当月最后一天
 */
export function getLastDayOfNaturalMonth() {
  const currentDate = new Date();
  let year = currentDate.getFullYear();
  let month = String(currentDate.getMonth() + 2).padStart(2, "0");

  if (month === '13') {
    year = year + 1;
    month = '01';
  }

  let firstDay = "01";
  const firstDayOfNextMonth = `${year}-${month}-${firstDay}`;
  const lastDayOfMonth = new Date(new Date(firstDayOfNextMonth).getTime() - 86400000);

  return lastDayOfMonth.toISOString().split("T")[0];
}

/**
 * 判断是否为数字
 */
export function isNumber(value) {
  return typeof value === 'number' && !isNaN(value);
}
