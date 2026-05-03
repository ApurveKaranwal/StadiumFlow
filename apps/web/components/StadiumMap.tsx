"use client";

import { useEffect, useRef } from "react";
import type { GateMapView, MapCoordinate } from "../lib/types";

type LeafletModule = typeof import("leaflet");

function createGateIcon(L: LeafletModule, label: string, isBest: boolean, isSelected: boolean) {
  return L.divIcon({
    className: "",
    html: `<div class="map-pin ${isBest ? "best" : ""} ${isSelected ? "selected" : ""}"><span>${label}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
}

function createUserIcon(L: LeafletModule) {
  return L.divIcon({
    className: "",
    html: '<div class="user-pin"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
}

export function StadiumMap({
  userLocation,
  gates,
  selectedGateId,
  onSelectGate
}: {
  userLocation: MapCoordinate;
  gates: GateMapView[];
  selectedGateId: string;
  onSelectGate: (gateId: string) => void;
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
      }).setView([userLocation.latitude, userLocation.longitude], 16);

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

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
  }, [userLocation.latitude, userLocation.longitude]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;

    if (!L || !map || !layerGroup || gates.length === 0) {
      return;
    }

    layerGroup.clearLayers();

    const selectedGate = gates.find((gate) => gate.gateId === selectedGateId) ?? gates[0];

    map.setView([userLocation.latitude, userLocation.longitude], map.getZoom());

    L.marker([userLocation.latitude, userLocation.longitude], {
      icon: createUserIcon(L)
    })
      .addTo(layerGroup)
      .bindPopup("You are here");

    const visibleMarkers: import("leaflet").Marker[] = [];

    gates.forEach((gate) => {
      const isBest = gate.gateId === gates[0]?.gateId;
      const isSelected = gate.gateId === selectedGate.gateId;

      const marker = L.marker([gate.latitude, gate.longitude], {
        icon: createGateIcon(L, gate.gateName.replace("Gate ", ""), isBest, isSelected)
      })
        .addTo(layerGroup)
        .bindPopup(
          `<strong>${gate.gateName}</strong><br/>${gate.walkingMinutes ?? "-"} min walk<br/>${gate.queueMinutes ?? "-"} min queue<br/>${gate.totalMinutes ?? "-"} min total<br/>${gate.verifiedReports ?? 0} verified reports<br/>Crowd score ${gate.liveCrowdScore ?? "-"}`
        )
        .on("click", () => onSelectGate(gate.gateId));

      visibleMarkers.push(marker);
    });

    const routeLatLngs: [number, number][] = (selectedGate.routeCoordinates ?? []).map((point) => [point.latitude, point.longitude]);
    if (routeLatLngs.length < 2) {
      if (visibleMarkers.length > 0) {
        const group = L.featureGroup(visibleMarkers);
        map.fitBounds(group.getBounds(), { padding: [24, 24] });
      } else {
        map.setView([userLocation.latitude, userLocation.longitude], 16);
      }
      setTimeout(() => map.invalidateSize(), 50);
      return;
    }
    const routeLine = L.polyline(routeLatLngs, {
      color: "#d24f2f",
      weight: 5,
      opacity: 0.9
    }).addTo(layerGroup);

    map.fitBounds(routeLine.getBounds(), {
      padding: [24, 24]
    });
    setTimeout(() => map.invalidateSize(), 50);
  }, [gates, onSelectGate, selectedGateId, userLocation.latitude, userLocation.longitude]);

  return (
    <div className="map-shell">
      <div className="map-legend">
        <span><i className="legend-dot accent" /> Best gate</span>
        <span><i className="legend-dot alert" /> You are here</span>
        <span><i className="legend-dot neutral" /> Other visible gates</span>
      </div>
      <div className="stadium-map" ref={mapRef} />
    </div>
  );
}
