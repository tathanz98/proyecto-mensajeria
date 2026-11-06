const { dateKeyInBogota, weekdayFromDateKey, isColombianHoliday } = require('./holidays');

const OFFER_FIELDS = [
  'offerPrice',
  'offerTitle',
  'offerStart',
  'offerEnd',
  'offerWeekdays',
  'offerOnHolidays'
];

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const CLEARED_OFFER = {
  offerPrice: null,
  offerTitle: null,
  offerStart: null,
  offerEnd: null,
  offerWeekdays: null,
  offerOnHolidays: false
};

function cleanTitle(value) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, 60);
}

function parseDateKey(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !DATE_KEY_PATTERN.test(value)) return 'invalid';
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? 'invalid' : date;
}

function toDateKey(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : null;
}

function parseWeekdays(value) {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) return 'invalid';
  const days = [...new Set(value.map(Number))];
  if (days.some(day => !Number.isInteger(day) || day < 0 || day > 6)) return 'invalid';
  return days.sort((a, b) => a - b);
}

function buildOfferData(body, fallback) {
  const has = key => Object.prototype.hasOwnProperty.call(body, key);
  if (!OFFER_FIELDS.some(has)) return { data: {} };

  const rawPrice = has('offerPrice') ? body.offerPrice : fallback.offerPrice;
  if (rawPrice === null || rawPrice === undefined || rawPrice === '') {
    return { data: { ...CLEARED_OFFER } };
  }

  const offerPrice = Number(rawPrice);
  if (!Number.isFinite(offerPrice) || offerPrice <= 0) {
    return { error: 'El precio de oferta no es válido.' };
  }
  if (offerPrice >= fallback.price) {
    return { error: 'El precio de oferta debe ser menor al precio normal.' };
  }

  const offerStart = has('offerStart') ? parseDateKey(body.offerStart) : fallback.offerStart;
  const offerEnd = has('offerEnd') ? parseDateKey(body.offerEnd) : fallback.offerEnd;
  if (offerStart === 'invalid' || offerEnd === 'invalid') {
    return { error: 'Las fechas de la oferta no son válidas.' };
  }
  if (offerStart && offerEnd && offerStart > offerEnd) {
    return { error: 'La fecha final de la oferta debe ser igual o posterior a la inicial.' };
  }

  const weekdays = has('offerWeekdays') ? parseWeekdays(body.offerWeekdays) : fallback.offerWeekdays;
  if (weekdays === 'invalid') {
    return { error: 'Los días de la oferta no son válidos.' };
  }

  const title = has('offerTitle') ? cleanTitle(body.offerTitle) : fallback.offerTitle;
  const onHolidays = has('offerOnHolidays')
    ? Boolean(body.offerOnHolidays)
    : Boolean(fallback.offerOnHolidays);

  return {
    data: {
      offerPrice,
      offerTitle: title || null,
      offerStart: offerStart || null,
      offerEnd: offerEnd || null,
      offerWeekdays: weekdays.length ? weekdays.join(',') : null,
      offerOnHolidays: onHolidays
    }
  };
}

function offerDataForCreate(body, price) {
  const result = buildOfferData(body, { price });
  if (result.error) return result;
  return { data: { ...CLEARED_OFFER, ...result.data } };
}

function offerDataForUpdate(current, body, price) {
  const has = key => Object.prototype.hasOwnProperty.call(body, key);
  if (!OFFER_FIELDS.some(has)) {
    if (current.offerPrice !== null && current.offerPrice >= price) {
      return { error: 'El precio normal debe ser mayor al precio de oferta.' };
    }
    return { data: {} };
  }
  return buildOfferData(body, {
    price,
    offerPrice: current.offerPrice,
    offerTitle: current.offerTitle,
    offerStart: current.offerStart,
    offerEnd: current.offerEnd,
    offerWeekdays: current.offerWeekdays ? current.offerWeekdays.split(',').map(Number) : [],
    offerOnHolidays: current.offerOnHolidays
  });
}

function serializeOffer(product, now = new Date()) {
  if (product.offerPrice === null || product.offerPrice === undefined) return null;

  const today = dateKeyInBogota(now);
  const weekday = weekdayFromDateKey(today);
  const holidayToday = isColombianHoliday(today);
  const weekdays = product.offerWeekdays
    ? product.offerWeekdays.split(',').filter(Boolean).map(Number)
    : [];
  const start = toDateKey(product.offerStart);
  const end = toDateKey(product.offerEnd);

  const inRange = (!start || today >= start) && (!end || today <= end);
  const byWeekday = weekdays.length === 0 ? !product.offerOnHolidays : weekdays.includes(weekday);
  const byHoliday = Boolean(product.offerOnHolidays) && holidayToday;
  const active = inRange && (byWeekday || byHoliday);
  const status = end && today > end ? 'EXPIRED' : active ? 'ACTIVE' : 'SCHEDULED';

  const discount = Math.round(product.price - product.offerPrice);
  const percent = product.price > 0
    ? Math.round((1 - product.offerPrice / product.price) * 100)
    : 0;

  return {
    price: product.offerPrice,
    title: product.offerTitle,
    start,
    end,
    weekdays,
    onHolidays: Boolean(product.offerOnHolidays),
    active,
    status,
    discount,
    percent,
    holidayToday,
    today
  };
}

module.exports = {
  offerDataForCreate,
  offerDataForUpdate,
  serializeOffer
};
