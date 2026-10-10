import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { calculate, defaults, STEP_HOURS, initialState, reducer } from './engine';
import { calculateLab, initialLab, labReducer } from './labEngine';
import { describeController, CONTROL_CONNECTION_LABEL } from './controllerStatus';
import Diagram from './Diagram';

const normal = (soc: number, minute = 0) => calculate('evening',soc,STEP_HOURS,defaults,minute);
const context = (soc: number) => ({soc,reserve:defaults.reserve});
const labStatus = (state: ReturnType<typeof initialLab>) => {
  const f=calculateLab(state);
  return describeController(f,{soc:state.clock.soc,reserve:f.effectiveReserve,controlUnavailable:f.controlUnavailable,batteryUnavailable:f.batteryUnavailable});
};
describe('controller operating status',()=>{
  it('labels evening local discharge as self-consumption without a remote command',()=>{
    const f=normal(80), snapshot={...f};
    expect(f.homeDischarge).toBeGreaterThan(0);expect(f.gridDischarge).toBe(0);
    const c=describeController(f,context(80));
    expect(c.status).toBe('Self-consumption');expect(c.explanation).toContain('does not require an explicit remote');
    expect(c.explanation).toContain(`${f.homeDischarge.toFixed(2)} kW`);expect(f).toEqual(snapshot);
  });
  it('distinguishes battery exports from local supply and solar exports',()=>{
    const f=normal(80,120);expect(f.gridDischarge).toBeGreaterThan(0);
    expect(describeController(f,context(80)).status).toBe('Dispatching');
    const solar=calculate('positive',100);expect(solar.exportPower).toBeGreaterThan(0);
    expect(describeController(solar,context(100)).status).toBe('Idle');
    expect(describeController(calculate('positive',80),context(80)).status).toBe('Self-consumption');
  });
  it('preserves reserve only when the battery is inactive; imports cover the home',()=>{
    const f=normal(defaults.reserve);
    expect(f.discharge).toBe(0);expect(f.importPower).toBe(f.load);expect(f.nextSoc).toBe(defaults.reserve);
    expect(describeController(f,context(defaults.reserve)).status).toBe('Preserving');
    expect(describeController(normal(26),context(26)).status).toBe('Self-consumption');
  });
  it('reports simulated command faults while acknowledging continuing local supply',()=>{
    for(const state of [{...initialLab('battery',false),communicationDisabled:true},initialLab('battery',true,'control')]) {
      const f=calculateLab(state);expect(f.homeDischarge).toBeGreaterThan(0);expect(f.gridDischarge).toBe(0);
      const c=labStatus(state);expect(c.status).toBe('Control unavailable');expect(c.explanation).toContain(`${f.homeDischarge.toFixed(2)} kW`);
    }
    expect(labStatus(initialLab('communication')).status).toBe('Control unavailable');
    expect(labStatus(initialLab('curtailment')).status).toBe('Control unavailable');
    expect(labStatus(initialLab('firmware')).status).toBe('Control unavailable');
  });
  it('does not classify reserve, export restrictions, physical isolation or telemetry as command faults',()=>{
    expect(labStatus(initialLab('reserve')).status).toBe('Preserving');
    expect(labStatus(initialLab('battery',true,'reserve')).status).toBe('Preserving');
    expect(labStatus(initialLab('exportLimit')).status).toBe('Self-consumption');
    expect(labStatus(initialLab('battery',true,'device')).status).toBe('Idle');
    const normalLab=initialLab('battery',false);
    expect(labStatus({...normalLab,batteryDisconnected:true}).status).toBe('Idle');
    expect(labStatus({...normalLab,telemetryMissing:true}).status).toBe('Dispatching');
  });
  it('updates from actual flows over playback, pause, reset and restored control',()=>{
    let state={...initialState('evening'),playing:true};
    const seen=new Set<string>();
    for(let i=0;i<defaults.eveningDuration;i++) {
      const f=calculate(state.scenario,state.soc,STEP_HOURS,defaults,state.minute,state.totals.household);
      const c=describeController(f,context(state.soc));seen.add(c.status);
      expect(c.status).toBe(f.gridDischarge>1e-8 ? 'Dispatching' : 'Self-consumption');
      state=reducer(state,{type:'tick'});
    }
    expect([...seen].sort()).toEqual(['Dispatching','Self-consumption']);
    expect(state.soc).toBeCloseTo(25,8);
    const reset=reducer(state,{type:'reset'});expect(describeController(normal(reset.soc),context(reset.soc)).status).toBe('Self-consumption');
    expect(reducer(reset,{type:'pause'}).soc).toBe(reset.soc);
    const restored=labReducer(initialLab('communication'),{type:'resetFault'});
    expect(labStatus(restored).status).toBe('Idle');
  });
  it('keeps the connection label permanent and the operating status separate in the diagram',()=>{
    const f=normal(80);
    for(const communicationLost of [false,true]) {
      const status=communicationLost ? 'Control unavailable' : 'Self-consumption';
      const svg=renderToStaticMarkup(<Diagram flow={f} soc={80} playing={false} controllerStatus={status} communicationLost={communicationLost}/>);
      expect(svg).toContain(CONTROL_CONNECTION_LABEL);expect(svg).toContain(`>${status}</text>`);
      expect(svg).not.toContain('Commands · no electricity');
    }
  });
});
