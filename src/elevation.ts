/** Geographic metre grid. Synthetic fixtures are tests only; game data requires DEM provenance. */
export interface ElevationGrid {
  version:1; projection:{latitude:number;longitude:number;earthRadius:number}; bounds:{minX:number;minZ:number;maxX:number;maxZ:number}; columns:number;rows:number;
  heights:number[]; originElevation:number;
  source:{url:string;sha256:string;tile:string;datum:string;attribution:string};
}
export function elevationSampler(grid:ElevationGrid):(x:number,z:number)=>number {
  const b=grid.bounds;
  if(grid.version!==1||grid.columns<2||grid.rows<2||!Number.isInteger(grid.columns)||!Number.isInteger(grid.rows)||grid.heights.length!==grid.columns*grid.rows||![b.minX,b.maxX,b.minZ,b.maxZ].every(Number.isFinite)||b.maxX<=b.minX||b.maxZ<=b.minZ||!Number.isFinite(grid.originElevation)||grid.heights.some(h=>!Number.isFinite(h)||h < -500 || h>9000))throw new Error('Invalid elevation grid');
  return (x,z)=>{
    if(!Number.isFinite(x+z)||x<b.minX||x>b.maxX||z<b.minZ||z>b.maxZ)throw new Error('Position outside verified DEM grid');
    const gx=(x-b.minX)/(b.maxX-b.minX)*(grid.columns-1),gz=(z-b.minZ)/(b.maxZ-b.minZ)*(grid.rows-1);
    const ix=Math.min(grid.columns-2,Math.floor(gx)),iz=Math.min(grid.rows-2,Math.floor(gz));
    const tx=gx-ix,tz=gz-iz,at=(dx:number,dz:number)=>grid.heights[(iz+dz)*grid.columns+ix+dx];
    return (at(0,0)*(1-tx)+at(1,0)*tx)*(1-tz)+(at(0,1)*(1-tx)+at(1,1)*tx)*tz-grid.originElevation;
  };
}
export function roadPieces(a:{x:number;z:number},b:{x:number;z:number},step=8):Array<{a:{x:number;z:number};b:{x:number;z:number}}> {
  if(!Number.isFinite(step)||step<=0)throw new Error('Road sampling step must be positive');
  const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/step));
  return Array.from({length:count},(_,i)=>({a:{x:a.x+(b.x-a.x)*i/count,z:a.z+(b.z-a.z)*i/count},b:{x:a.x+(b.x-a.x)*(i+1)/count,z:a.z+(b.z-a.z)*(i+1)/count}}));
}
