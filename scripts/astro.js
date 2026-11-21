// Small astronomical helpers (Jean Meeus, "Astronomical Algorithms") used to CHECK the holiday dates
// that the app takes from the calendars built into the browser (see tests/holidays.test.js).
// The app itself does not need this file. Accuracy: a minute or two, which is enough to find the few
// days on which a new moon or an equinox falls so close to midnight / noon that a calendar can go wrong.
'use strict';

const rad = (x) => (x * Math.PI) / 180;
const jdToDate = (jd) => new Date((jd - 2440587.5) * 86400000);
const DELTA_T = 70; // seconds, TT - UT around 2026..2040 (roughly 69..72)

/** Instant (Date, UT) of the k-th new moon after 2000-01-06 (k = 0). Meeus chapter 49. */
function newMoon(k) {
  const T = k / 1236.85;
  let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T - 0.00000015 * T ** 3 + 0.00000000073 * T ** 4;
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  const M = rad((2.5534 + 29.1053567 * k - 0.0000014 * T * T) % 360);
  const Mp = rad((201.5643 + 385.81693528 * k + 0.0107582 * T * T) % 360);
  const F = rad((160.7108 + 390.67050284 * k - 0.0016118 * T * T) % 360);
  const Om = rad((124.7746 - 1.56375588 * k + 0.0020672 * T * T) % 360);
  jde += -0.4072 * Math.sin(Mp) + 0.17241 * E * Math.sin(M) + 0.01608 * Math.sin(2 * Mp) + 0.01039 * Math.sin(2 * F)
    + 0.00739 * E * Math.sin(Mp - M) - 0.00514 * E * Math.sin(Mp + M) + 0.00208 * E * E * Math.sin(2 * M)
    - 0.00111 * Math.sin(Mp - 2 * F) - 0.00057 * Math.sin(Mp + 2 * F) + 0.00056 * E * Math.sin(2 * Mp + M)
    - 0.00042 * Math.sin(3 * Mp) + 0.00042 * E * Math.sin(M + 2 * F) + 0.00038 * E * Math.sin(M - 2 * F)
    - 0.00024 * E * Math.sin(2 * Mp - M) - 0.00017 * Math.sin(Om);
  return jdToDate(jde - DELTA_T / 86400);
}

/** All new moons (Dates, UT) from the start of `year` - 1 month to the end of `year` + 1 month. */
function newMoonsAround(year) {
  const start = Date.UTC(year, 0, 1) - 35 * 86400000;
  const end = Date.UTC(year + 1, 0, 1) + 35 * 86400000;
  const out = [];
  for (let k = Math.floor((year - 2000) * 12.3685) - 3; k < Math.floor((year - 2000) * 12.3685) + 18; k++) {
    const d = newMoon(k);
    if (d.getTime() >= start && d.getTime() <= end) out.push(d);
  }
  return out;
}

/** Instant (Date, UT) of the March equinox. Meeus chapter 27. */
function marchEquinox(year) {
  const Y = (year - 2000) / 1000;
  const jde0 = 2451623.80984 + 365242.37404 * Y + 0.05169 * Y * Y - 0.00411 * Y ** 3 - 0.00057 * Y ** 4;
  const T = (jde0 - 2451545.0) / 36525;
  const W = rad(35999.373 * T - 2.47);
  const dl = 1 + 0.0334 * Math.cos(W) + 0.0007 * Math.cos(2 * W);
  const A = [485, 203, 199, 182, 156, 136, 77, 74, 70, 58, 52, 50, 45, 44, 29, 18, 17, 16, 14, 12, 12, 12, 9, 8];
  const B = [324.96, 337.23, 342.08, 27.85, 73.14, 171.52, 222.54, 296.72, 243.58, 119.81, 297.17, 21.02, 247.54, 325.15, 60.93, 155.12, 288.79, 198.04, 199.76, 95.39, 287.11, 320.81, 227.73, 15.45];
  const C = [1934.136, 32964.467, 20.186, 445267.112, 45036.886, 22518.443, 65928.934, 3034.906, 9037.513, 33718.147, 150.678, 2281.226, 29929.562, 31555.956, 4443.417, 67555.328, 4562.452, 62894.029, 31436.921, 14577.848, 31931.756, 34777.259, 1222.114, 16859.074];
  let S = 0;
  for (let i = 0; i < 24; i++) S += A[i] * Math.cos(rad(B[i] + C[i] * T));
  return jdToDate(jde0 + (0.00001 * S) / dl - DELTA_T / 86400);
}

/** Calendar day (as 'YYYY-MM-DD') of an instant in a time zone given as offset in hours. */
function dayIn(date, offsetHours) {
  return new Date(date.getTime() + offsetHours * 3600000).toISOString().slice(0, 10);
}

module.exports = { newMoon, newMoonsAround, marchEquinox, dayIn };
