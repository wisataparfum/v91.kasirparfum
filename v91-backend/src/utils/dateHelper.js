/**
 * Helper Format Waktu Standar Asia/Jakarta (Identik dengan Utilities.formatDate di code.gs)
 */
function getJakartaParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = {};
  for (const part of formatter.formatToParts(date)) {
    parts[part.type] = part.value;
  }
  return parts;
}

function getNowJakarta() {
  const p = getJakartaParts();
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
}

function getTodayCompactJakarta() {
  const p = getJakartaParts();
  return `${p.year}${p.month}${p.day}`;
}

function getTodayDateJakarta() {
  const p = getJakartaParts();
  return `${p.day}/${p.month}/${p.year}`;
}

module.exports = {
  getNowJakarta,
  getTodayCompactJakarta,
  getTodayDateJakarta
};
