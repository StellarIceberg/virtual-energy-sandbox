import { eveningTariffs, systemConfig, type Config, type Speed } from './config';
export { type Config } from './config';
export type ScenarioId = 'positive' | 'negative' | 'evening';
export const defaults = systemConfig;
export const scenarios = {
  positive: { name: 'Positive feed-in tariff', solar: defaults.solarCapacity, load: 1.5, fit: 25, importPrice: 30, soc: defaults.initialSoc },
  negative: { name: 'Negative feed-in tariff', solar: defaults.solarCapacity, load: 1.5, fit: -8, importPrice: 20, soc: defaults.initialSoc },
  evening: { name: 'No solar / evening peak', solar: 0, load: defaults.forecastDemand / (defaults.eveningDuration / 60), fit: 8, importPrice: 28, soc: defaults.initialSoc },
};
export const STEP_HOURS = defaults.stepHours;
export const DURATION_MINUTES = defaults.standardDuration;
export const durationFor = (id: ScenarioId) => id === 'evening' ? defaults.eveningDuration : DURATION_MINUTES;
export function tariffAt(minute: number) {
  return [...eveningTariffs].reverse().find(t => t.minute <= minute) ?? eveningTariffs[0];
}
export function clockLabel(minute: number) {
  const time = 17 * 60 + minute;
  return `${String(Math.floor(time / 60) % 24).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`;
}
export type DispatchInput = {
  solarAvailable: number; load: number; fit: number; importPrice: number;
  requestedBatteryExport?: number; remainingForecast?: number;
  uncontrolledSolar?: number; curtailmentAllowed?: boolean;
  chargeAllowed?: boolean; dischargeAllowed?: boolean; exportLimit?: number;
};
function validate(soc: number, hours: number, c: Config) {
  if (!Number.isFinite(hours) || hours <= 0 || !Number.isFinite(soc) || soc < 0 || soc > 100) throw new Error('Invalid simulation state');
  if (!Object.values(c).every(Number.isFinite) || c.capacity <= 0 || c.eveningDuration <= 0 || c.standardDuration <= 0 || c.stepHours <= 0 || c.tickMilliseconds <= 0 || Object.values(c).some(v => v < 0) || c.reserve > 100 || c.exportFloor > 100 || c.initialSoc > 100) throw new Error('Invalid system configuration');
}
const clean = (n: number) => Math.abs(n) < 1e-10 ? 0 : n;
/** Shared physical dispatch: ideal, separate solar/battery inverters on an AC bus. */
export function dispatchPower(input: DispatchInput, soc: number, hours = STEP_HOURS, c: Config = defaults) {
  validate(soc, hours, c);
  const { solarAvailable, load, fit, importPrice } = input;
  if (![solarAvailable, load, fit, importPrice, input.requestedBatteryExport ?? 0, input.remainingForecast ?? 0, input.uncontrolledSolar ?? 0, input.exportLimit ?? c.siteExportLimit].every(Number.isFinite) || solarAvailable < 0 || load < 0 || (input.exportLimit ?? 0) < 0 || (input.uncontrolledSolar ?? 0) < 0 || (input.remainingForecast ?? 0) < 0 || (input.requestedBatteryExport ?? 0) < 0) throw new Error('Invalid dispatch input');
  const available = Math.min(solarAvailable, c.solarInverterLimit);
  const uncontrolled = Math.min(available, input.uncontrolledSolar ?? 0);
  const energy = soc / 100 * c.capacity;
  const surplus = Math.max(0, available - load);
  const charge = input.chargeAllowed === false ? 0 : Math.min(surplus, c.chargeLimit, c.batteryInverterLimit, (c.capacity - energy) / hours);
  let solar = available;
  if (fit < 0 && input.curtailmentAllowed !== false) solar = Math.min(available, Math.max(uncontrolled, load + charge));
  const siteLimit = input.exportLimit ?? c.siteExportLimit;
  // Local hard export cap remains effective even if cloud curtailment commands fail.
  solar = Math.min(solar, load + charge + siteLimit);
  const deficit = Math.max(0, load - solar);
  const dischargeLimit = input.dischargeAllowed === false ? 0 : Math.min(c.dischargeLimit, c.batteryInverterLimit);
  const homeDischarge = Math.min(deficit, dischargeLimit, Math.max(0, energy - c.reserve / 100 * c.capacity) / hours);
  const solarExport = Math.max(0, solar - load - charge);
  const protectedEnergy = Math.max(c.reserve, c.exportFloor) / 100 * c.capacity + (input.remainingForecast ?? 0);
  const gridDischarge = charge > 0 ? 0 : Math.min(
    input.requestedBatteryExport ?? 0,
    Math.max(0, dischargeLimit - homeDischarge),
    Math.max(0, siteLimit - solarExport),
    Math.max(0, energy - homeDischarge * hours - protectedEnergy) / hours,
  );
  const discharge = homeDischarge + gridDischarge;
  const importPower = clean(deficit - homeDischarge);
  const exportPower = clean(solarExport + gridDischarge);
  const nextSoc = Math.min(100, Math.max(0, soc + (charge - discharge) * hours / c.capacity * 100));
  return { solar: clean(solar), solarAvailable, load, charge: clean(charge), discharge: clean(discharge), homeDischarge: clean(homeDischarge), gridDischarge: clean(gridDischarge), exportPower, importPower, curtailment: clean(solarAvailable - solar), nextSoc, fit, importPrice, exportLimit: siteLimit };
}
export type PowerFlow = ReturnType<typeof dispatchPower>;
/** Greedy allocation across known future price blocks; not a SmartShift algorithm. */
export function plannedExport(minute: number, soc: number, remainingForecast: number, c: Config = defaults) {
  const load = c.forecastDemand / (c.eveningDuration / 60);
  let budget = Math.max(0, soc / 100 * c.capacity - Math.max(c.reserve, c.exportFloor) / 100 * c.capacity - remainingForecast);
  const exportRate = Math.max(0, Math.min(c.dischargeLimit, c.batteryInverterLimit) - load);
  const candidates = eveningTariffs.map((t, i) => ({ ...t, end: eveningTariffs[i+1]?.minute ?? c.eveningDuration }))
    .filter(t => t.end > minute && t.fit > c.exportThreshold)
    .sort((a,b) => b.fit - a.fit || a.minute - b.minute);
  for (const period of candidates) {
    const remainingHours = (period.end - Math.max(minute, period.minute)) / 60;
    const allocation = Math.min(budget, Math.min(exportRate, c.siteExportLimit) * remainingHours);
    budget -= allocation;
    if (minute >= period.minute && minute < period.end) return allocation / remainingHours;
  }
  return 0;
}
export function calculate(id: ScenarioId, soc: number, hours = STEP_HOURS, c: Config = defaults, minute = 0, householdConsumed = 0) {
  validate(soc, hours, c);
  const s = scenarios[id];
  const isEvening = id === 'evening';
  const remainingForecast = isEvening ? Math.max(0, c.forecastDemand - householdConsumed) : 0;
  const load = isEvening ? c.forecastDemand / (c.eveningDuration / 60) : s.load;
  const tariff = isEvening ? tariffAt(minute) : s;
  const exportBudget = isEvening ? Math.max(0, soc / 100 * c.capacity - Math.max(c.reserve, c.exportFloor) / 100 * c.capacity - remainingForecast) : 0;
  const requested = isEvening ? plannedExport(minute, soc, remainingForecast, c) : 0;
  const f = dispatchPower({solarAvailable: isEvening ? 0 : c.solarCapacity, load, fit: tariff.fit, importPrice: tariff.importPrice, requestedBatteryExport: requested, remainingForecast: Math.max(0, remainingForecast - load * hours)}, soc, hours, c);
  let action: string, explanation: string;
  if (isEvening) {
    if (f.gridDischarge > 1e-8) {
      action = 'Exporting in a high-price window';
      explanation = `The illustrative FiT is ${f.fit} c/kWh. A known price schedule allocates surplus energy to higher-priced periods while protecting ${remainingForecast.toFixed(2)} kWh of forecast home demand and the ${Math.max(c.reserve,c.exportFloor)}% export floor.`;
    } else if (f.importPower > 1e-8) {
      action = 'Conserving manufacturer reserve';
      explanation = `The ${c.reserve}% manufacturer reserve or power limit restricts household discharge. Grid imports cover the remainder; no battery exports are requested.`;
    } else if (exportBudget < 1e-8) {
      action = 'Protecting forecast household demand';
      explanation = `Stored energy is allocated to the remaining ${remainingForecast.toFixed(2)} kWh household forecast and reserve. Supplying the home is allowed below the export floor, down to the manufacturer reserve.`;
    } else {
      action = 'Supplying home; saving export budget';
      explanation = `The home uses stored energy. The known schedule preserves ${exportBudget.toFixed(2)} kWh of export budget for higher-priced periods above ${c.exportThreshold} c/kWh.`;
    }
  } else {
    action = f.curtailment > 1e-8 ? 'Curtailing excess solar' : f.charge > 1e-8 ? 'Charging from solar' : f.exportPower > 1e-8 ? 'Exporting surplus solar' : 'Supplying home from solar';
    explanation = s.fit < 0 ? 'Solar supplies the home and charges available storage. Excess output is curtailed to avoid charges for negative-price exports.' : 'Solar supplies the home first, then charges the battery. Remaining generation is exported at the illustrative positive feed-in tariff.';
  }
  return { ...f, action, explanation, remainingForecast, exportBudget };
}
export type Flow = ReturnType<typeof calculate>;
export type Totals = { household: number; imported: number; exported: number; generated: number; curtailed: number; charged: number; discharged: number; exportValue: number; importCost: number };
export const emptyTotals = (): Totals => ({ household:0, imported:0, exported:0, generated:0, curtailed:0, charged:0, discharged:0, exportValue:0, importCost:0 });
export type State = { scenario: ScenarioId; soc: number; minute: number; playing: boolean; speed: Speed; totals: Totals };
export const initialState = (scenario: ScenarioId = 'positive'): State => ({ scenario, soc: defaults.initialSoc, minute: 0, playing: false, speed: 1, totals: emptyTotals() });
export function accumulate(state: State, flow: PowerFlow, duration: number): State {
  const t = state.totals, h = STEP_HOURS;
  const minute = state.minute + 1;
  return {...state, soc: flow.nextSoc, minute, playing: state.playing && minute < duration, totals: {
    household:t.household + flow.load * h, imported:t.imported + flow.importPower * h,
    exported:t.exported + flow.exportPower * h, generated:t.generated + flow.solar * h,
    curtailed:t.curtailed + flow.curtailment * h, charged:t.charged + flow.charge * h,
    discharged:t.discharged + flow.discharge * h,
    exportValue:t.exportValue + flow.exportPower * h * flow.fit / 100,
    importCost:t.importCost + flow.importPower * h * flow.importPrice / 100,
  }};
}
export type Event = { type: 'scenario'; scenario: ScenarioId } | {type:'speed'; speed: Exclude<Speed,1>} | { type: 'reset' | 'play' | 'pause' | 'tick' };
export function reducer(state: State, event: Event): State {
  if (event.type === 'scenario') return initialState(event.scenario);
  if (event.type === 'reset') return initialState(state.scenario);
  if (event.type === 'pause') return { ...state, playing: false };
  if (event.type === 'speed') return {...state, speed:state.speed === event.speed ? 1 : event.speed};
  if (event.type === 'play') return { ...state, playing: state.minute < durationFor(state.scenario) };
  if (!state.playing) return state;
  let next = state;
  // Every simulated minute is integrated, including at 100×. Never jump tariff or reserve boundaries.
  for (let i=0; i<state.speed && next.playing; i++) {
    next = accumulate(next, calculate(next.scenario,next.soc,STEP_HOURS,defaults,next.minute,next.totals.household), durationFor(next.scenario));
  }
  return next;
}
