export type ScenarioId = 'positive' | 'negative' | 'evening';
export const scenarios = {
  positive: { name: 'Positive feed-in tariff', solar: 6, load: 1.5, fit: 25, importPrice: 30, soc: 80 },
  negative: { name: 'Negative feed-in tariff', solar: 6, load: 1.5, fit: -8, importPrice: 20, soc: 80 },
  evening: { name: 'No solar / evening peak', solar: 0, load: 2, fit: 5, importPrice: 40, soc: 80 },
} as const;
// Idealised AC-coupled system: solar inverter and battery inverter have separate limits.
export const defaults = { capacity: 13.5, chargeLimit: 5, dischargeLimit: 5, reserve: 20, solarInverterLimit: 6, batteryInverterLimit: 5 };
export type Config = typeof defaults;
export const STEP_HOURS = 1 / 60;
export const DURATION_MINUTES = 300;
export function calculate(id: ScenarioId, soc: number, hours = STEP_HOURS, config: Config = defaults) {
  if (!Number.isFinite(hours) || hours <= 0 || !Number.isFinite(soc) || soc < 0 || soc > 100) throw new Error('Invalid simulation state');
  if (!Object.values(config).every(Number.isFinite) || config.capacity <= 0 || config.reserve < 0 || config.reserve > 100 || Object.entries(config).some(([key,value]) => key !== 'reserve' && value < 0)) throw new Error('Invalid system configuration');
  const s = scenarios[id];
  const availableSolar = Math.min(s.solar, config.solarInverterLimit);
  const surplus = Math.max(0, availableSolar - s.load);
  const deficit = Math.max(0, s.load - availableSolar);
  const charge = Math.min(surplus, config.chargeLimit, config.batteryInverterLimit, Math.max(0, (100 - soc) / 100 * config.capacity / hours));
  const discharge = Math.min(deficit, config.dischargeLimit, config.batteryInverterLimit, Math.max(0, (soc - config.reserve) / 100 * config.capacity / hours));
  const exportPower = s.fit < 0 ? 0 : surplus - charge;
  const solar = availableSolar - (s.fit < 0 ? surplus - charge : 0);
  const curtailment = s.solar - solar;
  const importPower = deficit - discharge;
  const nextSoc = Math.min(100, Math.max(0, soc + (charge - discharge) * hours / config.capacity * 100));
  const action = curtailment > 1e-8 ? 'Curtailing excess solar' : charge > 1e-8 ? 'Charging from solar' : discharge > 1e-8 ? 'Powering home from battery' : importPower > 1e-8 ? 'Importing from grid' : 'Exporting surplus solar';
  const explanation = s.fit < 0
    ? 'Negative export prices detected. Solar supplies the home and charges the battery when possible; surplus output is reduced to avoid costly exports.'
    : s.solar === 0
      ? discharge > 1e-8 ? 'With no solar and a high import price, stored energy supplies the home. Discharge respects the power limit and minimum reserve.' : 'The battery has reached its reserve. Grid imports now supply the home, preserving stored backup energy.'
      : 'Solar supplies the home first, then charges the battery. Remaining generation earns the illustrative positive feed-in tariff.';
  return { solar, load: s.load, charge, discharge, exportPower, importPower, curtailment, nextSoc, action, explanation };
}
export type Flow = ReturnType<typeof calculate>;
export type State = { scenario: ScenarioId; soc: number; minute: number; playing: boolean };
export const initialState = (scenario: ScenarioId = 'positive'): State => ({ scenario, soc: scenarios[scenario].soc, minute: 0, playing: false });
export type Event = { type: 'scenario'; scenario: ScenarioId } | { type: 'reset' | 'play' | 'pause' | 'tick' };
export function reducer(state: State, event: Event): State {
  if (event.type === 'scenario') return initialState(event.scenario);
  if (event.type === 'reset') return initialState(state.scenario);
  if (event.type === 'pause') return { ...state, playing: false };
  if (event.type === 'play') return { ...state, playing: state.minute < DURATION_MINUTES };
  if (!state.playing || state.minute >= DURATION_MINUTES) return state;
  const minute = state.minute + 1;
  return { ...state, minute, soc: calculate(state.scenario, state.soc).nextSoc, playing: minute < DURATION_MINUTES };
}
