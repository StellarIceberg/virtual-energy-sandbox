import { useEffect, useReducer } from 'react';
import { calculate, defaults, scenarios, durationFor, tariffAt, clockLabel, STEP_HOURS, type ScenarioId } from './engine';
import { eveningTariffs } from './config';
import Diagram from './Diagram';
import { describeController } from './controllerStatus';
import InteractiveLab from './InteractiveLab';
import PlaybackControls from './PlaybackControls';
import {viewReducer,initialView} from './navigation';
export default function App() {
  const [view,dispatch] = useReducer(viewReducer,undefined,initialView);
  const state=view.simulation;
  useEffect(() => {
    if (!state.playing) return;
    const timer = window.setInterval(() => dispatch({type:'simulation',event:{type:'tick'}}),defaults.tickMilliseconds);
    return () => clearInterval(timer);
  }, [state.playing]);
  const flow = calculate(state.scenario,state.soc,STEP_HOURS,defaults,state.minute,state.totals.household);
  const controller = describeController(flow, {soc:state.soc, reserve:defaults.reserve});
  const evening=state.scenario==='evening', total=state.totals;
  const net=total.imported-total.exported;
  const readings = [
    evening ? ['Feed-in tariff',`${flow.fit} c/kWh`,`${clockLabel(state.minute)} · import ${flow.importPrice} c/kWh`] : ['Solar generation',`${flow.solar.toFixed(2)} kW`,`${defaults.solarCapacity} kW available · ${flow.curtailment.toFixed(2)} kW curtailed`],
    ['Household consumption',`${total.household.toFixed(2)} kWh`,`${flow.load.toFixed(2)} kW current load`],
    ['Battery state of charge',`${state.soc.toFixed(1)}%`,`${defaults.capacity} kWh capacity · ${defaults.reserve}% reserve`],
    ['Battery power',`${(flow.charge || flow.discharge).toFixed(2)} kW`,flow.charge>0 ? 'Charging from solar' : flow.discharge>0 ? `Discharging · ${flow.gridDischarge.toFixed(2)} kW to grid` : 'Idle'],
    ['Net grid exchange',`${Math.abs(net).toFixed(2)} kWh`,`${net>1e-8 ? 'Net import' : net < -1e-8 ? 'Net export' : 'Balanced'} · in ${total.imported.toFixed(2)} / out ${total.exported.toFixed(2)} kWh`],
    evening ? ['Remaining household forecast',`${flow.remainingForecast.toFixed(2)} kWh`,`Protected future demand · ${defaults.forecastDemand} kWh initially`] : ['Feed-in tariff',`${flow.fit>0 ? '+' : '−'}${Math.abs(flow.fit)} c/kWh`,'Illustrative price · held constant'],
  ];
  return <main className="mx-auto max-w-[1440px] px-4 py-8 md:px-10 md:py-12">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><div className="eyebrow">ENERGY, MADE VISIBLE</div><h1>Virtual Energy Sandbox</h1><p className="intro">Follow the power. See how solar, storage and automation work together.</p></div><span className="demo-tag">● Independent educational demo</span></header>
    <section aria-label="Choose a scenario" className="scenario-grid mt-8">
      {(Object.keys(scenarios) as ScenarioId[]).map((id,i)=><button key={id} className={`scenario-button ${view.tab===id ? 'selected' : ''}`} aria-pressed={view.tab===id} onClick={()=>dispatch({type:'tab',tab:id})}><span className="scenario-number">0{i+1}</span><span><strong>{scenarios[id].name}</strong><small>{id==='positive' ? 'Store sunshine, export surplus · +25 c/kWh' : id==='negative' ? 'Use, store and curtail · −8 c/kWh' : 'Protect home demand, optimise exports'}</small></span></button>)}
      <button className={`scenario-button ${view.tab==='lab' ? 'selected' : ''}`} aria-pressed={view.tab==='lab'} onClick={()=>dispatch({type:'tab',tab:'lab'})}><span className="scenario-number">04</span><span><strong>Interactive Lab</strong><small>Explore publicly documented device issues</small></span></button>
    </section>
    {view.tab==='lab' ? <InteractiveLab/> : <div className="dashboard mt-6">
      <section className="panel diagram-panel" aria-label="Energy flow diagram">
        <div className="panel-heading"><div><h2>Your virtual home</h2><p>Live power flows · kW · illustrative large residential system</p></div><span className="status">{state.playing ? 'Running' : state.minute===durationFor(state.scenario) ? 'Complete' : 'Paused'}</span></div>
        <div className="simulation-figure"><PlaybackControls minute={state.minute} duration={durationFor(state.scenario)} playing={state.playing} speed={state.speed} dispatch={event=>dispatch({type:'simulation',event})}/><Diagram controllerStatus={controller.status} flow={flow} soc={state.soc} playing={state.playing}/></div>
        <div className="legend"><span><i className="green-dot"/> Electricity</span><span><i className="blue-dot"/> Grid exchange</span><span><i className="purple-dot"/> Controller commands</span></div>
        {evening && <section className="tariff-strip" aria-label="Predetermined evening tariff schedule"><h3>Illustrative evening feed-in tariff · c/kWh</h3><div>{eveningTariffs.map((t)=><span key={t.minute} className={tariffAt(state.minute).minute===t.minute ? 'current' : ''}><small>{clockLabel(t.minute)}</small><strong>{t.fit}</strong></span>)}</div><p>Separate import schedule: {eveningTariffs.map(t=>t.importPrice).join(' / ')} c/kWh. The {defaults.forecastDemand} kWh forecast is spread over 17:00–24:00.</p></section>}
      </section>
      <aside className="flex flex-col gap-4"><section className="panel controller-panel"><div className="eyebrow">CONTROLLER STATUS</div><h2 aria-live="polite">{controller.status}</h2><p>{controller.explanation}</p><p className="restriction-note"><strong>Energy plan: {flow.action}.</strong> {flow.explanation}</p>{evening && <p className="restriction-note">Export budget remaining: {flow.exportBudget.toFixed(2)} kWh · export floor {defaults.exportFloor}%</p>}</section>
        <section className="readings" aria-label="Live readings">{readings.map(([label,value,note])=><div className="reading" key={label}><h3>{label}</h3><strong>{value}</strong><p>{note}</p></div>)}</section>
      </aside>
    </div>}
    <footer><p>Power balance: generation + discharge + import = consumption + charge + export. Energy totals integrate kW over simulated hours.</p><p>Idealised lossless system with one 10 kW hybrid inverter and shared AC output limits. Illustrative prices and forecast, no live data or device connections. This independent project does not reproduce Amber Electric’s proprietary SmartShift algorithms.</p><a href="https://github.com/StellarIceberg/virtual-energy-sandbox" target="_blank" rel="noreferrer">View source on GitHub ↗</a></footer>
  </main>;
}
