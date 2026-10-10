import { useEffect, useReducer, useState } from 'react';
import { calculate, reducer, initialState, scenarios, DURATION_MINUTES, type ScenarioId } from './engine';
import Diagram from './Diagram';
import InteractiveLab from './InteractiveLab';
import PlaybackControls from './PlaybackControls';
export default function App() {
  const [activeTab, setActiveTab] = useState<ScenarioId | 'lab'>('positive');
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState());
  useEffect(() => { if (!state.playing) return; const timer = window.setInterval(() => dispatch({ type: 'tick' }), 200); return () => clearInterval(timer); }, [state.playing]);
  const flow = calculate(state.scenario, state.soc);
  const scenario = scenarios[state.scenario];
  const readings = [
    ['Solar generation', `${flow.solar.toFixed(2)} kW`, `${scenario.solar} kW available · ${flow.curtailment.toFixed(2)} kW curtailed`],
    ['Household consumption', `${flow.load.toFixed(2)} kW`, 'Constant demonstration load'],
    ['Battery state of charge', `${state.soc.toFixed(1)}%`, '13.5 kWh capacity · 20% reserve'],
    ['Battery power', `${(flow.charge || flow.discharge).toFixed(2)} kW`, flow.charge > 0 ? 'Charging from solar' : flow.discharge > 0 ? 'Discharging to home' : 'Idle'],
    ['Grid exchange', `${(flow.importPower || flow.exportPower).toFixed(2)} kW`, flow.importPower > 0 ? 'Importing' : flow.exportPower > 0 ? 'Exporting' : 'No import or export'],
    [state.scenario === 'evening' ? 'Grid import price' : 'Feed-in tariff', `${state.scenario === 'evening' ? scenario.importPrice : scenario.fit > 0 ? '+'+scenario.fit : '−'+Math.abs(scenario.fit)} c/kWh`, 'Illustrative price · held constant'],
  ];
  return <main className="mx-auto max-w-[1440px] px-4 py-8 md:px-10 md:py-12">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><div className="eyebrow">ENERGY, MADE VISIBLE</div><h1>Virtual Energy Sandbox</h1><p className="intro">Follow the power. See how solar, storage and automation work together.</p></div><span className="demo-tag">● Independent educational demo</span></header>
    <section aria-label="Choose a scenario" className="scenario-grid mt-8">{(Object.keys(scenarios) as ScenarioId[]).map((id, i) => <button key={id} className={`scenario-button ${activeTab === id ? 'selected' : ''}`} aria-pressed={activeTab === id} onClick={() => { setActiveTab(id); dispatch({ type:'scenario', scenario:id }); }}><span className="scenario-number">0{i+1}</span><span><strong>{scenarios[id].name}</strong><small>{id === 'positive' ? 'Store sunshine, export surplus · +25 c/kWh' : id === 'negative' ? 'Use, store and curtail · −8 c/kWh' : 'Use stored energy · 40 c/kWh import'}</small></span></button>)}<button className={`scenario-button ${activeTab === 'lab' ? 'selected' : ''}`} aria-pressed={activeTab === 'lab'} onClick={() => { setActiveTab('lab'); dispatch({type:'pause'}); }}><span className="scenario-number">04</span><span><strong>Interactive Lab</strong><small>Interactive device troubleshooting · coming soon</small></span></button></section>
    {activeTab === 'lab' ? <InteractiveLab /> : <div className="dashboard mt-6"><section className="panel diagram-panel" aria-label="Energy flow diagram"><div className="panel-heading"><div><h2>Your virtual home</h2><p>Live power flows · kW</p></div><span className="status">{state.playing ? 'Running' : state.minute === DURATION_MINUTES ? 'Complete' : 'Paused'}</span></div><div className="simulation-figure"><PlaybackControls minute={state.minute} playing={state.playing} dispatch={dispatch}/><Diagram flow={flow} soc={state.soc} playing={state.playing}/></div><div className="legend"><span><i className="green-dot"/> Electricity</span><span><i className="blue-dot"/> Grid exchange</span><span><i className="purple-dot"/> Controller commands</span></div></section>
    <aside className="flex flex-col gap-4"><section className="panel controller-panel"><div className="eyebrow">CONTROLLER DECISION</div><h2 aria-live="polite">{flow.action}</h2><p>{flow.explanation}</p></section><section className="readings" aria-label="Live readings">{readings.map(([label,value,note]) => <div className="reading" key={label}><h3>{label}</h3><strong>{value}</strong><p>{note}</p></div>)}</section></aside></div>}
    <footer><p>Power balance: generation + discharge + import = consumption + charge + export.</p><p>Idealised, lossless AC-coupled system with separate solar and battery inverter limits. No live prices or device connections. This independent project does not reproduce Amber Electric’s proprietary SmartShift algorithms.</p><a href="https://github.com/StellarIceberg/virtual-energy-sandbox" target="_blank" rel="noreferrer">View source on GitHub ↗</a></footer>
  </main>;
}
