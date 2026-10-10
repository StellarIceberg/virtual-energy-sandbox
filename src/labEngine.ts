import { defaults, dispatchPower, accumulate, initialState, STEP_HOURS, type Flow, type State, type Event } from './engine';
import { type LabId, labScenarios } from './labScenarios';
export type BatteryCause = 'control' | 'reserve' | 'device';
export type LabState = {
  id: LabId; active: boolean; cause: BatteryCause; communicationDisabled: boolean;
  batteryDisconnected: boolean; telemetryMissing: boolean; evLoad: number;
  exportLimit: number; limitIntent: 'approved' | 'misconfigured'; clock: State;
};
function startSoc(id: LabId, cause: BatteryCause) {
  if(id === 'reserve') return 45;
  if(id === 'battery' && cause === 'reserve') return 25;
  return labScenarios[id].solar ? 100 : defaults.initialSoc;
}
export function initialLab(id: LabId = 'communication', active = true, cause: BatteryCause = 'control'): LabState {
  return {id, active, cause, communicationDisabled:false, batteryDisconnected:false, telemetryMissing:false, evLoad:3, exportLimit:0, limitIntent:'approved', clock:{...initialState(labScenarios[id].solar ? 'negative' : 'evening'), soc:startSoc(id,cause)}};
}
export function calculateLab(state: LabState): Flow & { communicationLost:boolean; controlUnavailable:boolean; batteryUnavailable:boolean; status:string; secondarySolar:number; mainSolar:number; effectiveReserve:number } {
  const {id,active,cause,clock} = state;
  const communicationLost = state.communicationDisabled || active && id === 'communication';
  const rejected = active && (id === 'curtailment' || id === 'firmware');
  const reserve = active && id === 'reserve' ? 60 : active && id === 'battery' && cause === 'reserve' ? 30 : defaults.reserve;
  const isSolar = labScenarios[id].solar;
  const load = 1.5 + (id === 'ev' && active ? state.evLoad : 0);
  const remoteBatteryUnavailable = communicationLost || active && id === 'battery' && cause === 'control';
  const physicalBatteryUnavailable = state.batteryDisconnected || active && id === 'battery' && cause === 'device';
  const f = dispatchPower({solarAvailable:isSolar ? defaults.solarCapacity : 0, load,
    fit:isSolar ? -8 : 35, importPrice:isSolar ? 20 : 55,
    uncontrolledSolar:active && id === 'secondary' ? defaults.solarCapacity / 2 : 0,
    curtailmentAllowed:!communicationLost && !rejected,
    chargeAllowed:!physicalBatteryUnavailable, dischargeAllowed:!physicalBatteryUnavailable,
    requestedBatteryExport:isSolar || remoteBatteryUnavailable ? 0 : 6,
    exportLimit:active && id === 'exportLimit' ? state.exportLimit : defaults.siteExportLimit,
  }, clock.soc, STEP_HOURS, {...defaults,reserve});
  let status = active ? labScenarios[id].category : 'Normal operation';
  if(communicationLost) status = 'Communication unavailable; local mode continues';
  if(state.batteryDisconnected) status = 'Physical battery connection open';
  if(active && id === 'battery' && !state.batteryDisconnected && !communicationLost) status = cause === 'reserve' ? 'Expected reserve restriction' : cause === 'control' ? 'Remote discharge command rejected' : 'Illustrative device discharge lock';
  const explanation = communicationLost ? 'Cloud control is unavailable. The simulated local mode still supplies the home and can charge from solar; remote curtailment and battery exports are unavailable.'
    : state.batteryDisconnected ? 'The battery is physically isolated in this simulation. Solar and grid supply remain available. This is different from losing the software command link.'
    : !active ? 'Normal operation uses solar with negative-FiT curtailment, or stored energy with a favourable export tariff. All model values are integrated over simulation time.'
    : id === 'curtailment' || id === 'firmware' ? 'A curtailment request is made but not executed. Solar remains locally operational; surplus exports incur the illustrative negative feed-in tariff.'
    : id === 'secondary' ? 'The enrolled solar branch can reduce output. The second branch continues generating, so some negative-price exports remain. Battery and household demand are still accounted for.'
    : id === 'reserve' || id === 'battery' && cause === 'reserve' ? `The effective manufacturer reserve is ${reserve}%, higher than the ${defaults.exportFloor}% export floor. Discharge is restricted by the manufacturer setting; this is expected behaviour.`
    : id === 'battery' ? cause === 'control' ? 'The remote export command is unavailable. Local battery self-consumption continues in the assumed fallback mode.' : 'An illustrative device lock prevents battery discharge. Grid imports supply the home; stored energy alone does not prove remote control is available.'
    : id === 'exportLimit' ? `A ${state.exportLimit} kW hard site limit caps net exports. Home supply can continue. This limit is ${state.limitIntent === 'approved' ? 'an intentional approved restriction, not a fault' : 'assumed incorrectly configured for this example; verify the approved setting with an installer'}.`
    : 'EV demand is part of household load. Load-following solar output changes to meet demand while avoiding negative-price exports; charging does not universally disable curtailment.';
  const secondarySolar = id === 'secondary' ? active ? Math.min(defaults.solarCapacity/2,f.solar) : f.solar/2 : 0;
  return {...f, action:status, explanation, remainingForecast:0, exportBudget:Math.max(0, clock.soc/100*defaults.capacity-Math.max(reserve,defaults.exportFloor)/100*defaults.capacity), communicationLost,controlUnavailable:remoteBatteryUnavailable || rejected,batteryUnavailable:physicalBatteryUnavailable,status,secondarySolar,mainSolar:f.solar-secondarySolar,effectiveReserve:reserve};
}
export type LabEvent = {type:'select'; id:LabId} | {type:'mode'; active:boolean} | {type:'resetFault'} | {type:'connection'; connection:'communication'|'battery'} | {type:'cause'; cause:BatteryCause} | {type:'evLoad'; value:number} | {type:'exportLimit'; value:number} | {type:'limitIntent'; value:LabState['limitIntent']} | {type:'telemetry'} | {type:'playback'; event:Event};
export function labReducer(state: LabState, event: LabEvent): LabState {
  if(event.type === 'select') return initialLab(event.id);
  if(event.type === 'mode') return {...initialLab(state.id,event.active,state.cause),evLoad:state.evLoad,exportLimit:state.exportLimit,limitIntent:state.limitIntent};
  if(event.type === 'resetFault') return initialLab(state.id,false,state.cause);
  if(event.type === 'connection') return event.connection === 'communication'
    ? {...state, active:state.id === 'communication' ? !calculateLab(state).communicationLost : state.active, communicationDisabled:state.id === 'communication' ? false : !state.communicationDisabled}
    : {...state,batteryDisconnected:!state.batteryDisconnected};
  if(event.type === 'cause') return initialLab(state.id,state.active,event.cause);
  if(event.type === 'evLoad') return {...state,evLoad:Math.max(0,Math.min(7,event.value))};
  if(event.type === 'exportLimit') return {...state,exportLimit:Math.max(0,Math.min(defaults.siteExportLimit,event.value))};
  if(event.type === 'limitIntent') return {...state,limitIntent:event.value};
  if(event.type === 'telemetry') return {...state,telemetryMissing:!state.telemetryMissing};
  const e=event.event;
  if(e.type === 'reset') return {...state,clock:{...initialState(state.clock.scenario),soc:startSoc(state.id,state.cause)}};
  if(e.type === 'pause') return {...state,clock:{...state.clock,playing:false}};
  if(e.type === 'play') return {...state,clock:{...state.clock,playing:state.clock.minute<defaults.standardDuration}};
  if(e.type === 'speed') return {...state,clock:{...state.clock,speed:state.clock.speed===e.speed ? 1:e.speed}};
  if(e.type !== 'tick' || !state.clock.playing) return state;
  let next=state;
  for(let i=0;i<state.clock.speed && next.clock.playing;i++) next={...next,clock:accumulate(next.clock,calculateLab(next),defaults.standardDuration)};
  return next;
}
