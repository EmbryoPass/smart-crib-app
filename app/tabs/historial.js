// app/tabs/historial.js — Capullo App
// Pantalla HISTORIAL conectada a datos reales via SensorContext
// Ya no usa mocks para stats — lee directamente de Firebase a través del contexto

import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polyline, Line, Circle } from 'react-native-svg';
import Colors from '../constants/colors';
import { useSensor } from '../constants/SensorContext';

const { width: SW } = Dimensions.get('window');

// ─── Paleta local (usa tus Colors si prefieres) ───────────────────────────
const C = {
  menta:      '#A8D5C2',
  rosa:       '#F0BFBF',
  amarillo:   '#E8C94A',
  cielo:      '#BDD4E8',
  dangerBg:   '#FCEAEA',
  dangerText: '#C05050',
  warnBg:     '#FDF6D8',
  warnText:   '#8A6A10',
  infoBg:     '#EBF4FC',
  infoText:   '#3A6A9A',
  successBg:  '#EBF7F2',
  successText:'#2A7A5A',
};

// ─── Mocks de diario y alertas (conectar a Firebase cuando tengan el nodo) ──
const MOCK_DIAS = {
  '-2': {
    label: 'dom 30 mar',
    eventos: [
      { id: '1', tipo: 'dormido',        detalle: '21:50 — 06:10 · 8h 20m', color: C.menta,    bg: C.successBg },
      { id: '2', tipo: 'llanto',         detalle: '02:40 · 4 min',           color: C.rosa,     bg: C.dangerBg  },
      { id: '3', tipo: 'temp. elevada',  detalle: '09:15 · 37.2°C',          color: C.amarillo, bg: C.warnBg    },
      { id: '4', tipo: 'dormido',        detalle: '12:00 · siesta · 1h 10m', color: C.menta,    bg: C.successBg },
    ],
  },
  '-1': {
    label: 'lun 31 mar',
    eventos: [
      { id: '1', tipo: 'dormido',         detalle: '22:10 — 06:30 · 8h 20m', color: C.menta,    bg: C.successBg },
      { id: '2', tipo: 'llanto',          detalle: '03:15 · 3 min',           color: C.rosa,     bg: C.dangerBg  },
      { id: '3', tipo: 'temp. elevada',   detalle: '08:42 · 37.4°C',          color: C.amarillo, bg: C.warnBg    },
      { id: '4', tipo: 'altura ajustada', detalle: '10:05 · Mamá → 65 cm',    color: C.cielo,    bg: C.infoBg    },
      { id: '5', tipo: 'dormido',         detalle: '11:30 · siesta · 45 min', color: C.menta,    bg: C.successBg },
    ],
  },
  '0': {
    label: 'hoy',
    eventos: [
      { id: '1', tipo: 'dormido',         detalle: '22:05 — 06:25 · 8h 20m', color: C.menta,    bg: C.successBg },
      { id: '2', tipo: 'llanto',          detalle: '01:12 · 2 min',           color: C.rosa,     bg: C.dangerBg  },
      { id: '3', tipo: 'altura ajustada', detalle: '08:30 · Papá → 80 cm',    color: C.cielo,    bg: C.infoBg    },
      { id: '4', tipo: 'temp. elevada',   detalle: '10:20 · 37.4°C',          color: C.amarillo, bg: C.warnBg    },
      { id: '5', tipo: 'dormido',         detalle: '11:45 · siesta · 1h',     color: C.menta,    bg: C.successBg },
    ],
  },
};

const MOCK_ALERTAS = [
  { id: '1', tipo: 'llanto detectado',    detalle: 'hoy · 1h 12min · 3 min',      color: C.dangerText, bg: C.dangerBg, cat: 'llanto'      },
  { id: '2', tipo: 'temperatura elevada', detalle: 'hoy · 08:42 · 37.4°C',        color: C.warnText,   bg: C.warnBg,   cat: 'temperatura' },
  { id: '3', tipo: 'altura ajustada',     detalle: 'hoy · 10:05 · Mamá 65cm',     color: C.infoText,   bg: C.infoBg,   cat: 'altura'      },
  { id: '4', tipo: 'llanto detectado',    detalle: 'ayer · 02:30 · 5 min',         color: C.dangerText, bg: C.dangerBg, cat: 'llanto'      },
  { id: '5', tipo: 'temperatura elevada', detalle: 'ayer · 22:15 · 37.1°C',        color: C.warnText,   bg: C.warnBg,   cat: 'temperatura' },
];

// ═══════════════════════════════════════════════════════════════════════════
// Gráfica SVG de temperatura
// ═══════════════════════════════════════════════════════════════════════════

const TempChart = ({ puntos }) => {
  const W = SW - 64;
  const H = 100;
  const PAD = { t: 12, b: 4, l: 4, r: 4 };
  const minT = 36.0, maxT = 38.2;

  if (!puntos || puntos.length < 2) {
    return (
      <View style={{ height: H, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: Colors.textTertiary, fontSize: 13 }}>
          acumulando datos...
        </Text>
      </View>
    );
  }

  const px = (h) => PAD.l + (h / (puntos.length - 1)) * (W - PAD.l - PAD.r);
  const py = (t) => PAD.t + (1 - (t - minT) / (maxT - minT)) * (H - PAD.t - PAD.b);
  const polyPoints = puntos.map((p, i) => `${px(i)},${py(p.t)}`).join(' ');
  const maxPoint   = puntos.reduce((a, b) => a.t > b.t ? a : b);
  const maxIdx     = puntos.indexOf(maxPoint);

  return (
    <Svg width={W} height={H}>
      <Line x1={PAD.l} y1={py(37)} x2={W - PAD.r} y2={py(37)}
        stroke={Colors.brownPale} strokeWidth={1} strokeDasharray="4,3" />
      <Polyline points={polyPoints} fill="none" stroke={Colors.brown}
        strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={px(maxIdx)} cy={py(maxPoint.t)}
        r={5} fill={Colors.brownLight} stroke={Colors.bgCard} strokeWidth={2} />
    </Svg>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Tarjeta de resumen inteligente — genera el texto según datos reales
// ═══════════════════════════════════════════════════════════════════════════

const generarResumen = (filtro, stats) => {
  // Si no hay datos aún, resumen genérico
  if (!stats) return {
    emoji: '📡',
    titulo: 'sin datos aún',
    tono: 'neutro',
    lineas: [
      { icono: '💡', texto: 'el historial se genera automáticamente mientras el sensor esté conectado.' },
    ],
  };

  const { sueno, tempMax, tempMaxAlta, ambProm, humProm } = stats;
  const tono = tempMaxAlta ? 'alerta' : 'positivo';

  const resumenes = {
    hoy: {
      emoji: tempMaxAlta ? '🌡️' : '😴',
      titulo: tempMaxAlta ? 'temperatura elevada hoy' : 'buen día hasta ahora',
      tono,
      lineas: [
        { icono: '🌙', texto: `el bebé estuvo en cuna aproximadamente ${sueno}.` },
        { icono: '🌡️', texto: `temperatura máxima detectada: ${tempMax}${tempMaxAlta ? ' — por encima de 37.2°.' : ', dentro del rango normal.'}` },
        ambProm  ? { icono: '🏠', texto: `temperatura del cuarto: ${ambProm}°C en promedio.` } : null,
        humProm  ? { icono: '💧', texto: `humedad del cuarto: ${humProm}% en promedio.` }       : null,
      ].filter(Boolean),
    },
    semana: {
      emoji: '📊',
      titulo: 'resumen de la semana',
      tono: 'neutro',
      lineas: [
        { icono: '🌙', texto: `en total, ${sueno} con el bebé en cuna esta semana.` },
        { icono: '🌡️', texto: `temperatura máxima de la semana: ${tempMax}${tempMaxAlta ? ' — hubo momentos de calor elevado.' : '.'}` },
        ambProm ? { icono: '🏠', texto: `el cuarto se mantuvo en promedio a ${ambProm}°C.` }    : null,
        humProm ? { icono: '💧', texto: `humedad promedio del cuarto: ${humProm}%.` }             : null,
      ].filter(Boolean),
    },
    mes: {
      emoji: '📈',
      titulo: 'resumen del mes',
      tono,
      lineas: [
        { icono: '🌙', texto: `tiempo total con bebé en cuna este mes: ${sueno}.` },
        { icono: '🌡️', texto: `temperatura máxima registrada: ${tempMax}${tempMaxAlta ? ' — revisar condiciones del cuarto.' : ', sin picos preocupantes.'}` },
        ambProm ? { icono: '🏠', texto: `el cuarto promedió ${ambProm}°C de temperatura ambiente.` } : null,
        humProm ? { icono: '💧', texto: `humedad mensual promedio: ${humProm}%.` }                    : null,
      ].filter(Boolean),
    },
  };

  return resumenes[filtro];
};

const TONO_COLORS = {
  positivo: { bg: C.successBg, border: C.menta,    titulo: C.successText },
  neutro:   { bg: '#F5F0E8',   border: '#E0D5C0',  titulo: Colors.textSecondary },
  alerta:   { bg: C.warnBg,    border: C.amarillo, titulo: C.warnText    },
};

const ResumenCard = ({ filtro, stats }) => {
  const resumen = generarResumen(filtro, stats);
  const colores = TONO_COLORS[resumen.tono];

  return (
    <View style={[rs.card, { backgroundColor: colores.bg, borderColor: colores.border }]}>
      <View style={rs.header}>
        <Text style={rs.emoji}>{resumen.emoji}</Text>
        <View style={rs.headerTexts}>
          <Text style={[rs.titulo, { color: colores.titulo }]}>{resumen.titulo}</Text>
          <Text style={[rs.subtitulo, { color: Colors.textTertiary }]}>resumen · {filtro}</Text>
        </View>
      </View>
      <View style={[rs.divider, { backgroundColor: colores.border }]} />
      {resumen.lineas.map((linea, i) => (
        <View key={i} style={rs.lineaRow}>
          <Text style={rs.lineaIcono}>{linea.icono}</Text>
          <Text style={[rs.lineaTexto, { color: Colors.textSecondary }]}>{linea.texto}</Text>
        </View>
      ))}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// TAB: STATS
// ═══════════════════════════════════════════════════════════════════════════

const StatsTab = () => {
  const [filtro, setFiltro] = useState('hoy');
  const { statsHoy, statsSemana, statsMes } = useSensor();

  const stats = { hoy: statsHoy, semana: statsSemana, mes: statsMes }[filtro];

  // Puntos de gráfica: del contexto si existen, si no array vacío
  const puntos = stats?.puntos ?? [];

  return (
    <ScrollView contentContainerStyle={s.tabContent}>

      {/* Filtros */}
      <View style={s.filtrosRow}>
        {['hoy', 'semana', 'mes'].map(f => (
          <TouchableOpacity
            key={f}
            style={[s.filtroBtn, { backgroundColor: filtro === f ? Colors.brown : Colors.bgCard, borderColor: Colors.brownPale }]}
            onPress={() => setFiltro(f)}
          >
            <Text style={[s.filtroLabel, { color: filtro === f ? '#F5F0E8' : Colors.textSecondary }]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tarjetas stats — datos reales del contexto */}
      <View style={s.statsGrid}>
        {[
          { label: 'bebé en cuna',  value: stats?.sueno    ?? '--',   highlight: false },
          { label: 'temp. prom.',   value: stats?.tempProm ?? '--',   highlight: false },
          { label: 'temp. máx.',    value: stats?.tempMax  ?? '--',   highlight: stats?.tempMaxAlta },
          { label: 'ambiente',      value: stats?.ambProm  ? `${stats.ambProm}°C` : '--', highlight: false },
        ].map(item => (
          <View key={item.label} style={[s.statCard, { backgroundColor: Colors.bgCard }]}>
            <Text style={[s.statLabel, { color: Colors.textSecondary }]}>{item.label}</Text>
            <Text style={[s.statValue, { color: item.highlight ? '#E05020' : Colors.brown }]}>
              {item.value}
            </Text>
          </View>
        ))}
      </View>

      {/* Gráfica temperatura real */}
      <View style={[s.chartBox, { backgroundColor: Colors.bgCard, borderColor: Colors.brownPale }]}>
        <Text style={[s.sectionLabel, { color: Colors.textSecondary }]}>temperatura del bebé</Text>
        <TempChart puntos={puntos} />
        <View style={s.chartXRow}>
          <Text style={[s.chartX, { color: Colors.textTertiary }]}>inicio</Text>
          <Text style={[s.chartX, { color: Colors.textTertiary }]}>ahora</Text>
        </View>
      </View>

      {/* Resumen inteligente con datos reales */}
      <ResumenCard filtro={filtro} stats={stats} />

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
  // TODO: reemplazar MOCK_DIAS con nodo /historial/dias en Firebase

  return (
    <ScrollView contentContainerStyle={s.tabContent}>
      <View style={[s.dayNav, { backgroundColor: Colors.bgCard, borderColor: Colors.brownPale }]}>
        <TouchableOpacity
          onPress={() => setOffset(o => Math.max(o - 1, MIN))}
          disabled={offset <= MIN} style={s.navBtn}
        >
          <Text style={[s.navArrow, { color: offset <= MIN ? Colors.brownPale : Colors.textSecondary }]}>← ant</Text>
        </TouchableOpacity>
        <Text style={[s.dayLabel, { color: Colors.brown }]}>{dia.label}</Text>
        <TouchableOpacity
          onPress={() => setOffset(o => Math.min(o + 1, 0))}
          disabled={offset >= 0} style={s.navBtn}
        >
          <Text style={[s.navArrow, { color: offset >= 0 ? Colors.brownPale : Colors.textSecondary }]}>sig →</Text>
        </TouchableOpacity>
      </View>

      {dia.eventos.map((ev, idx) => (
        <View key={ev.id} style={s.eventoRow}>
          <View style={s.timelineCol}>
            <View style={[s.timelineDot, { backgroundColor: ev.color }]} />
            {idx < dia.eventos.length - 1 && (
              <View style={[s.timelineLine, { backgroundColor: Colors.brownPale }]} />
            )}
          </View>
          <View style={[s.eventoCard, { backgroundColor: ev.bg, borderColor: ev.color + 'AA' }]}>
            <Text style={[s.eventoTipo, { color: Colors.brown }]}>{ev.tipo}</Text>
            <Text style={[s.eventoDetalle, { color: Colors.textSecondary }]}>{ev.detalle}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// TAB: ALERTAS
// ═══════════════════════════════════════════════════════════════════════════

const AlertasTab = () => {
  const [filtro, setFiltro] = useState('todos');
  // TODO: reemplazar MOCK_ALERTAS con nodo /historial/alertas en Firebase
  const lista = filtro === 'todos' ? MOCK_ALERTAS : MOCK_ALERTAS.filter(a => a.cat === filtro);

  return (
    <ScrollView contentContainerStyle={s.tabContent}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={s.filtrosRowH}>
          {['todos', 'llanto', 'temperatura', 'altura'].map(f => (
            <TouchableOpacity
              key={f}
              style={[s.filtroBtn, { backgroundColor: filtro === f ? Colors.brown : Colors.bgCard, borderColor: Colors.brownPale }]}
              onPress={() => setFiltro(f)}
            >
              <Text style={[s.filtroLabel, { color: filtro === f ? '#F5F0E8' : Colors.textSecondary }]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {lista.map(alerta => (
        <View key={alerta.id} style={[s.alertaCard, { backgroundColor: alerta.bg, borderColor: alerta.color + '80' }]}>
          <Text style={[s.alertaTipo, { color: alerta.color }]}>{alerta.tipo}</Text>
          <Text style={[s.alertaDetalle, { color: Colors.textSecondary }]}>{alerta.detalle}</Text>
        </View>
      ))}

      {lista.length === 0 && (
        <View style={s.emptyState}>
          <Text style={[s.emptyText, { color: Colors.textTertiary }]}>sin alertas de este tipo</Text>
        </View>
      )}
    </ScrollView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CONTENEDOR PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function Historial() {
  const [activeTab, setActiveTab] = useState('stats');

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: Colors.bg }]} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>historial</Text>
      </View>

      <View style={[s.tabBar, { backgroundColor: Colors.bgCard, borderColor: Colors.brownPale }]}>
        {['stats', 'diario', 'alertas'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[s.tabBtn, activeTab === tab && { backgroundColor: Colors.brown }]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[s.tabLabel, { color: activeTab === tab ? '#F5F0E8' : Colors.textSecondary }]}>
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
}

// ═══════════════════════════════════════════════════════════════════════════
// ESTILOS
// ═══════════════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  safe:         { flex: 1 },
  header:       { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title:        { fontSize: 22, fontWeight: '600', letterSpacing: -0.5, color: Colors.brown },
  tabBar:       { flexDirection: 'row', marginHorizontal: 16, borderRadius: 999, borderWidth: 1, padding: 3, gap: 2, marginBottom: 4 },
  tabBtn:       { flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: 'center' },
  tabLabel:     { fontSize: 13, fontWeight: '500' },
  tabContent:   { padding: 16, gap: 12, paddingBottom: 100 },
  filtrosRow:   { flexDirection: 'row', gap: 8 },
  filtrosRowH:  { flexDirection: 'row', gap: 8, paddingRight: 16 },
  filtroBtn:    { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  filtroLabel:  { fontSize: 13, fontWeight: '500' },
  statsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard:     { width: '47.5%', borderRadius: 12, padding: 14, gap: 4 },
  statLabel:    { fontSize: 11 },
  statValue:    { fontSize: 24, fontWeight: '600', letterSpacing: -0.5 },
  chartBox:     { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  sectionLabel: { fontSize: 13 },
  chartXRow:    { flexDirection: 'row', justifyContent: 'space-between' },
  chartX:       { fontSize: 11 },
  dayNav:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  navBtn:       { paddingVertical: 4, paddingHorizontal: 4 },
  navArrow:     { fontSize: 13, fontWeight: '500' },
  dayLabel:     { fontSize: 15, fontWeight: '600' },
  eventoRow:    { flexDirection: 'row', gap: 10, minHeight: 60 },
  timelineCol:  { width: 18, alignItems: 'center', paddingTop: 14 },
  timelineDot:  { width: 10, height: 10, borderRadius: 5 },
  timelineLine: { flex: 1, width: 2, marginTop: 4 },
  eventoCard:   { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, gap: 3 },
  eventoTipo:   { fontSize: 14, fontWeight: '500' },
  eventoDetalle:{ fontSize: 12 },
  alertaCard:   { borderRadius: 12, borderWidth: 1, padding: 14, gap: 4 },
  alertaTipo:   { fontSize: 14, fontWeight: '600' },
  alertaDetalle:{ fontSize: 12 },
  emptyState:   { alignItems: 'center', paddingVertical: 40 },
  emptyText:    { fontSize: 13 },
});

const rs = StyleSheet.create({
  card:        { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emoji:       { fontSize: 28 },
  headerTexts: { gap: 2 },
  titulo:      { fontSize: 15, fontWeight: '700', letterSpacing: -0.3 },
  subtitulo:   { fontSize: 11 },
  divider:     { height: 1, borderRadius: 1 },
  lineaRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  lineaIcono:  { fontSize: 14, marginTop: 1 },
  lineaTexto:  { flex: 1, fontSize: 13, lineHeight: 19 },
});