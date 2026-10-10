import { describe, expect, it } from 'vitest';
import { calculate, defaults, initialState, reducer, scenarios, DURATION_MINUTES, type ScenarioId } from './engine';
const ids = Object.keys(scenarios) as ScenarioId[];
describe('energy dispatch', () => {
  it('balances power and respects limits across every SoC and scenario', () => {
    for (const id of ids) for (let soc = 0; soc <= 100; soc += .25) {
      const f = calculate(id, soc);
      expect(f.solar+f.discharge+f.importPower).toBeCloseTo(f.load+f.charge+f.exportPower, 10);
      expect(f.solar+f.curtailment).toBeCloseTo(scenarios[id].solar, 10);
      expect(f.charge).toBeLessThanOrEqual(10); expect(f.discharge).toBeLessThanOrEqual(10);
      expect(f.charge*f.discharge).toBe(0); expect(f.importPower*f.exportPower).toBe(0);
      expect(f.nextSoc).toBeGreaterThanOrEqual(Math.min(soc, defaults.reserve)); expect(f.nextSoc).toBeLessThanOrEqual(100);
    }
  });
  it('charges then exports when the battery becomes full at positive FiT', () => {
    let soc = 80;
    for(let i=0;i<60;i++) soc = calculate('positive',soc).nextSoc;
    expect(soc).toBe(100);
    const f = calculate('positive',soc); expect(f.charge).toBe(0); expect(f.exportPower).toBe(8.5);
  });
  it('charges then curtails when the battery becomes full at negative FiT', () => {
    expect(calculate('negative',80).charge).toBe(8.5);
    const f = calculate('negative',100);
    expect(f.solar).toBe(1.5); expect(f.curtailment).toBe(8.5); expect(f.exportPower).toBe(0);
  });
  it('stops exactly at reserve then imports', () => {
    let soc=80;
    for(let i=0;i<1100;i++) soc=calculate('evening',soc).nextSoc;
    expect(soc).toBeCloseTo(20,10);
    const f=calculate('evening',soc); expect(f.discharge).toBeCloseTo(0,10); expect(f.importPower).toBeCloseTo(scenarios.evening.load,10);
  });
  it('limits battery power and hybrid inverter output', () => {
    expect(calculate('positive',80,1/60,{...defaults,chargeLimit:1}).charge).toBe(1);
    const f=calculate('negative',80,1/60,{...defaults,batteryPortLimit:1,solarInputLimit:3,inverterLimit:3});
    expect(f.charge).toBe(1); expect(f.solar).toBe(2.5); expect(f.curtailment).toBe(7.5);
    const evening=calculate('evening',80,1/60,{...defaults,dischargeLimit:.5});
    expect(evening.discharge).toBe(.5); expect(evening.importPower).toBeCloseTo(scenarios.evening.load-.5,10);
  });
  it('caps energy at full and reserve within the last timestep', () => {
    expect(calculate('positive',99.99).nextSoc).toBe(100);
    expect(calculate('evening',20.01).nextSoc).toBeCloseTo(20,10);
  });
  it('rejects invalid time and configuration', () => {
    expect(()=>calculate('positive',80,0)).toThrow();
    expect(()=>calculate('positive',NaN)).toThrow();
    expect(()=>calculate('positive',80,1,{...defaults,capacity:0})).toThrow();
  });
});
describe('simulation controls', () => {
  it('resets every scenario transition and pauses', () => {
    for(const from of ids) for(const to of ids) {
      const state={...initialState(from),soc:35,minute:100,playing:true};
      expect(reducer(state,{type:'scenario',scenario:to})).toEqual(initialState(to));
    }
  });
  it('plays, advances, pauses, resets and stops at five hours', () => {
    let state=initialState('positive'); expect(reducer(state,{type:'tick'})).toEqual(state);
    state=reducer(state,{type:'play'}); state=reducer(state,{type:'tick'});
    expect(state.minute).toBe(1); expect(state.soc).toBeGreaterThan(80);
    state=reducer(state,{type:'pause'}); expect(reducer(state,{type:'tick'})).toEqual(state);
    expect(reducer(state,{type:'reset'})).toEqual(initialState('positive'));
    state=reducer(state,{type:'play'});
    for(let i=state.minute;i<DURATION_MINUTES;i++) state=reducer(state,{type:'tick'});
    expect(state.minute).toBe(300); expect(state.playing).toBe(false); expect(reducer(state,{type:'play'}).playing).toBe(false);
  });
});
