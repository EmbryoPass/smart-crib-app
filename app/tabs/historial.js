// screens/historial/HistorialScreen.js — Capullo App
// Pantalla completa: HISTORIAL — 3 tabs: stats / diario / alertas

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ScrollView, Dimensions,
} from 'react-native';
import Svg, { Polyline, Line, Text as SvgText, Circle } from 'react-native-svg';

// ─── Tema inline (usa tu theme.js real en producción) ──────────────────────
const C = {
  crema:       '#F5F0E8',
  arena:       '#EDE4D0',
  trigo:       '#C9A96E',
  miel:        '#B8864E',
  cafe:        '#7A5230',
  cacao:       '#3E2010',
  amarillo:    '#E8C94A',
  rosa:        '#F0BFBF',
  menta:       '#A8D5C2',
  cielo:       '#BDD4E8',
  textP:       '#2C1A0A',
  textS:       '#7A6248',
  textM:       '#B0937A',
  border:      '#E0D5C0',
  card:        '#FFFFFF',
  dangerBg:    '#FCEAEA',
  dangerText:  '#C05050',
  warnBg:      '#FDF6D8',
  warnText:    '#8A6A10',
  infoBg:      '#EBF4FC',
  infoText:    '#3A6A9A',
  successBg:   '#EBF7F2',
  successText: '#2A7A5A',
};

const { width: SW } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════════════════════
// DATOS MOCK — reemplazar con fetch real al ESP32 / AsyncStorage
// ═══════════════════════════════════════════════════════════════════════════

const MOCK_STATS = {
  hoy:    { sueno: '6h 20m', llantos: 2,  tempProm: '36.8°', tempMax: '37.4°', tempMaxAlta: true },
  semana: { sueno: '42h 10m', llantos: 9, tempProm: '36.7°', tempMax: '37.6°', tempMaxAlta: true },
  mes:    { sueno: '178h',   llantos: 31, tempProm: '36.6°', tempMax: '37.8°', tempMaxAlta: true },
};

// Puntos de temperatura para la gráfica (hora 0-8, temp 36-38)
const MOCK_TEMP_POINTS = [
  { h: 0, t: 36.7 }, { h: 1, t: 36.8 }, { h: 2, t: 36.6 },
  { h: 3, t: 37.1 }, { h: 4, t: 37.4 }, { h: 5, t: 37.2 },
  { h: 6, t: 36.9 }, { h: 7, t: 36.7 }, { h: 8, t: 36.6 },
];

// Bloques de sueño: { inicio 0-1, fin 0-1, dormido bool }
const MOCK_SUENO = [
  { inicio: 0.00, fin: 0.55, dormido: true  },
  { inicio: 0.55, fin: 0.62, dormido: false },
  { inicio: 0.62, fin: 0.78, dormido: true  },
  { inicio: 0.78, fin: 0.83, dormido: false },
  { inicio: 0.83, fin: 1.00, dormido: true  },
];

const MOCK_DIAS = {
  '-2': {
    label: 'dom 30 mar',
    eventos: [
      { id: '1', tipo: 'dormido',         detalle: '21:50 — 06:10 · 8h 20m',  color: C.menta,    bg: C.successBg },
      { id: '2', tipo: 'llanto',          detalle: '02:40 · 4 min',            color: C.rosa,     bg: C.dangerBg  },
      { id: '3', tipo: 'temp. elevada',   detalle: '09:15 · 37.2°C',           color: C.amarillo, bg: C.warnBg    },
      { id: '4', tipo: 'dormido',         detalle: '12:00 · siesta · 1h 10m',  color: C.menta,    bg: C.successBg },
    ],
  },
  '-1': {
    label: 'lun 31 mar',
    eventos: [
      { id: '1', tipo: 'dormido',          detalle: '22:10 — 06:30 · 8h 20m', color: C.menta,    bg: C.successBg },
      { id: '2', tipo: 'llanto',           detalle: '03:15 · 3 min',           color: C.rosa,     bg: C.dangerBg  },
      { id: '3', tipo: 'temp. elevada',    detalle: '08:42 · 37.4°C',          color: C.amarillo, bg: C.warnBg    },
      { id: '4', tipo: 'altura ajustada',  detalle: '10:05 · Mamá → 65 cm',    color: C.cielo,    bg: C.infoBg    },
      { id: '5', tipo: 'dormido',          detalle: '11:30 · siesta · 45 min', color: C.menta,    bg: C.successBg },
    ],
  },
  '0': {
    label: 'martes 1 abr',
    eventos: [
      { id: '1', tipo: 'dormido',          detalle: '22:05 — 06:25 · 8h 20m', color: C.menta,    bg: C.successBg },
      { id: '2', tipo: 'llanto',           detalle: '01:12 · 2 min',           color: C.rosa,     bg: C.dangerBg  },
      { id: '3', tipo: 'altura ajustada',  detalle: '08:30 · Papá → 80 cm',    color: C.cielo,    bg: C.infoBg    },
      { id: '4', tipo: 'temp. elevada',    detalle: '10:20 · 37.4°C',          color: C.amarillo, bg: C.warnBg    },
      { id: '5', tipo: 'dormido',          detalle: '11:45 · siesta · 1h',     color: C.menta,    bg: C.successBg },
      { id: '6', tipo: 'llanto',           detalle: '14:30 · 5 min',           color: C.rosa,     bg: C.dangerBg  },
    ],
  },
};

const MOCK_ALERTAS = [
  { id: '1', tipo: 'llanto detectado',    detalle: 'hoy · 1h 12min · 3 min',      color: C.dangerText, bg: C.dangerBg, cat: 'llanto'      },
  { id: '2', tipo: 'temperatura elevada', detalle: 'hoy · 08:42 · 37.4°C',        color: C.warnText,   bg: C.warnBg,   cat: 'temperatura' },
  { id: '3', tipo: 'altura ajustada',     detalle: 'hoy · 10:05 · Mamá 65cm',     color: C.infoText,   bg: C.infoBg,   cat: 'altura'      },
  { id: '4', tipo: 'llanto detectado',    detalle: 'ayer · 02:30 · 5 min',         color: C.dangerText, bg: C.dangerBg, cat: 'llanto'      },
  { id: '5', tipo: 'temperatura elevada', detalle: 'ayer · 22:15 · 37.1°C',        color: C.warnText,   bg: C.warnBg,   cat: 'temperatura' },
  { id: '6', tipo: 'llanto detectado',    detalle: 'ayer · 14:05 · 2 min',         color: C.dangerText, bg: C.dangerBg, cat: 'llanto'      },
  { id: '7', tipo: 'altura ajustada',     detalle: 'hace 2d · 09:00 · Papá 80cm', color: C.infoText,   bg: C.infoBg,   cat: 'altura'      },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE: Gráfica de temperatura con react-native-svg
// ═══════════════════════════════════════════════════════════════════════════

const TempChart = ({ points }) => {
  const W = SW - 64;
  const H = 100;
  const PAD = { t: 12, b: 4, l: 4, r: 4 };
  const minT = 36.0, maxT = 38.2;

  const px = (h) => PAD.l + (h / 8) * (W - PAD.l - PAD.r);
  const py = (t) => PAD.t + (1 - (t - minT) / (maxT - minT)) * (H - PAD.t - PAD.b);

  const polyPoints = points.map(p => `${px(p.h)},${py(p.t)}`).join(' ');
  const maxPoint   = points.reduce((a, b) => a.t > b.t ? a : b);

  return (
    <Svg width={W} height={H}>
      {/* Línea guía 37° */}
      <Line
        x1={PAD.l} y1={py(37)} x2={W - PAD.r} y2={py(37)}
        stroke={C.border} strokeWidth={1} strokeDasharray="4,3"
      />
      {/* Curva principal */}
      <Polyline
        points={polyPoints}
        fill="none" stroke={C.trigo} strokeWidth={2.5}
        strokeLinejoin="round" strokeLinecap="round"
      />
      {/* Punto máximo */}
      <Circle
        cx={px(maxPoint.h)} cy={py(maxPoint.t)}
        r={5} fill={C.miel} stroke={C.crema} strokeWidth={2}
      />
    </Svg>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// TAB: STATS
// ═══════════════════════════════════════════════════════════════════════════

const StatsTab = () => {
  const [filtro, setFiltro] = useState('hoy');
  const data = MOCK_STATS[filtro];

  return (
    <ScrollView contentContainerStyle={s.tabContent}>

      {/* Filtros hoy/semana/mes */}
      <View style={s.filtrosRow}>
        {['hoy', 'semana', 'mes'].map(f => (
          <TouchableOpacity
            key={f}
            style={[s.filtroBtn, { backgroundColor: filtro === f ? C.trigo : C.card, borderColor: C.border }]}
            onPress={() => setFiltro(f)}
          >
            <Text style={[s.filtroLabel, { color: filtro === f ? C.crema : C.textM }]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Grid de tarjetas */}
      <View style={s.statsGrid}>
        {[
          { label: 'sueño',       value: data.sueno,    highlight: false },
          { label: 'llantos',     value: data.llantos,  highlight: false },
          { label: 'temp. prom.', value: data.tempProm, highlight: false },
          { label: 'temp. máx.',  value: data.tempMax,  highlight: data.tempMaxAlta },
        ].map(item => (
          <View key={item.label} style={[s.statCard, { backgroundColor: C.card }]}>
            <Text style={[s.statLabel, { color: C.textM }]}>{item.label}</Text>
            <Text style={[s.statValue, { color: item.highlight ? '#E05020' : C.textP }]}>
              {item.value}
            </Text>
          </View>
        ))}
      </View>

      {/* Gráfica de temperatura */}
      <View style={[s.chartBox, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[s.sectionLabel, { color: C.textS }]}>temperatura · últimas 8h</Text>
        <TempChart points={MOCK_TEMP_POINTS} />
        <View style={s.chartXRow}>
          <Text style={[s.chartX, { color: C.textM }]}>22:00</Text>
          <Text style={[s.chartX, { color: C.textM }]}>06:00</Text>
        </View>
      </View>

      {/* Barra de sueño */}
      <View style={[s.sleepBox, { backgroundColor: C.card }]}>
        <Text style={[s.sectionLabel, { color: C.textS }]}>sueño · hoy</Text>
        <View style={s.sleepBar}>
          {MOCK_SUENO.map((bloque, i) => (
            <View
              key={i}
              style={[
                s.sleepSegment,
                {
                  flex: bloque.fin - bloque.inicio,
                  backgroundColor: bloque.dormido ? C.menta : C.rosa,
                },
              ]}
            />
          ))}
        </View>
        <View style={s.sleepLegend}>
          {[{ label: 'dormido', color: C.menta }, { label: 'despierto', color: C.rosa }].map(l => (
            <View key={l.label} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: l.color }]} />
              <Text style={[s.legendLabel, { color: C.textM }]}>{l.label}</Text>
            </View>
          ))}
        </View>
      </View>

    </ScrollView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// TAB: DIARIO
// ═══════════════════════════════════════════════════════════════════════════

const DiarioTab = () => {
  const [offset, setOffset] = useState(0);
  const MIN = -2;

  const dia = MOCK_DIAS[String(offset)] ?? { label: '—', eventos: [] };

  return (
    <ScrollView contentContainerStyle={s.tabContent}>

      {/* Navegación día */}
      <View style={[s.dayNav, { backgroundColor: C.card, borderColor: C.border }]}>
        <TouchableOpacity
          onPress={() => setOffset(o => Math.max(o - 1, MIN))}
          disabled={offset <= MIN}
          style={s.navBtn}
        >
          <Text style={[s.navArrow, { color: offset <= MIN ? C.border : C.textS }]}>← ant</Text>
        </TouchableOpacity>

        <Text style={[s.dayLabel, { color: C.textP }]}>{dia.label}</Text>

        <TouchableOpacity
          onPress={() => setOffset(o => Math.min(o + 1, 0))}
          disabled={offset >= 0}
          style={s.navBtn}
        >
          <Text style={[s.navArrow, { color: offset >= 0 ? C.border : C.textS }]}>sig →</Text>
        </TouchableOpacity>
      </View>

      {/* Línea de tiempo */}
      {dia.eventos.map((ev, idx) => (
        <View key={ev.id} style={s.eventoRow}>
          <View style={s.timelineCol}>
            <View style={[s.timelineDot, { backgroundColor: ev.color }]} />
            {idx < dia.eventos.length - 1 && (
              <View style={[s.timelineLine, { backgroundColor: C.border }]} />
            )}
          </View>
          <View style={[s.eventoCard, { backgroundColor: ev.bg, borderColor: ev.color + 'AA' }]}>
            <Text style={[s.eventoTipo, { color: C.textP }]}>{ev.tipo}</Text>
            <Text style={[s.eventoDetalle, { color: C.textS }]}>{ev.detalle}</Text>
          </View>
        </View>
      ))}

      {dia.eventos.length === 0 && (
        <View style={s.emptyState}>
          <Text style={[s.emptyText, { color: C.textM }]}>sin eventos este día</Text>
        </View>
      )}

    </ScrollView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// TAB: ALERTAS
// ═══════════════════════════════════════════════════════════════════════════

const AlertasTab = () => {
  const [filtro, setFiltro] = useState('todos');

  const lista = filtro === 'todos'
    ? MOCK_ALERTAS
    : MOCK_ALERTAS.filter(a => a.cat === filtro);

  return (
    <ScrollView contentContainerStyle={s.tabContent}>

      {/* Filtros horizontales */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={s.filtrosRowH}>
          {['todos', 'llanto', 'temperatura', 'altura'].map(f => (
            <TouchableOpacity
              key={f}
              style={[s.filtroBtn, { backgroundColor: filtro === f ? C.trigo : C.card, borderColor: C.border }]}
              onPress={() => setFiltro(f)}
            >
              <Text style={[s.filtroLabel, { color: filtro === f ? C.crema : C.textM }]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Lista de alertas */}
      {lista.map(alerta => (
        <View key={alerta.id} style={[s.alertaCard, { backgroundColor: alerta.bg, borderColor: alerta.color + '80' }]}>
          <Text style={[s.alertaTipo, { color: alerta.color }]}>{alerta.tipo}</Text>
          <Text style={[s.alertaDetalle, { color: C.textS }]}>{alerta.detalle}</Text>
        </View>
      ))}

      {lista.length === 0 && (
        <View style={s.emptyState}>
          <Text style={[s.emptyText, { color: C.textM }]}>sin alertas de este tipo</Text>
        </View>
      )}

    </ScrollView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CONTENEDOR PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

const HistorialScreen = () => {
  const [activeTab, setActiveTab] = useState('stats');

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.crema }]}>

      <View style={s.header}>
        <Text style={s.title}>historial</Text>
      </View>

      <View style={[s.tabBar, { backgroundColor: C.card, borderColor: C.border }]}>
        {['stats', 'diario', 'alertas'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[s.tabBtn, activeTab === tab && { backgroundColor: C.trigo }]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[s.tabLabel, { color: activeTab === tab ? C.crema : C.textM }]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'stats'   && <StatsTab />}
      {activeTab === 'diario'  && <DiarioTab />}
      {activeTab === 'alertas' && <AlertasTab />}

    </SafeAreaView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// ESTILOS
// ═══════════════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  safe:         { flex: 1 },
  header:       { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title:        { fontSize: 22, fontWeight: '600', letterSpacing: -0.5, color: '#2C1A0A' },

  // Tab bar principal
  tabBar:       { flexDirection: 'row', marginHorizontal: 16, borderRadius: 999, borderWidth: 1, padding: 3, gap: 2, marginBottom: 4 },
  tabBtn:       { flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: 'center' },
  tabLabel:     { fontSize: 13, fontWeight: '500' },

  // Contenido de tabs
  tabContent:   { padding: 16, gap: 12, paddingBottom: 32 },

  // Filtros
  filtrosRow:   { flexDirection: 'row', gap: 8 },
  filtrosRowH:  { flexDirection: 'row', gap: 8, paddingRight: 16 },
  filtroBtn:    { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  filtroLabel:  { fontSize: 13, fontWeight: '500' },

  // Tarjetas stats
  statsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard:     { width: '47.5%', borderRadius: 12, padding: 14, gap: 4 },
  statLabel:    { fontSize: 11 },
  statValue:    { fontSize: 24, fontWeight: '600', letterSpacing: -0.5 },

  // Gráfica
  chartBox:     { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  sectionLabel: { fontSize: 13 },
  chartXRow:    { flexDirection: 'row', justifyContent: 'space-between' },
  chartX:       { fontSize: 11 },

  // Barra de sueño
  sleepBox:     { borderRadius: 14, padding: 14, gap: 10 },
  sleepBar:     { height: 14, borderRadius: 7, overflow: 'hidden', flexDirection: 'row' },
  sleepSegment: { height: '100%' },
  sleepLegend:  { flexDirection: 'row', gap: 20 },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:    { width: 8, height: 8, borderRadius: 4 },
  legendLabel:  { fontSize: 11 },

  // Diario — navegación
  dayNav:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  navBtn:       { paddingVertical: 4, paddingHorizontal: 4 },
  navArrow:     { fontSize: 13, fontWeight: '500' },
  dayLabel:     { fontSize: 15, fontWeight: '600' },

  // Diario — timeline
  eventoRow:    { flexDirection: 'row', gap: 10, minHeight: 60 },
  timelineCol:  { width: 18, alignItems: 'center', paddingTop: 14 },
  timelineDot:  { width: 10, height: 10, borderRadius: 5 },
  timelineLine: { flex: 1, width: 2, marginTop: 4 },
  eventoCard:   { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, gap: 3 },
  eventoTipo:   { fontSize: 14, fontWeight: '500' },
  eventoDetalle:{ fontSize: 12 },

  // Alertas
  alertaCard:   { borderRadius: 12, borderWidth: 1, padding: 14, gap: 4 },
  alertaTipo:   { fontSize: 14, fontWeight: '600' },
  alertaDetalle:{ fontSize: 12 },

  // Estado vacío
  emptyState:   { alignItems: 'center', paddingVertical: 40 },
  emptyText:    { fontSize: 13 },
});

export default HistorialScreen;