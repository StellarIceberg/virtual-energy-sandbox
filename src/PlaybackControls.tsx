import type { Dispatch } from 'react';
import { DURATION_MINUTES, type Event } from './engine';
export default function PlaybackControls({ minute, playing, dispatch }: { minute: number; playing: boolean; dispatch: Dispatch<Event> }) {
  return <div className="playback" role="group" aria-label="Simulation playback">
    <div className="playback-buttons">
      <button className="primary" disabled={playing || minute === DURATION_MINUTES} onClick={() => dispatch({type:'play'})}>▶ Play</button>
      <button disabled={!playing} onClick={() => dispatch({type:'pause'})}>Ⅱ Pause</button>
      <button onClick={() => dispatch({type:'reset'})}>↺ Reset</button>
    </div>
    <div className="playback-timeline"><progress aria-label="Simulated elapsed time" value={minute} max={DURATION_MINUTES}/><span>{minute} / {DURATION_MINUTES} min</span></div>
    <p className="speed-note">1 simulated minute every 0.2 seconds</p>
  </div>;
}
