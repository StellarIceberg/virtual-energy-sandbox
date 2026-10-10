import { useEffect, useReducer } from 'react';
import Diagram from './Diagram';
import { describeController } from './controllerStatus';
import PlaybackControls from './PlaybackControls';
import { defaults } from './engine';
import { labReducer, initialLab, calculateLab, type BatteryCause } from './labEngine';
import { labScenarios, sources, type LabId } from './labScenarios';
export default function InteractiveLab() {
  const [state,dispatch] = useReducer(labReducer,undefined,()=>initialLab());
  useEffect(()=>{if(!state.clock.playing) return; const timer=window.setInterval(()=>dispatch({type:'playback',event:{type:'tick'}}),defaults.tickMilliseconds);return ()=>clearInterval(timer);},[state.clock.playing]);
  const f=calculateLab(state), s=labScenarios[state.id], t=state.clock.totals;
  const controller = describeController(f, {soc:state.clock.soc, reserve:f.effectiveReserve, controlUnavailable:f.controlUnavailable, batteryUnavailable:f.batteryUnavailable});
  const net=t.imported-t.exported;
  return <section className="mt-6" aria-labelledby="lab-heading">
    <div className="lab-intro"><div><h2 id="lab-heading">Interactive Lab</h2><p>Compare normal operation with a simulated restriction. Click the violet command link or battery connection to inspect the difference.</p></div><span className="demo-tag">Educational assumptions · no real devices</span></div>
    <div className="dashboard lab-dashboard mt-4">
      <div><section className="panel diagram-panel"><div className="panel-heading"><div><h2>Explore the system</h2><p>Model values · kW · software and electricity are separate</p></div><span className={`status ${state.active ? 'issue-status' : ''}`}>{state.active ? 'Scenario active' : 'Normal'}</span></div>
        <div className="simulation-figure"><PlaybackControls minute={state.clock.minute} duration={defaults.standardDuration} playing={state.clock.playing} speed={state.clock.speed} dispatch={event=>dispatch({type:'playback',event})}/>
          <Diagram controllerStatus={controller.status} flow={f} soc={state.clock.soc} playing={state.clock.playing} communicationLost={f.communicationLost} batteryDisconnected={state.batteryDisconnected} commandRejected={state.active && (state.id === 'curtailment' || state.id === 'firmware' || state.id === 'battery' && state.cause === 'control')} secondarySolar={f.secondarySolar} showSecondary={state.id === 'secondary'} onConnection={connection=>dispatch({type:'connection',connection})}/>
        </div>
        <div className="legend"><span><i className="green-dot"/> Electricity</span><span><i className="purple-dot"/> Commands</span><span><i className="amber-dot"/> Not executed</span><span><i className="red-dot"/> Link unavailable</span></div>
        <div className="connection-buttons"><button onClick={()=>dispatch({type:'connection',connection:'communication'})}>{f.communicationLost ? 'Restore' : 'Disable'} communication</button><button onClick={()=>dispatch({type:'connection',connection:'battery'})}>{state.batteryDisconnected ? 'Restore' : 'Open'} physical battery connection</button></div>
        {state.telemetryMissing && <p className="telemetry-note">Reported device telemetry: unavailable / delayed (simulated). Diagram values are model ground truth; electricity and meter accounting continue.</p>}
      </section>
      <section className="readings lab-readings mt-4" aria-label="Lab energy readings">{[
        ['Solar',`${f.solar.toFixed(2)} kW`,`${f.curtailment.toFixed(2)} kW curtailed`],
        ['Home energy',`${t.household.toFixed(2)} kWh`,`${f.load.toFixed(2)} kW now`],
        ['Battery',`${state.clock.soc.toFixed(1)}%`,`${(f.charge || f.discharge).toFixed(2)} kW ${f.charge > 0 ? 'charging' : f.discharge > 0 ? 'discharging' : 'idle'}`],
        ['Net grid energy',`${Math.abs(net).toFixed(2)} kWh`,`${net > 1e-8 ? 'Net import' : net < -1e-8 ? 'Net export' : 'Balanced'} · ${f.exportPower > 0 ? f.exportPower.toFixed(2)+' kW export' : f.importPower.toFixed(2)+' kW import'}`],
        ['Export price',`${f.fit} c/kWh`,'Illustrative constant lab tariff'],
        [t.exportValue < 0 ? 'Export charges' : 'Export earnings',`$${Math.abs(t.exportValue).toFixed(2)}`,'Export kWh × tariff, integrated'],
      ].map(([label,value,note])=><div className="reading" key={label}><h3>{label}</h3><strong>{value}</strong><p>{note}</p></div>)}</section>
      </div>
      <aside className="lab-sidebar flex flex-col gap-4"><section className="panel lab-settings">
        <label htmlFor="fault-select">Troubleshooting scenario</label><select id="fault-select" value={state.id} onChange={e=>dispatch({type:'select',id:e.target.value as LabId})}>{(Object.keys(labScenarios) as LabId[]).map(id=><option key={id} value={id}>{labScenarios[id].name}</option>)}</select>
        <div className="comparison-buttons"><button aria-pressed={!state.active} onClick={()=>dispatch({type:'mode',active:false})}>Normal</button><button aria-pressed={state.active} onClick={()=>dispatch({type:'mode',active:true})}>Scenario active</button></div>
        <p className="comparison-note">Comparisons restart the clock and energy totals.</p>
        <button className="reset-fault" onClick={()=>dispatch({type:'resetFault'})}>↺ Reset Fault / restore normal</button>
        {state.id === 'battery' && <><label htmlFor="battery-cause">Inspect discharge restriction</label><select id="battery-cause" value={state.cause} onChange={e=>dispatch({type:'cause',cause:e.target.value as BatteryCause})}><option value="control">Remote export control unavailable</option><option value="reserve">Manufacturer reserve (expected)</option><option value="device">Illustrative device discharge lock</option></select></>}
        {state.id === 'exportLimit' && <><label htmlFor="export-limit">Site export limit: {state.exportLimit} kW</label><input id="export-limit" type="range" min="0" max={defaults.siteExportLimit} step=".5" value={state.exportLimit} onChange={e=>dispatch({type:'exportLimit',value:Number(e.target.value)})}/><label htmlFor="limit-intent">Interpret this limit</label><select id="limit-intent" value={state.limitIntent} onChange={e=>dispatch({type:'limitIntent',value:e.target.value as typeof state.limitIntent})}><option value="approved">Approved network restriction</option><option value="misconfigured">Illustrative incorrect setting</option></select></>}
        {state.id === 'ev' && <><label htmlFor="ev-load">Illustrative EV demand: {state.evLoad} kW</label><input id="ev-load" type="range" min="0" max="7" step=".5" value={state.evLoad} onChange={e=>dispatch({type:'evLoad',value:Number(e.target.value)})}/></>}
        {state.id === 'communication' && <label className="checkbox-label"><input type="checkbox" checked={state.telemetryMissing} onChange={()=>dispatch({type:'telemetry'})}/> Simulate delayed / missing telemetry</label>}
      </section><section className="panel controller-panel"><div className="eyebrow">CONTROLLER STATUS</div><h2 aria-live="polite">{controller.status}</h2><p>{controller.explanation}</p><p className="restriction-note"><strong>Diagnostic: {f.status}.</strong> {f.explanation}</p><p className="restriction-note">Manufacturer reserve: {f.effectiveReserve}% · export floor: {defaults.exportFloor}% · site limit: {f.exportLimit} kW</p></section>
      <section className="panel lab-details"><h3>Reported symptom</h3><p>{s.symptom}</p><h3>Publicly documented context</h3><p>{s.support}</p><h3>Simulation assumption</h3><p>{s.assumption}</p><h3>Suggested checks</h3><ul>{s.checks.map(check=><li key={check}>{check}</li>)}</ul><div className="source-links"><p>Source: Amber Electric Help Centre</p>{s.sources.map(id=><a key={id} href={sources[id].url} target="_blank" rel="noreferrer">View public documentation: {sources[id].title} ↗</a>)}</div></section></aside>
    </div>
    <details className="panel lab-sources mt-5"><summary>Sources &amp; References</summary><p>Public articles checked 10 October 2026. Status information changes; these simulations are examples, not current incident reports.</p><ul>{Object.values(sources).map(source=><li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a></li>)}</ul></details>
    <p className="independence-note">Independent educational simulation. No affiliation, endorsement or official certification from Amber Electric. Local fallback modes and device constraints are assumptions unless stated otherwise.</p>
  </section>;
}
