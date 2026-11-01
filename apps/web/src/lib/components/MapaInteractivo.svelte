<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  const browser = typeof window !== 'undefined';

  export interface MarcadorEstablecimiento {
    id: string;
    nombre_comercial: string;
    tipo: string;
    latitud: number;
    longitud: number;
    direccion_texto?: string;
    distancia_km?: number;
    cotizacion_destacada?: {
      producto: string;
      categoria?: string;
      precio_unitario: number;
      unidad_medida: string;
      sentido: 'OFERTA_VENTA' | 'DEMANDA_COMPRA';
    };
  }

  interface Props {
    establecimientos?: MarcadorEstablecimiento[];
    selectedId?: string | null;
    centroDefecto?: [number, number];
    zoomDefecto?: number;
    onSelectEstablecimiento?: (est: MarcadorEstablecimiento) => void;
  }

  let {
    establecimientos = [],
    selectedId = null,
    centroDefecto = [-9.19, -75.01], // Centro geográfico de Perú
    zoomDefecto = 6,
    onSelectEstablecimiento
  }: Props = $props();

  let mapContainer: HTMLDivElement | null = $state(null);
  let mapInstance: any = null;
  let markersLayerGroup: any = null;
  let leafletLib: any = null;
  let isMapLoading = $state(true);
  let userCoords: [number, number] | null = $state(null);

  const COLORES_POR_TIPO: Record<string, { bg: string; border: string; label: string }> = {
    CAMAL_FRIGORIFICO: { bg: '#ef4444', border: '#b91c1c', label: 'Camal Frigorífico' },
    CAMAL: { bg: '#ef4444', border: '#b91c1c', label: 'Camal Frigorífico' },
    FEEDLOT: { bg: '#f59e0b', border: '#b45309', label: 'Feedlot / Engorde' },
    ASOCIACION_PRODUCTORES: { bg: '#10b981', border: '#047857', label: 'Asociación de Productores' },
    CARNICERIA: { bg: '#3b82f6', border: '#1d4ed8', label: 'Carnicería / Mayorista' },
    ESTABLO: { bg: '#8b5cf6', border: '#6d28d9', label: 'Establo Lechero / Cría' },
    CENTRO_BENEFICIO: { bg: '#ec4899', border: '#be185d', label: 'Centro de Beneficio' }
  };

  function getInfoTipo(tipo: string) {
    return COLORES_POR_TIPO[tipo] ?? { bg: '#64748b', border: '#334155', label: tipo || 'Establecimiento' };
  }

  function crearIconoMarcador(L: any, tipo: string, esSeleccionado: boolean) {
    const info = getInfoTipo(tipo);
    const size = esSeleccionado ? 42 : 32;
    const pulseClass = esSeleccionado ? 'marker-highlight ring-4 ring-white/50' : '';

    const html = `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background-color: ${info.bg};
        border: 2.5px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        cursor: pointer;
        transition: transform 0.2s ease;
      " class="${pulseClass}">
        <svg xmlns="http://www.w3.org/2000/svg" width="${size * 0.5}" height="${size * 0.5}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <circle cx="12" cy="9" r="2.5"/>
        </svg>
      </div>
    `;

    return L.divIcon({
      html,
      className: 'custom-leaflet-marker',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2]
    });
  }

  function actualizarMarcadores() {
    if (!browser || !mapInstance || !leafletLib || !markersLayerGroup) return;

    markersLayerGroup.clearLayers();

    establecimientos.forEach((est) => {
      if (typeof est.latitud !== 'number' || typeof est.longitud !== 'number') return;

      const isSelected = selectedId === est.id;
      const icon = crearIconoMarcador(leafletLib, est.tipo, isSelected);
      const marker = leafletLib.marker([est.latitud, est.longitud], { icon });

      const infoTipo = getInfoTipo(est.tipo);
      const distanciaBadge = est.distancia_km !== undefined
        ? `<span style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 9999px;">A ${est.distancia_km.toFixed(1)} km</span>`
        : '';

      const cotizacionHtml = est.cotizacion_destacada
        ? `
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #334155;">
            <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 600;">Cotización Spot</div>
            <div style="display: flex; align-items: baseline; justify-content: space-between; margin-top: 2px;">
              <span style="font-size: 12px; font-weight: 600; color: #f8fafc;">${est.cotizacion_destacada.producto}</span>
              <span style="font-size: 14px; font-weight: 800; color: #10b981; font-family: monospace;">S/ ${est.cotizacion_destacada.precio_unitario.toFixed(2)}</span>
            </div>
            <div style="font-size: 10px; color: #64748b;">${est.cotizacion_destacada.sentido === 'OFERTA_VENTA' ? 'Oferta de Venta' : 'Demanda de Compra'} • ${est.cotizacion_destacada.unidad_medida}</div>
          </div>
        `
        : '';

      const popupContent = `
        <div style="font-family: inherit; min-width: 200px; color: #0f172a; padding: 2px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
            <span style="background: ${infoTipo.bg}; color: white; font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 4px;">
              ${infoTipo.label}
            </span>
            ${distanciaBadge}
          </div>
          <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 4px;">
            ${est.nombre_comercial}
          </div>
          ${est.direccion_texto ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">${est.direccion_texto}</div>` : ''}
          ${cotizacionHtml}
        </div>
      `;

      marker.bindPopup(popupContent, { maxWidth: 280, className: 'ganadito-custom-popup' });

      marker.on('click', () => {
        onSelectEstablecimiento?.(est);
      });

      markersLayerGroup.addLayer(marker);

      if (isSelected) {
        marker.openPopup();
      }
    });

    // Ajustar límites si hay marcadores válidos
    if (establecimientos.length > 0 && !selectedId) {
      const bounds = leafletLib.latLngBounds(establecimientos.map((e) => [e.latitud, e.longitud]));
      mapInstance.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }

  $effect(() => {
    // Si cambian los establecimientos o el seleccionado, actualizar
    if (establecimientos || selectedId) {
      actualizarMarcadores();
    }
  });

  onMount(async () => {
    if (!browser || !mapContainer) return;

    try {
      leafletLib = await import('leaflet');
      const L = leafletLib.default || leafletLib;

      // Inicializar mapa centrado en Perú
      mapInstance = L.map(mapContainer, {
        center: centroDefecto,
        zoom: zoomDefecto,
        zoomControl: false
      });

      // Controles de zoom abajo a la derecha
      L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);

      // Capa base de CartoDB Dark Matter / Voyager
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(mapInstance);

      markersLayerGroup = L.layerGroup().addTo(mapInstance);

      // Intentar obtener geolocalización del usuario
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            userCoords = [lat, lng];

            // Marcador de ubicación del usuario
            const userIcon = L.divIcon({
              html: `
                <div style="width: 18px; height: 18px; background: #0ea5e9; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 0 4px rgba(14,165,233,0.4);" class="animate-ping"></div>
              `,
              className: 'user-location-marker',
              iconSize: [18, 18],
              iconAnchor: [9, 9]
            });

            L.marker([lat, lng], { icon: userIcon })
              .addTo(mapInstance)
              .bindPopup('<b>Tu ubicación actual</b>')
              .openPopup();
          },
          () => {
            // Error o permiso denegado: se mantiene centro en Perú
          },
          { timeout: 8000 }
        );
      }

      actualizarMarcadores();
      isMapLoading = false;
    } catch (err) {
      console.error('Error inicializando Leaflet en cliente:', err);
      isMapLoading = false;
    }
  });

  onDestroy(() => {
    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }
  });

  export function centrarEn(lat: number, lon: number, zoom: number = 14) {
    if (mapInstance) {
      mapInstance.setView([lat, lon], zoom, { animate: true });
    }
  }
</script>

<div class="relative w-full h-full min-h-[420px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl flex flex-col">
  <!-- Contenedor del Mapa Leaflet -->
  <div bind:this={mapContainer} class="w-full h-full flex-1"></div>

  <!-- Skeleton / Loader mientras carga el bundle de Leaflet en cliente -->
  {#if isMapLoading}
    <div class="absolute inset-0 z-30 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
      <div class="w-12 h-12 rounded-full border-3 border-emerald-500/20 border-t-emerald-500 animate-spin mb-4"></div>
      <p class="text-sm font-semibold text-white">Inicializando Visor Geoespacial PostGIS...</p>
      <p class="text-xs text-slate-400 mt-1">Cargando capas satelitales y geodésicas de Perú (EPSG:4326)</p>
    </div>
  {/if}

  <!-- Leyenda flotante sobre el mapa -->
  <div class="absolute top-3 left-3 z-20 bg-slate-950/90 backdrop-blur-md border border-slate-800/90 rounded-xl p-3 shadow-xl max-w-xs pointer-events-auto">
    <div class="text-[11px] font-bold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
      <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
      <span>Actores en el Mapa ({establecimientos.length})</span>
    </div>
    <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px]">
      <div class="flex items-center gap-1.5 text-slate-300">
        <span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
        <span>Camales / Frigoríficos</span>
      </div>
      <div class="flex items-center gap-1.5 text-slate-300">
        <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
        <span>Feedlots / Engorde</span>
      </div>
      <div class="flex items-center gap-1.5 text-slate-300">
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
        <span>Asociaciones</span>
      </div>
      <div class="flex items-center gap-1.5 text-slate-300">
        <span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
        <span>Carnicerías</span>
      </div>
    </div>
  </div>
</div>
