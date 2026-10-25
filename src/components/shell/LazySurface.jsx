import { Component, Suspense, lazy, useEffect, useMemo, useState } from 'react'

export function SurfaceSkeleton({ kind = 'view', onRetry }) {
  const [slow,setSlow]=useState(false)
  useEffect(()=>{const timer=setTimeout(()=>setSlow(true),8000);return()=>clearTimeout(timer)},[])
  return <div className={`surface-skeleton skeleton-${kind}`} role="status" aria-label="Opening panel" aria-busy="true">
    <div className="skeleton-shapes" aria-hidden="true"><i/><i/><div>{Array.from({length:6},(_,i)=><span key={i}/>)}</div></div>
    {slow&&<div className="surface-retry">This panel is taking longer than usual. <button className="text-btn" onClick={onRetry}>Retry panel</button></div>}
  </div>
}
export const RoomStageSkeleton=props=><SurfaceSkeleton {...props} kind="view"/>
export const DrawerSkeleton=props=><SurfaceSkeleton {...props} kind="drawer"/>
export const ModalSkeleton=props=><SurfaceSkeleton {...props} kind="modal"/>
class ChunkBoundary extends Component {
  state={failed:false}
  static getDerivedStateFromError(){return{failed:true}}
  render(){return this.state.failed?<div className="surface-retry" role="alert">This panel could not open. <button className="primary-btn" onClick={this.props.onRetry}>Retry panel</button></div>:this.props.children}
}
export function makeLazySurface(load, name, kind='modal', retryLoad=load) {
  let pending, retryRequested=false
  // Browsers cache failed module URLs; retry uses a distinct built module URL.
  const loadModule=()=>pending ||= (retryRequested ? retryLoad : load)().catch(error=>{pending=null;throw error})
  function Surface(props){
    const [attempt,setAttempt]=useState(0)
    const View=useMemo(()=>lazy(()=>loadModule().then(module=>({default:module[name]}))),[attempt])
    const retry=()=>{pending=null;retryRequested=true;setAttempt(n=>n+1)}
    return <ChunkBoundary key={attempt} onRetry={retry}><Suspense fallback={<SurfaceSkeleton kind={kind} onRetry={retry}/>}><View {...props}/></Suspense></ChunkBoundary>
  }
  Surface.preload=()=>loadModule().catch(()=>undefined)
  return Surface
}
