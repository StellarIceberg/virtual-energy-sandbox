import {describe,it,expect} from 'vitest';
import {defaults,calculate,dispatchPower,initialState,reducer,tariffAt,STEP_HOURS,plannedExport,durationFor,type State} from './engine';
import {initialLab,labReducer,calculateLab,type LabState} from './labEngine';
import {labScenarios,sources,type LabId} from './labScenarios';
import {viewReducer,initialView} from './navigation';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import Diagram from './Diagram';
import PlaybackControls from './PlaybackControls';
import InteractiveLab from './InteractiveLab';
function runEvening(speed:2|10|100|1=1,soc=80) {
  let state:State={...initialState('evening'),soc,playing:true};
  if(speed!==1) state=reducer(state,{type:'speed',speed});
  while(state.playing) state=reducer(state,{type:'tick'});
  return state;
}
function balance(f:ReturnType<typeof calculate>) {
  expect(f.solar+f.discharge+f.importPower).toBeCloseTo(f.load+f.charge+f.exportPower,9);
  expect(f.solar+f.curtailment).toBeCloseTo(f.solarAvailable,9);
  expect(f.charge*f.discharge).toBeCloseTo(0,9);
  expect(f.importPower*f.exportPower).toBeCloseTo(0,9);
}
describe('Phase 2 energy and deterministic optimisation',()=>{
  it('uses 40 kWh and 10 kW configuration and labels energy capacity correctly',()=>{
    expect(defaults.capacity).toBe(40);expect(defaults.solarCapacity).toBe(10);
    expect(defaults.chargeLimit).toBe(10);expect(defaults.dischargeLimit).toBe(10);
    const html=renderToStaticMarkup(createElement(Diagram,{controllerStatus:'Self-consumption',flow:calculate('positive',80),soc:80,playing:false}));
    expect(html).toContain('40 kWh');expect(html).not.toContain('40 kW ·');
  });
  it('integrates kW × hours into consumption, import, export and battery energy',()=>{
    let state={...initialState('positive'),playing:true};
    state=reducer(state,{type:'tick'});
    expect(state.totals.household).toBeCloseTo(1.5/60,10);
    expect(state.totals.charged).toBeCloseTo(8.5/60,10);
    expect((state.soc-80)/100*40).toBeCloseTo(state.totals.charged,10);
    state={...initialState('positive'),soc:100,playing:true};state=reducer(state,{type:'tick'});
    expect(state.totals.exported).toBeCloseTo(8.5/60,10);
    const evening=runEvening(100,0);expect(evening.totals.imported).toBeCloseTo(10,9);
    expect(evening.totals.household).toBeCloseTo(10,9);expect(evening.totals.exported).toBe(0);
    expect(reducer(state,{type:'reset'}).totals).toEqual(initialState().totals);
  });
  it('uses separate repeatable import/FiT schedules exactly at tariff transitions',()=>{
    expect(tariffAt(59).fit).toBe(8);expect(tariffAt(60).fit).toBe(18);
    expect(tariffAt(120)).toMatchObject({fit:35,importPrice:55});expect(tariffAt(180).fit).toBe(22);
    expect(tariffAt(360).fit).toBe(5);expect(runEvening(10)).toEqual(runEvening(10));
  });
  it('protects forecast and export floor while prioritising the best price blocks',()=>{
    const initial=calculate('evening',80);expect(initial.exportBudget).toBe(12);expect(initial.gridDischarge).toBe(0);
    // At 18:00 budget is held for 19:00 and 20:00, rather than spent at 18 c/kWh.
    expect(plannedExport(60,80-100/420*60*10/40,10-60*10/420)).toBe(0);
    let state={...initialState('evening'),playing:true};const exportAt:Record<number,number>={};
    while(state.playing){const f=calculate('evening',state.soc,STEP_HOURS,defaults,state.minute,state.totals.household);balance(f);
      expect(f.nextSoc/100*40).toBeGreaterThanOrEqual(Math.min(state.soc/100*40,defaults.reserve/100*40)-1e-8);
      if(f.gridDischarge>0){expect(f.fit).toBeGreaterThan(15);expect(f.nextSoc/100*40).toBeGreaterThanOrEqual(10+f.remainingForecast-f.load/60-1e-8);exportAt[f.fit]=(exportAt[f.fit]??0)+f.gridDischarge/60;}
      state=reducer(state,{type:'tick'});
    }
    expect(exportAt[18]).toBeUndefined();expect(exportAt[35]).toBeCloseTo(10-10/7,8);expect(exportAt[22]).toBeCloseTo(12-(10-10/7),8);
    expect(state.totals.exported).toBeCloseTo(12,8);expect(state.totals.household).toBeCloseTo(10,8);expect(state.soc).toBeCloseTo(25,8);expect(state.totals.imported).toBe(0);
  });
  it('respects export floor separately from household reserve at boundary SoCs',()=>{
    for(const soc of [0,19.99,20,24.99,25,25.01,30,80,100]) {
      const f=dispatchPower({solarAvailable:0,load:0,fit:35,importPrice:55,requestedBatteryExport:10},soc);expect(f.nextSoc).toBeGreaterThanOrEqual(Math.min(soc,25)-1e-9);
      const home=dispatchPower({solarAvailable:0,load:2,fit:35,importPrice:55},soc);expect(home.nextSoc).toBeGreaterThanOrEqual(Math.min(soc,20)-1e-9);
    }
    expect(dispatchPower({solarAvailable:0,load:1,fit:35,importPrice:55},24).homeDischarge).toBe(1);
    expect(dispatchPower({solarAvailable:0,load:1,fit:35,importPrice:55,requestedBatteryExport:6},24).gridDischarge).toBe(0);
    const low=runEvening(100,30);expect(low.totals.exported).toBe(0);expect(low.totals.imported).toBeCloseTo(6,8);
  });
  it('obeys inverter and site constraints with shared battery home/export power',()=>{
    const f=dispatchPower({solarAvailable:0,load:2,fit:35,importPrice:55,requestedBatteryExport:10,exportLimit:3},80,STEP_HOURS,{...defaults,inverterLimit:4});expect(f.discharge).toBe(4);expect(f.gridDischarge).toBe(2);
    const solar=dispatchPower({solarAvailable:10,load:1,fit:25,importPrice:30,exportLimit:0},100);expect(solar.solar).toBe(1);expect(solar.exportPower).toBe(0);
  });
});
describe('playback and navigation',()=>{
  it('supports one selected speed, deselection to 1×, and changes elapsed time',()=>{
    let s=initialState();s=reducer(s,{type:'speed',speed:10});expect(s.speed).toBe(10);
    s=reducer(s,{type:'speed',speed:100});expect(s.speed).toBe(100);
    s=reducer(s,{type:'speed',speed:100});expect(s.speed).toBe(1);
    s=reducer(s,{type:'speed',speed:2});s=reducer(s,{type:'play'});s=reducer(s,{type:'tick'});expect(s.minute).toBe(2);
  });
  it('integrates identical states at 1×, 2×, 10× and 100×, stopping at the horizon',()=>{
    const base=runEvening();for(const speed of [2,10,100] as const){const s=runEvening(speed);expect(s.minute).toBe(durationFor('evening'));expect(s.playing).toBe(false);expect(s.totals).toEqual(base.totals);expect(s.soc).toBe(base.soc);}
  });
  it('toggle control displays one play/pause action and three speed controls',()=>{
    const props={minute:0,duration:300,speed:1 as const,dispatch:()=>{}};
    const paused=renderToStaticMarkup(createElement(PlaybackControls,{...props,playing:false}));const running=renderToStaticMarkup(createElement(PlaybackControls,{...props,playing:true}));
    expect(paused).toContain('Play');expect(paused).not.toContain('Ⅱ Pause');expect(running).toContain('Pause');expect(running).not.toContain('▶ Play');
    expect((paused.match(/Fast forward/g)||[]).length).toBe(3);
  });
  it('pauses when entering the lab and safely resets all original scenarios',()=>{
    let v=initialView();v=viewReducer(v,{type:'simulation',event:{type:'play'}});v=viewReducer(v,{type:'simulation',event:{type:'tick'}});
    v=viewReducer(v,{type:'tab',tab:'lab'});expect(v.simulation.playing).toBe(false);expect(viewReducer(v,{type:'simulation',event:{type:'tick'}})).toEqual(v);
    for(const tab of ['positive','negative','evening'] as const){v=viewReducer(v,{type:'tab',tab});expect(v.simulation).toEqual(initialState(tab));}
  });
});
describe('source-backed fault simulations',()=>{
  it('balances power and storage across scenarios, modes and boundary SoCs',()=>{
    for(const id of Object.keys(labScenarios) as LabId[])for(const active of [true,false])for(const soc of [0,20,24.99,25,45,60,80,99.99,100]){
      const state={...initialLab(id,active),clock:{...initialLab(id,active).clock,soc}};const f=calculateLab(state);balance(f);
      expect(f.nextSoc).toBeLessThanOrEqual(100);expect(f.nextSoc).toBeGreaterThanOrEqual(Math.min(soc,f.effectiveReserve)-1e-8);expect(f.discharge).toBeLessThanOrEqual(10);
    }
  });
  it('keeps local operation and physical accounting during communication loss',()=>{
    let state=initialLab('communication');state.clock.soc=80;const f=calculateLab(state);expect(f.communicationLost).toBe(true);expect(f.solar).toBe(10);expect(f.charge).toBe(8.5);expect(f.load).toBe(1.5);
    state=labReducer(state,{type:'telemetry'});expect(state.telemetryMissing).toBe(true);expect(calculateLab(state)).toEqual(f);
    state=labReducer(state,{type:'connection',connection:'communication'});expect(calculateLab(state).communicationLost).toBe(false);
    state=labReducer(state,{type:'connection',connection:'battery'});expect(calculateLab(state).charge).toBe(0);
    state=labReducer(state,{type:'resetFault'});expect(state.active).toBe(false);expect(state.batteryDisconnected).toBe(false);expect(state.telemetryMissing).toBe(false);
  });
  it('accounts for negative-FiT exports when a curtailment command is not executed',()=>{
    let state=initialLab('curtailment');expect(calculateLab(state).exportPower).toBe(8.5);
    state=labReducer(state,{type:'playback',event:{type:'play'}});state=labReducer(state,{type:'playback',event:{type:'tick'}});
    expect(state.clock.totals.exported).toBeCloseTo(8.5/60,10);expect(state.clock.totals.exportValue).toBeCloseTo(-8.5/60*.08,10);
    state=labReducer(state,{type:'resetFault'});expect(calculateLab(state).exportPower).toBe(0);expect(calculateLab(state).curtailment).toBe(8.5);
  });
  it('distinguishes reserve, remote command failure and local device lock',()=>{
    let state=initialLab('battery');const control=calculateLab(state);expect(control.gridDischarge).toBe(0);expect(control.homeDischarge).toBe(1.5);
    state=labReducer(state,{type:'cause',cause:'reserve'});const reserve=calculateLab(state);expect(reserve.status).toContain('Expected');expect(reserve.discharge).toBe(0);
    state=labReducer(state,{type:'cause',cause:'device'});expect(calculateLab(state).discharge).toBe(0);expect(calculateLab(state).importPower).toBe(1.5);
    state=labReducer(state,{type:'resetFault'});expect(calculateLab(state).gridDischarge).toBe(6);
  });
  it('applies site export limits and preserves household battery supply',()=>{
    let state=initialLab('exportLimit');expect(calculateLab(state).exportPower).toBe(0);expect(calculateLab(state).homeDischarge).toBe(1.5);
    state=labReducer(state,{type:'exportLimit',value:2});expect(calculateLab(state).exportPower).toBe(2);
    state=labReducer(state,{type:'limitIntent',value:'misconfigured'});expect(calculateLab(state).explanation).toContain('incorrectly');
    state=labReducer(state,{type:'resetFault'});expect(calculateLab(state).exportPower).toBe(6);
  });
  it('curtails only the enrolled solar branch and conditionally renders a second inverter',()=>{
    const state=initialLab('secondary'), f=calculateLab(state);expect(f.secondarySolar).toBe(5);expect(f.mainSolar).toBe(0);expect(f.exportPower).toBe(3.5);expect(f.curtailment).toBe(5);
    const normal=calculateLab(labReducer(state,{type:'mode',active:false}));expect(normal.exportPower).toBe(0);expect(normal.solar).toBe(1.5);
    const html=renderToStaticMarkup(createElement(Diagram,{controllerStatus:'Idle',flow:f,soc:100,playing:false,showSecondary:true,secondarySolar:f.secondarySolar}));expect(html).toContain('SECOND SOLAR INVERTER');
    expect(renderToStaticMarkup(createElement(Diagram,{controllerStatus:'Idle',flow:f,soc:100,playing:false}))).not.toContain('SECOND SOLAR INVERTER');
  });
  it('treats reserve conflicts and EV load-following as expected behaviour',()=>{
    const reserve=calculateLab(initialLab('reserve'));expect(reserve.effectiveReserve).toBe(60);expect(reserve.discharge).toBe(0);expect(reserve.status).toContain('Expected');
    let state=initialLab('ev');const original=calculateLab(state);state=labReducer(state,{type:'evLoad',value:7});const ev=calculateLab(state);expect(ev.solar).toBe(8.5);expect(ev.exportPower).toBe(0);expect(ev.load).toBeGreaterThan(original.load);
  });
  it('restores every scenario and integrates lab playback at 100×',()=>{
    for(const id of Object.keys(labScenarios) as LabId[]){let s=initialLab(id);s=labReducer(s,{type:'playback',event:{type:'play'}});s=labReducer(s,{type:'playback',event:{type:'speed',speed:100}});s=labReducer(s,{type:'playback',event:{type:'tick'}});expect(s.clock.minute).toBe(100);expect(s.clock.totals.household).toBeGreaterThan(0);expect(labReducer(s,{type:'resetFault'}).active).toBe(false);}
  });
  it('uses the verified public article IDs and shows sources plus assumption labels',()=>{
    const ids=['26313725905037','35294215672845','26733365644045','38919749770125','40457118061453','20248505808781','38980157821197','35922375367181'];
    Object.values(sources).forEach((s,i)=>{expect(s.url).toMatch(/^https:\/\/help\.amber\.com\.au\/hc\/en-us\/articles\//);expect(s.url).toContain(ids[i]);});
    for(const s of Object.values(labScenarios)){expect(s.sources.length).toBeGreaterThan(0);for(const id of s.sources)expect(sources[id]).toBeDefined();expect(s.assumption.length).toBeGreaterThan(0);}
    const html=renderToStaticMarkup(createElement(InteractiveLab));expect(html).toContain('Sources &amp; References');expect(html).toContain('Simulation assumption');expect(html).toContain('View public documentation');expect(html).toContain('target="_blank"');
  });
});
