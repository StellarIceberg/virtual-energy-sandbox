import type { PowerFlow } from './engine';

export const CONTROL_CONNECTION_LABEL = 'Control signals · not an electrical connection';
export type ControllerStatus = 'Self-consumption' | 'Dispatching' | 'Preserving' | 'Idle' | 'Control unavailable';
type Context = { soc: number; reserve: number; controlUnavailable?: boolean; batteryUnavailable?: boolean };
const active = (power: number) => power > 1e-8;
const kw = (power: number) => `${power.toFixed(2)} kW`;

/** Presentation only: classify actual flows, never request or change dispatch. */
export function describeController(f: PowerFlow, context: Context): { status: ControllerStatus; explanation: string } {
  const batteryActivity = active(f.charge) ? `The battery is charging at ${kw(f.charge)} from solar through local control.`
    : active(f.discharge) ? `The battery supplies ${kw(f.homeDischarge)} to the home and ${kw(f.gridDischarge)} to the grid.`
    : 'The battery is neither charging nor discharging.';
  const gridActivity = ` Grid exchange: ${kw(f.importPower)} import, ${kw(f.exportPower)} export.`;
  if (context.controlUnavailable) return {status:'Control unavailable', explanation:`A simulated fault prevents automation commands. ${batteryActivity} Local operation can continue without remote commands.${gridActivity}`};
  if (active(f.gridDischarge)) return {status:'Dispatching', explanation:`The educational automation is directing battery exports. ${batteryActivity}${gridActivity}`};
  if (active(f.homeDischarge) || active(f.charge)) return {status:'Self-consumption', explanation:active(f.homeDischarge)
    ? `Local battery control supplies ${kw(f.homeDischarge)} to the home. This discharge does not require an explicit remote automation command.${gridActivity}`
    : `${batteryActivity} Solar charging is local self-consumption; any grid export is solar surplus.${gridActivity}`};
  if (!context.batteryUnavailable && context.soc <= context.reserve + 1e-8) return {status:'Preserving', explanation:`Battery energy is held to protect the ${context.reserve}% reserve. ${batteryActivity}${gridActivity}`};
  return {status:'Idle', explanation:`${batteryActivity}${gridActivity}`};
}
