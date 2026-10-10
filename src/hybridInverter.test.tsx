import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {dispatchPower,defaults,calculate,STEP_HOURS,plannedExport} from './engine';
import {initialLab,calculateLab} from './labEngine';
import Diagram from './Diagram';
const input=(solarAvailable:number,load:number)=>({solarAvailable,load,fit:35,importPrice:55,requestedBatteryExport:10});
describe('one hybrid inverter',()=>{
  it('shares the AC output rating between solar and battery exports',()=>{
    const full=dispatchPower(input(10,2),100);expect(full.inverterPower).toBe(10);expect(full.discharge).toBe(0);
    const partial=dispatchPower(input(6,2),100);expect(partial.discharge).toBe(4);expect(partial.inverterPower).toBe(10);expect(partial.exportPower).toBe(8);
  });
  it('allows simultaneous solar and battery home supply within the shared rating',()=>{
    const f=dispatchPower(input(4,8),80);expect(f.homeDischarge).toBe(4);expect(f.gridDischarge).toBe(2);expect(f.inverterPower).toBe(10);
    const overloaded=dispatchPower(input(6,12),80);expect(overloaded.homeDischarge).toBe(4);expect(overloaded.importPower).toBe(2);expect(overloaded.gridDischarge).toBe(0);
  });
  it('keeps DC charging independent of the AC bridge headroom',()=>{
    const f=dispatchPower(input(10,1.5),80,STEP_HOURS,{...defaults,inverterLimit:5});
    expect(f.solar).toBe(10);expect(f.charge).toBe(8.5);expect(f.inverterPower).toBe(1.5);
    const concurrent=dispatchPower(input(15,5),80,STEP_HOURS,{...defaults,solarInputLimit:15});
    expect(concurrent.charge).toBe(10);expect(concurrent.solar).toBe(15);expect(concurrent.inverterPower).toBe(5);
  });
  it('accounts for charging and grid bypass when load exceeds AC conversion capacity',()=>{
    const f=dispatchPower(input(10,8),80,STEP_HOURS,{...defaults,inverterLimit:5});
    expect(f.charge).toBe(2);expect(f.solar).toBe(7);expect(f.inverterPower).toBe(5);expect(f.importPower).toBe(3);expect(f.discharge).toBe(0);
    expect(f.solar+f.importPower).toBe(f.load+f.charge);
  });
  it('respects both conversion directions in the explicitly alternate secondary-solar lab',()=>{
    const secondary=calculateLab(initialLab('secondary'));expect(secondary.externalSolar).toBe(5);expect(secondary.inverterPower).toBe(0);
    const f=dispatchPower({...input(10,0),externalSolarAvailable:10},80,STEP_HOURS,{...defaults,inverterLimit:3});
    expect(f.charge).toBe(3);expect(f.inverterPower).toBe(-3);expect(f.exportPower).toBe(7);
  });
  it('balances flows, storage and limits across rating, load, solar, SoC and tariff boundaries',()=>{
    for(const inverterLimit of [0,3,10])for(const solarAvailable of [0,4,10,15])for(const load of [0,2,8,15])for(const soc of [0,20,25,80,100])for(const fit of [-8,35]){
      const f=dispatchPower({...input(solarAvailable,load),fit},soc,STEP_HOURS,{...defaults,inverterLimit,solarInputLimit:15});
      expect(Math.abs(f.inverterPower)).toBeLessThanOrEqual(inverterLimit+1e-8);
      expect(f.solar+f.discharge+f.importPower).toBeCloseTo(f.load+f.charge+f.exportPower,9);
      expect(f.solar+f.curtailment).toBeCloseTo(solarAvailable,9);expect(f.charge*f.discharge).toBe(0);expect(f.importPower*f.exportPower).toBe(0);
      expect(f.nextSoc).toBeGreaterThanOrEqual(Math.min(soc,20)-1e-8);expect(f.nextSoc).toBeLessThanOrEqual(100);
      expect((f.nextSoc-soc)/100*defaults.capacity).toBeCloseTo((f.charge-f.discharge)*STEP_HOURS,9);
    }
  });
  it('uses the shared limit in the evening export plan and exact diagram labels',()=>{
    const c={...defaults,inverterLimit:3};expect(plannedExport(120,100,0,c)).toBeLessThanOrEqual(3-defaults.forecastDemand/7);
    const html=renderToStaticMarkup(<Diagram flow={calculate('positive',80)} soc={80} playing={false} controllerStatus="Self-consumption"/>);
    for(const label of ['HYBRID INVERTER','10 kW rated power','BATTERY','40 kWh capacity · 80.0%','SOLAR PANELS','10 kW solar array'])expect(html).toContain(label);
    expect(html).not.toContain('Solar 10 kW · battery 10 kW');expect(html).not.toContain('INVERTERS');
  });
});
