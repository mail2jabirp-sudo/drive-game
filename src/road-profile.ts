import type { OsmRoad } from './osm-types';

/** Existing importer defaults, in metres. Estimates are not surveyed widths. */
export const CLASS_WIDTHS: Readonly<Record<string, number>> = Object.freeze({
  motorway: 10, motorway_link: 5, trunk: 9, trunk_link: 5, primary: 8, primary_link: 4.5, secondary: 7, secondary_link: 4.5, tertiary: 6, tertiary_link: 4,
  residential: 5, unclassified: 4.5, service: 4, living_street: 4, road: 5,
});

export function roadProfile(road: OsmRoad): {
  width: number; estimatedClassWidth: number; surface: 'asphalt' | 'concrete' | 'gravel';
  shoulder: number; drainage: boolean; centerMarking: boolean;
} {
  const raw = road.tags.surface;
  const surface = raw === 'concrete' || raw === 'concrete:plates' ? 'concrete'
    : ['gravel', 'fine_gravel', 'unpaved', 'ground', 'dirt', 'earth', 'compacted'].includes(raw) ? 'gravel' : 'asphalt';
  const major = ['motorway', 'trunk', 'primary', 'secondary'].includes(road.highway);
  const connector = major || road.highway === 'tertiary';
  const lanes = /^\d+(\.\d+)?$/.test(road.tags.lanes ?? '') ? Number(road.tags.lanes) : 0;
  const covered = road.bridge || (road.tags.tunnel !== undefined && !['no', 'false', '0'].includes(road.tags.tunnel));
  return {
    // Retain tag/lane-derived values and existing class estimates, including single-lane tertiary roads.
    width: road.width, estimatedClassWidth: CLASS_WIDTHS[road.highway] ?? 5, surface,
    shoulder: covered ? 0 : major ? 0.5 : connector ? 0.3 : road.highway === 'service' ? 0.16 : 0.22,
    drainage: !covered && major && surface !== 'gravel' && road.width >= 6,
    // No inferred centerlines on village streets, narrow/single-lane roads or gravel.
    centerMarking: connector && road.oneway === 'no' && surface !== 'gravel' && road.width >= 6
      && (lanes >= 2 || (major && road.width >= 6.5)) && !(lanes > 0 && lanes < 2),
  };
}
