const COLOMBIA_TIME_ZONE = 'America/Bogota';
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const bogotaFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: COLOMBIA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

function dateKeyInBogota(date = new Date()) {
  const parts = bogotaFormatter.formatToParts(date);
  const part = type => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

// Colombia no aplica horario de verano: el día local siempre inicia a las 05:00 UTC.
function bogotaDayBounds(date = new Date()) {
  const dateKey = dateKeyInBogota(date);
  const start = new Date(`${dateKey}T00:00:00-05:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, dateKey };
}

function weekdayFromDateKey(dateKey) {
  return new Date(`${dateKey}T12:00:00.000Z`).getUTCDay();
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Ley Emiliani: si el festivo no cae lunes, se traslada al lunes siguiente.
function nextMonday(dateKey) {
  const weekday = weekdayFromDateKey(dateKey);
  return addDays(dateKey, (1 - weekday + 7) % 7);
}

// Computus gregoriano: domingo de Pascua.
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad(month)}-${pad(day)}`;
}

const holidayCache = new Map();

function holidaysForYear(year) {
  if (holidayCache.has(year)) return holidayCache.get(year);
  const easter = easterSunday(year);

  const fixed = [
    `${year}-01-01`,
    `${year}-05-01`,
    `${year}-07-20`,
    `${year}-08-07`,
    `${year}-12-08`,
    `${year}-12-25`
  ];

  const movedToMonday = [
    `${year}-01-06`,
    `${year}-03-19`,
    `${year}-06-29`,
    `${year}-08-15`,
    `${year}-10-12`,
    `${year}-11-01`,
    `${year}-11-11`
  ].map(nextMonday);

  const easterBased = [
    addDays(easter, -3),
    addDays(easter, -2),
    addDays(easter, 43),
    addDays(easter, 64),
    addDays(easter, 71)
  ];

  const holidays = new Set([...fixed, ...movedToMonday, ...easterBased]);
  holidayCache.set(year, holidays);
  return holidays;
}

function isColombianHoliday(dateKey) {
  if (typeof dateKey !== 'string' || !DATE_KEY_PATTERN.test(dateKey)) return false;
  const year = Number(dateKey.slice(0, 4));
  if (!Number.isInteger(year) || year < 1900 || year > 2200) return false;
  return holidaysForYear(year).has(dateKey);
}

module.exports = {
  dateKeyInBogota,
  bogotaDayBounds,
  weekdayFromDateKey,
  isColombianHoliday
};
