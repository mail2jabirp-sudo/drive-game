"""Source-verified auxiliary features in the existing district projection."""
import math,xml.etree.ElementTree as ET
from import_osm import import_map,polygon,point,tags,number,RELEVANT_TAGS
from import_export_roads import ROOT,R,SIZE,encode

def features(projection):
    data,provenance=import_map(ROOT/'map.osm',100000,projection['latitude'],projection['longitude'])
    data['landuse']=[]
    root=ET.parse(ROOT/'map.osm').getroot();coords={}
    for n in root.findall('node'):
        lat,lon=float(n.attrib['lat']),float(n.attrib['lon']);coords[n.attrib['id']]=point(R*math.cos(math.radians(projection['latitude']))*math.radians(lon-projection['longitude']),-R*math.radians(lat-projection['latitude']))
    way_tags={w.attrib['id']:tags(w) for w in root.findall('way')}
    for building in data['buildings']:
        t=way_tags.get(building['id'],{})
        building['tags'].update({k:v for k,v in t.items() if k.startswith('roof:') or k in ('religion','denomination','building:material','building:colour','office')})
    for water in data['water']:
        t=way_tags.get(water['id'].split(':')[0],{});water['tags']=t
        if water['kind']=='stream':
            width=number(t.get('width'));water['width']=width if width and .3<=width<=500 else {'river':12,'canal':3,'drain':1,'ditch':.7}.get(t.get('waterway'),2);water['widthSource']='tag' if width and .3<=width<=500 else 'estimate'
    for way in root.findall('way'):
        t=tags(way)
        if t.get('landuse') not in ('farmland','farmyard','orchard','plant_nursery','grass','meadow','forest') and t.get('natural') not in ('wood','grassland','scrub'):continue
        ring=polygon([n.attrib['ref'] for n in way.findall('nd')],coords,100000)
        if ring:data['landuse'].append({'id':way.attrib['id'],'kind':t.get('landuse',t.get('natural')),'name':t.get('name:en',t.get('name','')),'points':ring,'tags':t})
    return data,provenance

def feature_tiles(item):
    points=item.get('points',[item]);xs=[p['x'] for p in points];zs=[p['z'] for p in points]
    return [f'{x},{z}' for x in range(math.floor(min(xs)/SIZE),math.floor(max(xs)/SIZE)+1) for z in range(math.floor(min(zs)/SIZE),math.floor(max(zs)/SIZE)+1)]

def road_tiles(road,canonical):
    from import_osm import clipped_segment
    source=dict(road);source['points']=[canonical.get(n,p) for n,p in zip(road['nodeIds'],road['points'])]
    fragments={}
    for i,(a,b) in enumerate(zip(source['points'],source['points'][1:])):
        for key in feature_tiles({'points':[a,b]}):
            ix,iz=map(int,key.split(','));cx,cz=(ix+.5)*SIZE,(iz+.5)*SIZE
            clipped=clipped_segment({'x':a['x']-cx,'z':a['z']-cz},{'x':b['x']-cx,'z':b['z']-cz},SIZE/2)
            if not clipped:continue
            pa,pb=[point(p['x']+cx,p['z']+cz) for p in clipped[2:]]
            if math.hypot(pa['x']-pb['x'],pa['z']-pb['z'])<.001:continue
            def identity(p):
                if p==a:return source['nodeIds'][i]
                if p==b:return source['nodeIds'][i+1]
                return f"clip:{source['sourceWayId']}:{p['x']}:{p['z']}"
            ia,ib=identity(pa),identity(pb);prev=fragments.get(key)
            if prev and prev['nodeIds'][-1]==ia:prev['points'].append(pb);prev['nodeIds'].append(ib)
            else:
                item={**source,'id':source['id']+':'+key+':'+str(i),'points':[pa,pb],'nodeIds':[ia,ib]};fragments[key]=item;yield key,item

def road_conflicts(buildings,roads):
    """Keep source polygons, but flag snapshot/estimated-width overlaps for review."""
    from collections import defaultdict
    cells=defaultdict(list)
    def bounds(points,pad=0):
        return (min(p['x'] for p in points)-pad,max(p['x'] for p in points)+pad,min(p['z'] for p in points)-pad,max(p['z'] for p in points)+pad)
    def keys(b):
        return ((x,z) for x in range(math.floor(b[0]/64),math.floor(b[1]/64)+1) for z in range(math.floor(b[2]/64),math.floor(b[3]/64)+1))
    region=bounds([p for b in buildings for p in b['points']],30)
    for r in roads:
        for a,b in zip(r['points'],r['points'][1:]):
            bb=bounds([a,b],r['width']/2+.1)
            if bb[1]<region[0] or bb[0]>region[1] or bb[3]<region[2] or bb[2]>region[3]:continue
            item=(a,b,r['width']/2+.1)
            for key in keys(bb):cells[key].append(item)
    def dist(p,a,b):
        dx,dz=b['x']-a['x'],b['z']-a['z'];d=dx*dx+dz*dz;t=max(0,min(1,((p['x']-a['x'])*dx+(p['z']-a['z'])*dz)/d)) if d else 0
        return math.hypot(p['x']-a['x']-t*dx,p['z']-a['z']-t*dz)
    def cross(a,b,c):return (b['x']-a['x'])*(c['z']-a['z'])-(b['z']-a['z'])*(c['x']-a['x'])
    excluded=[]
    for building in buildings:
        poly=building['points'];bb=bounds(poly);conflict=False
        for key in keys(bb):
            if conflict:break
            for a,b,radius in cells[key]:
                if any(dist(p,a,b)<radius for p in poly):conflict=True;break
                for c,d in zip(poly,poly[1:]+poly[:1]):
                    if dist(a,c,d)<radius or dist(b,c,d)<radius or cross(a,b,c)*cross(a,b,d)<0 and cross(c,d,a)*cross(c,d,b)<0:conflict=True;break
                if conflict:break
        if conflict:building['renderExcludedReason']='source-road-buffer-overlap';excluded.append(building['id'])
    return {'excludedBuildingIds':excluded,'reason':'Source footprint intersects imported road buffer; kept in derived data but omitted from render/collision pending source/width review.'}
