"use client";

import { useEffect, useRef } from "react";
import type { GateMapView, MapCoordinate } from "../lib/types";

type LeafletModule = typeof import("leaflet");

function createGateEditorIcon(L: LeafletModule, label: string, isSelected: boolean) {
  return L.divIcon({
    className: "",
    html: `<div class="map-pin editor ${isSelected ? "selected" : ""}"><span>${label}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
}

export function OrganizerMap({
  center,
  gates,
  selectedGateId,
  onSelectGate,
  onPickLocation,
  draftGate
}: {
  center: MapCoordinate;
  gates: GateMapView[];
  selectedGateId: string;
  onSelectGate: (gateId: string) => void;
  onPickLocation: (location: MapCoordinate) => void;
  draftGate?: GateMapView | null;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const layerGroupRef = useRef<import("leaflet").LayerGroup | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initializeMap() {
      if (!mapRef.current || mapInstanceRef.current) {
        return;
      }

      const L = await import("leaflet");
      if (cancelled || !mapRef.current) {
        return;
      }

      leafletRef.current = L;

      const map = L.map(mapRef.current, {
        zoomControl: true
      }).setView([center.latitude, center.longitude], 16);

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      map.on("click", (event) => {
        onPickLocation({
          latitude: event.latlng.lat,
          longitude: event.latlng.lng
        });
      });

      layerGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;

      setTimeout(() => map.invalidateSize(), 50);
    }

    void initializeMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [center.latitude, center.longitude, onPickLocation]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;

    if (!L || !map || !layerGroup) {
      return;
    }

    layerGroup.clearLayers();

    const markers: import("leaflet").Marker[] = [];

    gates.forEach((gate) => {
      const isSelected = gate.gateId === selectedGateId;
      const marker = L.marker([gate.latitude, gate.longitude], {
        icon: createGateEditorIcon(L, gate.gateName.replace("Gate ", ""), isSelected),
        draggable: isSelected
      })
        .addTo(layerGroup)
        .bindPopup(`${gate.gateName}<br/>${gate.latitude.toFixed(5)}, ${gate.longitude.toFixed(5)}`)
        .on("click", () => onSelectGate(gate.gateId))
        .on("dragend", (event) => {
          const latlng = event.target.getLatLng();
          onPickLocation({
            latitude: latlng.lat,
            longitude: latlng.lng
          });
        });

      markers.push(marker);
    });

    if (draftGate && !selectedGateId && Number.isFinite(draftGate.latitude) && Number.isFinite(draftGate.longitude)) {
      const draftMarker = L.marker([draftGate.latitude, draftGate.longitude], {
        icon: createGateEditorIcon(L, draftGate.gateName.replace("Gate ", "") || "New", true),
        draggable: true
      })
        .addTo(layerGroup)
        .bindPopup(`Draft gate<br/>${draftGate.latitude.toFixed(5)}, ${draftGate.longitude.toFixed(5)}`)
        .on("dragend", (event) => {
          const latlng = event.target.getLatLng();
          onPickLocation({
            latitude: latlng.lat,
            longitude: latlng.lng
          });
        });

      markers.push(draftMarker);
    }

    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds(), { padding: [24, 24] });
    } else {
      map.setView([center.latitude, center.longitude], 16);
    }

    setTimeout(() => map.invalidateSize(), 50);
  }, [center.latitude, center.longitude, draftGate, gates, onPickLocation, onSelectGate, selectedGateId]);

  return (
    <div className="map-shell">
      <div className="map-legend">
        <span><i className="legend-dot cool" /> Selected editable gate</span>
        <span><i className="legend-dot neutral" /> Other gates</span>
        <span><i className="legend-dot accent" /> Click map to place draft gate</span>
      </div>
      <div className="stadium-map organizer-map" ref={mapRef} />
    </div>
  );
}
