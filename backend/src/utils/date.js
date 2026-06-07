function pad(value) {
  return String(value).padStart(2, '0');
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getDateRange(range, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (range === 'yesterday') {
    const yesterday = addDays(today, -1);
    return {
      range,
      startDate: getLocalDateKey(yesterday),
      endDate: getLocalDateKey(yesterday),
      label: '昨天'
    };
  }

  if (range === 'week') {
    const weekStart = addDays(today, -(today.getDay() || 7) + 1);
    const weekEnd = addDays(weekStart, 6);
    return {
      range,
      startDate: getLocalDateKey(weekStart),
      endDate: getLocalDateKey(weekEnd),
      label: '本周'
    };
  }

  if (range === 'month') {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return {
      range,
      startDate: getLocalDateKey(monthStart),
      endDate: getLocalDateKey(monthEnd),
      label: '本月'
    };
  }

  return {
    range: 'today',
    startDate: getLocalDateKey(today),
    endDate: getLocalDateKey(today),
    label: '今天'
  };
}

function getRecentDateKeys(days, now = new Date()) {
  const count = Math.max(1, Math.min(Number(days) || 7, 31));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dates = [];

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    dates.push(getLocalDateKey(addDays(today, -offset)));
  }

  return dates;
}

function getShortDateLabel(dateKey) {
  const parts = String(dateKey).split('-');
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

module.exports = {
  getLocalDateKey,
  addDays,
  getDateRange,
  getRecentDateKeys,
  getShortDateLabel
};
