import type { Dispatch } from 'react';
import { type Event } from './engine';
import { speeds, type Speed } from './config';
export default function PlaybackControls({ minute, duration, playing, speed, dispatch }: { minute: number; duration: number; playing: boolean; speed: Speed; dispatch: Dispatch<Event> }) {
  return <div className="playback" role="group" aria-label="Simulation playback">
    <div className="playback-buttons">
      <button className="primary" disabled={!playing && minute >= duration} onClick={() => dispatch({type:playing ? 'pause' : 'play'})}>{playing ? 'Ⅱ Pause' : '▶ Play'}</button>
      <button onClick={() => dispatch({type:'reset'})}>↺ Reset</button>
    </div>
    <div className="speed-buttons" aria-label="Playback speed">{speeds.map(s => <button key={s} aria-label={`Fast forward ${s} times`} aria-pressed={speed === s} className={speed === s ? 'selected' : ''} onClick={() => dispatch({type:'speed',speed:s})}>» {s}×</button>)}</div>
    <div className="playback-timeline"><progress aria-label="Simulated elapsed time" value={minute} max={duration}/><span>{minute} / {duration} min</span></div>
    <p className="speed-note">{speed}× · base: 1 simulated minute / 0.2 seconds</p>
  </div>;
}
