import type { Flow } from './engine';
const kw = (value: number) => `${value.toFixed(2)} kW`;
function Wire({ path, power, color = 'green', playing }: { path: string; power: number; color?: string; playing: boolean }) {
  return <g><path d={path} className="wire-base"/><path d={path} className={`wire ${power > 0.000001 ? color : 'inactive'} ${playing && power > 0.000001 ? 'moving' : ''}`} markerEnd={power > 0.000001 ? `url(#arrow-${color})` : undefined}/></g>;
}
function Label({ x, y, name, value }: { x: number; y: number; name: string; value: string }) {
  return <g textAnchor="middle"><text x={x} y={y} className="node-name">{name}</text><text x={x} y={y+23} className="node-value">{value}</text></g>;
}
export default function Diagram({ flow: f, soc, playing }: { flow: Flow; soc: number; playing: boolean }) {
  const batteryCharging = f.charge > 0;
  const gridImporting = f.importPower > 0;
  return <svg viewBox="0 0 1080 630" role="img" aria-labelledby="diagram-title diagram-desc">
    <title id="diagram-title">Residential energy flow</title><desc id="diagram-desc">Solar {kw(f.solar)}; battery charging {kw(f.charge)}, discharging {kw(f.discharge)}; house {kw(f.load)}; grid import {kw(f.importPower)}, export {kw(f.exportPower)}. Dashed violet connection carries controller commands.</desc>
    <defs>{['green','gold','blue'].map(c => <marker key={c} id={`arrow-${c}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" className={`arrow-${c}`}/></marker>)}<pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#dce6e0"/></pattern></defs>
    <rect width="1080" height="630" rx="18" fill="url(#dots)"/>
    <Wire path="M420 180V269" power={f.solar} color="gold" playing={playing}/>
    <Wire path={batteryCharging ? 'M360 330H219' : 'M220 330H360'} power={f.charge+f.discharge} playing={playing}/>
    <Wire path={gridImporting ? 'M680 330H481' : 'M480 330H679'} power={Math.abs(f.solar+f.discharge-f.charge)} playing={playing}/>
    <Wire path="M750 330H881" power={f.load} playing={playing}/>
    <Wire path={gridImporting ? 'M715 476V381' : 'M715 382V475'} power={f.importPower+f.exportPower} color="blue" playing={playing}/>
    <path d="M420 479V391" className={`command ${playing ? 'moving' : ''}`}/><path d="M415 402L420 391L425 402" fill="none" stroke="#8b70ca" strokeWidth="3"/>
    <g transform="translate(340 69)"><path d="M20 0H180L150 95H-10Z" fill="#244c5b" stroke="#15372e" strokeWidth="3"/><path d="M10 31H170M0 63H160M58 0L28 95M99 0L69 95M140 0L110 95" stroke="#80afba" strokeWidth="2"/><path d="M64 95V109M38 109H90" stroke="#4f6a61" strokeWidth="5"/></g>
    <Label x={420} y={40} name="SOLAR ARRAY" value={`${kw(f.solar)} generated`}/>
    <g transform="translate(116 265)"><rect x="25" y="-9" width="40" height="10" rx="3" fill="#527466"/><rect width="104" height="122" rx="17" fill="#fff" stroke="#bfd1c7" strokeWidth="3"/><rect x="17" y="23" width="70" height="71" rx="8" fill="#e9f2e9"/><rect x="17" y={94-soc*.71} width="70" height={soc*.71} rx="8" fill="#4da77c"/><path d="M56 36L41 62H55L48 82L67 55H54Z" fill="white"/></g>
    <Label x={168} y={424} name="BATTERY" value={`${soc.toFixed(1)}% · ${batteryCharging ? 'charging' : f.discharge > 0 ? 'discharging' : 'idle'}`}/>
    <g transform="translate(360 270)"><rect width="120" height="120" rx="19" fill="#fff" stroke="#bfd1c7" strokeWidth="3"/><rect x="19" y="20" width="82" height="38" rx="6" fill="#15372e"/><path d="M29 41Q39 24 49 41T69 41T89 41" fill="none" stroke="#99d8b5" strokeWidth="3"/><path d="M33 73L23 94H36L31 107L47 85H34Z" fill="#e6ac40"/><path d="M63 80H99M63 90H99M63 100H85" stroke="#bfd1c7" strokeWidth="4"/></g>
    <Label x={420} y={424} name="INVERTERS" value="Solar 6 kW · battery 5 kW"/>
    <g transform="translate(680 270)"><rect width="70" height="112" rx="13" fill="#fff" stroke="#bfd1c7" strokeWidth="3"/><rect x="10" y="20" width="50" height="39" rx="5" fill="#e1eadb"/><text x="35" y="45" textAnchor="middle" fontSize="12" fill="#15372e">{(f.importPower-f.exportPower).toFixed(2)}</text><circle cx="20" cy="80" r="4" fill="#4da77c"/><path d="M32 79H57M15 96H56" stroke="#bfd1c7" strokeWidth="3"/></g>
    <Label x={715} y={234} name="SMART METER" value="Net grid exchange"/>
    <g transform="translate(880 263)"><path d="M0 53L67-6L134 53" fill="#f2e4c6" stroke="#bc7558" strokeWidth="9" strokeLinejoin="round"/><path d="M13 48V127H120V48" fill="#f2e4c6"/><rect x="28" y="72" width="30" height="55" rx="4" fill="#bc7558"/><rect x="74" y="68" width="29" height="29" rx="4" fill="#90bcc2"/><circle cx="67" cy="31" r="10" fill="#90bcc2"/></g>
    <Label x={947} y={424} name="HOME" value={kw(f.load)}/>
    <g transform="translate(372 485)"><rect width="96" height="54" rx="12" fill="#8b70ca"/><circle cx="18" cy="18" r="4" fill="#e9e2fa"/><circle cx="18" cy="36" r="4" fill="#e9e2fa"/><path d="M34 18H77M34 36H77" stroke="#e9e2fa" strokeWidth="4"/></g>
    <Label x={420} y={570} name="AUTOMATION CONTROLLER" value="Commands · no electricity"/>
    <g transform="translate(670 483)" stroke="#537a92" strokeWidth="6" fill="none"><path d="M45 0L10 83M45 0L80 83M31 33H59M21 57H69M10 83H80M14 10H76M3 25H87M14 10V0M76 10V0"/></g>
    <Label x={715} y={598} name="GRID" value={gridImporting ? `${kw(f.importPower)} importing` : `${kw(f.exportPower)} exporting`}/>
  </svg>;
}
