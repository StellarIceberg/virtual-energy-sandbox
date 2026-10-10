import {initialState,reducer,type State,type ScenarioId,type Event} from './engine';
export type TabId = ScenarioId | 'lab';
export type ViewState = {tab:TabId;simulation:State};
export type ViewEvent = {type:'tab';tab:TabId} | {type:'simulation';event:Event};
export const initialView = (): ViewState => ({tab:'positive',simulation:initialState()});
export function viewReducer(state:ViewState,event:ViewEvent):ViewState {
  if(event.type === 'tab') return {tab:event.tab,simulation:event.tab === 'lab' ? reducer(state.simulation,{type:'pause'}) : initialState(event.tab)};
  if(state.tab === 'lab' && event.event.type === 'tick') return state;
  return {...state,simulation:reducer(state.simulation,event.event)};
}
