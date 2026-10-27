import type {MapPoint,OsmMap} from './osm-types';
import {pointInPolygon} from './osm-navigation';
function cross(a:MapPoint,b:MapPoint,c:MapPoint){return (b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);}
function linesMeet(a:MapPoint,b:MapPoint,c:MapPoint,d:MapPoint){
 const side=[cross(a,b,c),cross(a,b,d),cross(c,d,a),cross(c,d,b)];
 const on=(p:MapPoint,q:MapPoint,r:MapPoint)=>r.x>=Math.min(p.x,q.x)-1e-6&&r.x<=Math.max(p.x,q.x)+1e-6&&r.z>=Math.min(p.z,q.z)-1e-6&&r.z<=Math.max(p.z,q.z)+1e-6;
 return side[0]*side[1]<0&&side[2]*side[3]<0||Math.abs(side[0])<1e-6&&on(a,b,c)||Math.abs(side[1])<1e-6&&on(a,b,d)||Math.abs(side[2])<1e-6&&on(c,d,a)||Math.abs(side[3])<1e-6&&on(c,d,b);
}
/** Exact source polygons, indexed locally: avoids false walls from footprint bounding boxes. */
export class TrafficObstacles{
 private source:OsmMap['buildings']=[];private cells=new Map<string,OsmMap['buildings']>();
 update(buildings:OsmMap['buildings']){if(buildings===this.source)return;this.source=buildings;this.cells.clear();for(const b of buildings){const xs=b.points.map(p=>p.x),zs=b.points.map(p=>p.z);for(let x=Math.floor(Math.min(...xs)/32);x<=Math.floor(Math.max(...xs)/32);x++)for(let z=Math.floor(Math.min(...zs)/32);z<=Math.floor(Math.max(...zs)/32);z++){const key=`${x},${z}`,cell=this.cells.get(key)??[];cell.push(b);this.cells.set(key,cell);}}}
 blocked(pose:MapPoint & {heading:number},spec:{length:number;width:number}){
  const point=(x:number,z:number)=>({x:pose.x+Math.cos(pose.heading)*x+Math.sin(pose.heading)*z,z:pose.z-Math.sin(pose.heading)*x+Math.cos(pose.heading)*z});
  const corners=[point(-spec.width/2,-spec.length/2),point(spec.width/2,-spec.length/2),point(spec.width/2,spec.length/2),point(-spec.width/2,spec.length/2)],xs=corners.map(p=>p.x),zs=corners.map(p=>p.z),candidates=new Set<OsmMap['buildings'][number]>();
  for(let x=Math.floor(Math.min(...xs)/32);x<=Math.floor(Math.max(...xs)/32);x++)for(let z=Math.floor(Math.min(...zs)/32);z<=Math.floor(Math.max(...zs)/32);z++)for(const b of this.cells.get(`${x},${z}`)??[])candidates.add(b);
  for(const building of candidates){const poly=building.points;if(corners.some(p=>pointInPolygon(p,poly))||poly.some(p=>pointInPolygon(p,corners)))return true;
   for(let i=0;i<corners.length;i++)for(let j=0;j<poly.length;j++)if(linesMeet(corners[i],corners[(i+1)%corners.length],poly[j],poly[(j+1)%poly.length]))return true;
  }
  return false;
 }
}
