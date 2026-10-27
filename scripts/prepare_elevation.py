#!/usr/bin/env python3
"""Extract real HGT heights for the existing bounded Malappuram map; never invent missing samples."""
from pathlib import Path
import argparse,array,gzip,hashlib,json,math,sys,urllib.request
ROOT=Path(__file__).resolve().parents[1]
URL='https://elevation-tiles-prod.s3.amazonaws.com/skadi/N11/N11E076.hgt.gz'
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',type=Path,default=ROOT/'data/elevation/N11E076.hgt.gz')
    parser.add_argument('--download',action='store_true')
    parser.add_argument('--source-url',help='Required provenance for locally supplied N11E076 HGT')
    parser.add_argument('--attribution',help='Required legal attribution for locally supplied HGT')
    parser.add_argument('--output',type=Path,default=ROOT/'public/maps/malappuram/terrain.json')
    parser.add_argument('--provenance',type=Path,default=ROOT/'data/ELEVATION_PROVENANCE.json')
    args=parser.parse_args()
    if args.download:
        if args.input.exists():raise ValueError('DEM input exists; inspect it rather than overwriting it')
        args.input.parent.mkdir(parents=True,exist_ok=True)
        with urllib.request.urlopen(URL,timeout=60) as response:
            payload=response.read(); headers=dict(response.headers)
        # Validate gzip and dimensions before persisting a downloaded artifact.
        raw=gzip.decompress(payload)
        if len(raw) not in (1201*1201*2,3601*3601*2):raise ValueError('Unexpected HGT dimensions')
        args.input.write_bytes(payload)
        args.input.with_suffix('.headers.json').write_text(json.dumps({'url':URL,'sha256':hashlib.sha256(payload).hexdigest(),'headers':headers},indent=2)+'\n')
    if not args.input.exists():raise ValueError('Verified DEM is absent; no geographic terrain was generated. Supply --input or use --download after allowing the documented host.')
    compressed=args.input.read_bytes();raw=gzip.decompress(compressed);n=math.isqrt(len(raw)//2)
    digest=hashlib.sha256(compressed).hexdigest()
    receipt=args.input.with_suffix('.headers.json')
    metadata=json.loads(receipt.read_text()) if receipt.exists() else {}
    downloaded=metadata.get('url')==URL and metadata.get('sha256')==digest
    if args.input.name!='N11E076.hgt.gz':raise ValueError('Input must be the geographically identified N11E076.hgt.gz tile')
    if not downloaded and not(args.source_url and args.attribution):raise ValueError('Local DEM needs --source-url and --attribution; provider provenance cannot be inferred from bytes')
    source_url=URL if downloaded else args.source_url
    attribution='Mapzen/Tilezen; global SRTM/GMTED2010 data courtesy of USGS' if downloaded else args.attribution
    if args.output.exists() or args.provenance.exists():raise ValueError('Generated DEM/provenance exists; inspect it before replacing it')
    if n not in (1201,3601) or len(raw)!=n*n*2:raise ValueError('HGT must contain a 1201 or 3601 square of signed 16-bit samples')
    heights=array.array('h');heights.frombytes(raw)
    if sys.byteorder=='little':heights.byteswap()
    manifest=json.loads((ROOT/'public/maps/malappuram/manifest.json').read_text());p=manifest['projection'];bounds=manifest['bounds']
    def sample(x,z):
        lat=p['latitude']-z/p['earthRadius']*180/math.pi
        lon=p['longitude']+x/(p['earthRadius']*math.cos(math.radians(p['latitude'])))*180/math.pi
        if not(11<=lat<=12 and 76<=lon<=77):raise ValueError('Prototype lies outside N11E076 tile')
        # HGT rows run north to south; N11E076 has northwest corner (12N,76E).
        col=(lon-76)*(n-1);row=(12-lat)*(n-1);ix=min(n-2,int(col));iz=min(n-2,int(row));tx=col-ix;tz=row-iz
        h=[heights[iz*n+ix],heights[iz*n+ix+1],heights[(iz+1)*n+ix],heights[(iz+1)*n+ix+1]]
        if any(v==-32768 or v < -500 or v>9000 for v in h):raise ValueError('Missing/invalid DEM sample: no invented void fill is allowed')
        return (h[0]*(1-tx)+h[1]*tx)*(1-tz)+(h[2]*(1-tx)+h[3]*tx)*tz
    columns=81;rows=81
    values=[round(sample(bounds['minX']+(bounds['maxX']-bounds['minX'])*x/(columns-1),bounds['minZ']+(bounds['maxZ']-bounds['minZ'])*z/(rows-1)),2) for z in range(rows) for x in range(columns)]
    output={'version':1,'bounds':bounds,'columns':columns,'rows':rows,'heights':values,'originElevation':round(sample(0,0),2),'source':{'url':source_url,'sha256':digest,'tile':'N11E076','datum':'Signed metre heights as distributed in HGT; composite sources, not surveyed road/deck elevations','attribution':attribution},'projection':p,'rawSha256':hashlib.sha256(raw).hexdigest(),'inputSamplesPerSide':n,'spacingMetres':60,'verticalScale':1,'absoluteRangeMetres':[min(values),max(values)],'limitations':['Coarse DEM may include vegetation/buildings; not surveyed street elevations.','Bilinear resampling at 60m, no invented void fill; no surveyed bridge/tunnel heights.','Only the existing 4.8km playable window, not full district terrain.']}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(output,separators=(',',':'))+'\n')
    args.provenance.parent.mkdir(parents=True,exist_ok=True)
    args.provenance.write_text(json.dumps({k:v for k,v in output.items() if k!='heights'},indent=2)+'\n')
    print(json.dumps({'output':str(args.output),'samples':len(values),'absoluteRangeMetres':output['absoluteRangeMetres'],'sha256':output['source']['sha256']}))
if __name__=='__main__':
    try:main()
    except (ValueError,OSError,EOFError) as error:raise SystemExit(str(error))
