import { MapLibreOverlay } from '@deck.gl/maplibre';
import { PolygonLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { makeTreeLayers, TREE_DECK_IDS } from '@/components/treeDeckLayers';
import { prepareTreeVisuals, type TreeVisual } from '@/map/treeModels';
import type { SeoulTreeFeature } from '@/types/seoul';
import mapConfig from '../../config/map.json';
import { createSunLightingEffect } from '@/map/sunLighting';
import { combineLocalDateMinutes, sunVector } from '@/solar/sunVector';
import { useAppStore } from '@/store/appStore';
import type { Building } from '@/types/building';
import type { EnuOrigin } from '@/geo/enu';

const ESTIMATED_FILL: [number, number, number, number] = [201, 162, 90, 200];
const MEASURED_FILL: [number, number, number, number] = [186, 196, 206, 230];

function fillColor(b: Building): [number, number, number, number] {
  return b.heightSource === 'estimated' ? ESTIMATED_FILL : MEASURED_FILL;
}

function shadowCast(on: boolean): Record<string, unknown> {
  return { shadowEnabled: on };
}

export function makeBuildingLayer(
  buildings: Building[],
  visible: boolean,
  castShadow = true,
) {
  return new PolygonLayer<Building>({
    id: 'seoul-buildings-3d',
    data: visible ? buildings : [],
    extruded: true,
    filled: true,
    wireframe: false,
    getPolygon: (d) => d.lngLatPolygon,
    getElevation: (d) => d.height,
    getFillColor: fillColor,
    getLineColor: (d) =>
      d.heightSource === 'estimated' ? [232, 184, 74, 200] : [40, 48, 56, 160],
    lineWidthMinPixels: 1,
    pickable: false,
    ...shadowCast(castShadow),
    material: {
      ambient: 0.4,
      diffuse: 0.6,
      shininess: 8,
      specularColor: [60, 60, 60],
    },
  });
}

export function buildDeckLayers(input: {
  buildings: Building[];
  buildingsVisible: boolean;
  origin: EnuOrigin | null;
  shadowOn: boolean;
  trees?: TreeVisual[];
  treesVisible?: boolean;
}) {
  const buildings = makeBuildingLayer(
    input.buildings,
    input.buildingsVisible,
    false,
  );
  const layers: Layer[] = [buildings, ...makeTreeLayers(input.trees ?? [], input.treesVisible ?? false)];
  return layers;
}

function currentSun() {
  const s = useAppStore.getState();
  const loc = s.origin ?? {
    lat0: mapConfig.initialView.lat,
    lon0: mapConfig.initialView.lon,
  };
  const when = combineLocalDateMinutes(s.date, s.timeMinutes);
  return sunVector(when, loc.lat0, loc.lon0);
}

function layersFromStore() {
  const s = useAppStore.getState();
  return buildDeckLayers({
    buildings: s.buildings,
    buildingsVisible: s.layers.buildings,
    origin: s.origin,
    shadowOn: s.layers.realtimeShadow,
    trees: prepareTreeVisuals(s.seoulTrees.features, s.ground),
    treesVisible: s.layers.trees,
  });
}

export type TreePicker = (x:number,y:number) => SeoulTreeFeature | null;
export function BuildingLayer({ map, treePickerRef }: { map: MapLibreMap; treePickerRef?: MutableRefObject<TreePicker | null> }) {
  const treeFeatures = useAppStore((s) => s.seoulTrees.features);
  const ground = useAppStore((s) => s.ground);
  const treesVisible = useAppStore((s) => s.layers.trees);
  const trees = useMemo(() => prepareTreeVisuals(treeFeatures, ground), [treeFeatures, ground]);
  const buildings = useAppStore((s) => s.buildings);
  const visible = useAppStore((s) => s.layers.buildings);
  const shadowOn = useAppStore((s) => s.layers.realtimeShadow);
  const date = useAppStore((s) => s.date);
  const timeMinutes = useAppStore((s) => s.timeMinutes);
  const origin = useAppStore((s) => s.origin);
  const overlayRef = useRef<MapLibreOverlay | null>(null);

  useEffect(() => {
    let overlay: MapLibreOverlay | null = null;
    const attach = () => {
      if (overlay) return;
      overlay = new MapLibreOverlay({
        interleaved: true,
        layers: layersFromStore(),
        effects: [createSunLightingEffect(currentSun(), false)],
      });
      overlayRef.current = overlay;
      map.addControl(overlay);
      if (treePickerRef) treePickerRef.current = (x,y) => {
        const hit = overlay?.pickObject({x,y,radius:4,layerIds:TREE_DECK_IDS});
        return (hit?.object as TreeVisual | undefined)?.feature ?? null;
      };
    };

    if (map.loaded() || map.isStyleLoaded()) attach();
    else map.once('load', attach);

    return () => {
      map.off('load', attach);
      if (overlay) {
        map.removeControl(overlay);
        overlay.finalize?.();
      }
      overlayRef.current = null;
      if (treePickerRef) treePickerRef.current = null;
    };
  }, [map, treePickerRef]);

  useEffect(() => {
    overlayRef.current?.setProps({
      layers: buildDeckLayers({
        buildings,
        buildingsVisible: visible,
        origin,
        shadowOn,
        trees,
        treesVisible,
      }),
    });
  }, [buildings, visible, origin, shadowOn, trees, treesVisible]);

  useEffect(() => {
    overlayRef.current?.setProps({
      effects: [createSunLightingEffect(currentSun(), false)],
    });
  }, [date, timeMinutes, origin]);

  return null;
}
