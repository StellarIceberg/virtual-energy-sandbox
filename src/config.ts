/** Illustrative large residential DC-coupled hybrid system, not an average customer. */
export const systemConfig = {
  solarCapacity: 10,
  capacity: 40,
  chargeLimit: 10,
  dischargeLimit: 10,
  initialSoc: 80,
  reserve: 20,
  exportFloor: 25,
  inverterLimit: 10, // Shared AC conversion rating for solar + battery.
  solarInputLimit: 10, // PV DC input; not another inverter.
  batteryPortLimit: 10, // Battery DC interface; not another inverter.
  siteExportLimit: 10,
  exportThreshold: 15,
  forecastDemand: 10,
  standardDuration: 300,
  eveningDuration: 420,
  stepHours: 1 / 60,
  tickMilliseconds: 200,
};
export type Config = typeof systemConfig;
export const speeds = [2, 10, 100] as const;
export type Speed = 1 | typeof speeds[number];
/** Piecewise constant, deterministic schedule: 17:00–24:00. */
export const eveningTariffs = [
  { minute: 0, fit: 8, importPrice: 28 },
  { minute: 60, fit: 18, importPrice: 38 },
  { minute: 120, fit: 35, importPrice: 55 },
  { minute: 180, fit: 22, importPrice: 42 },
  { minute: 240, fit: 12, importPrice: 30 },
  { minute: 300, fit: 7, importPrice: 24 },
  { minute: 360, fit: 5, importPrice: 20 },
];
