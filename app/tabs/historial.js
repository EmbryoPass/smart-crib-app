// app/tabs/historial.js — Capullo App
import { useState, useEffect } from 'react';
import { useRoute } from '@react-navigation/native';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Dimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polyline, Line, Circle, Text as SvgText } from 'react-native-svg';
import {
  getDatabase, ref, onValue,
  query, orderByChild, limitToLast,
} from 'firebase/database';
import Colors from '../constants/colors';
import { useSensor } from '../constants/SensorContext';

const { width: SW } = Dimensions.get('window');

const C = {
  menta:       '#A8D5C2',
  rosa:        '#F0BFBF',
  amarillo:    '#E8C94A',
  cielo:       '#BDD4E8',
  dangerBg:    '#FCEAEA',
  dangerText:  '#C05050',
  warnBg:      '#FDF6D8',
  warnText:    '#8A6A10',
  infoBg:      '#EBF4FC',
  infoText:    '#3A6A9A',
  successBg:   '#EBF7F2',
  successText: '#2A7A5A',
};

const TIPO_META = {
  'llanto':          { color: C.rosa,     bg: C.dangerBg },
  'temp. elevada':   { color: C.amarillo, bg: C.warnBg   },
  'altura ajustada': { color: C.cielo,    bg: C.infoBg   },
};

const ALERTA_META = {
  llanto:      { color: C.dangerText, bg: C.dangerBg },
  temperatura: { color: C.warnText,   bg: C.warnBg   },
  altura:      { color: C.infoText,   bg: C.infoBg   },
};

const offsetToIso = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

const isoToLabel = (iso) => {
  const hoy  = new Date().toISOString().slice(0, 10);
  const ayer = (() => {
    const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10);
  })();
  if (iso === hoy)  return 'hoy';
  if (iso === ayer) return 'ayer';
  const d = new Date(iso + 'T12:00:00');
  const DS = ['dom','lun','mar','mié','jue','vie','sáb'];
  const MS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${DS[d.getDay()]} ${d.getDate()} ${MS[d.getMonth()]}`;
};

const fmtHora = (ts) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};

const useEventosDia = (isoDate) => {
  const [eventos, setEventos] = useState(null);
  const [error,   setError  ] = useState(null);

  useEffect(() => {
    if (!isoDate) return;
    const db    = getDatabase();
    const r     = ref(db, `eventos/${isoDate}`);
    const unsub = onValue(r, (snap) => {
      if (!snap.exists()) { setEventos([]); return; }
      const arr = Object.entries(snap.val())
        .map(([id, v]) => {
          const meta = TIPO_META[v.tipo] ?? { color: Colors.brownPale, bg: Colors.bgCard };
          return { id, tipo: v.tipo ?? 'evento', detalle: v.detalle ?? '', color: meta.color, bg: meta.bg, ts: v.ts ?? 0 };
        })
        .sort((a, b) => a.ts - b.ts);
      setEventos(arr);
      setError(null);
    }, (err) => setError(err));
    return unsub;
  }, [isoDate]);

  return { eventos, error };
};

const useAlertas = () => {
  const [alertas, setAlertas] = useState(null);
  const [error,   setError  ] = useState(null);

  useEffect(() => {
    const db    = getDatabase();
    const r     = query(ref(db, 'alertas'), orderByChild('ts'), limitToLast(50));
    const unsub = onValue(r, (snap) => {
      if (!snap.exists()) { setAlertas([]); return; }
      const arr = Object.entries(snap.val())
        .map(([id, v]) => {
          const meta = ALERTA_META[v.cat] ?? { color: Colors.textSecondary, bg: Colors.bgCard };
          return { id, tipo: v.tipo ?? 'alerta', detalle: v.detalle ?? '', cat: v.cat ?? 'otro', color: meta.color, bg: meta.bg, ts: v.ts ?? 0 };
        })
        .sort((a, b) => b.ts - a.ts);
      setAlertas(arr);
      setError(null);
    }, (err) => setError(err));
    return unsub;
  }, []);

  return { alertas, error };
};

// ═══════════════════════════════════════════════════════════════════════════
// Gráfica SVG
// ═══════════════════════════════════════════════════════════════════════════
const TempChart = ({ puntos }) => {
  const W = SW - 64, H = 118;
  const PAD = { t: 12, b: 20, l: 4, r: 4 };
  const minT = 36.0, maxT = 38.2;

  if (!puntos || puntos.length < 2) {
    return (
      <View style={{ height: H, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: Colors.textTertiary, fontSize: 13 }}>acumulando datos…</Text>
      </View>
    );
  }

  const px = (i) => PAD.l + (i / (puntos.length - 1)) * (W - PAD.l - PAD.r);
  const py = (t) => PAD.t + (1 - (t - minT) / (maxT - minT)) * (H - PAD.t - PAD.b);
  const polyPoints = puntos.map((p, i) => `${px(i)},${py(p.t)}`).join(' ');
  const maxIdx = puntos.reduce((best, p, i) => p.t > puntos[best].t ? i : best, 0);
  const maxP   = puntos[maxIdx];
  const hasTimes = Boolean(puntos[0]?.ts);
  const midIdx   = Math.floor(puntos.length / 2);
  const xLabels  = hasTimes
    ? [0, midIdx, puntos.length - 1].map(i => ({ x: px(i), label: fmtHora(puntos[i].ts) }))
    : [{ x: px(0), label: 'inicio' }, { x: px(puntos.length - 1), label: 'ahora' }];

  return (
    <Svg width={W} height={H}>
      <Line x1={PAD.l} y1={py(37)} x2={W - PAD.r} y2={py(37)}
        stroke={Colors.brownPale} strokeWidth={1} strokeDasharray="4,3" />
      <Line x1={PAD.l} y1={py(37.2)} x2={W - PAD.r} y2={py(37.2)}
        stroke={C.amarillo + '99'} strokeWidth={1} strokeDasharray="3,4" />
      <Polyline points={polyPoints} fill="none" stroke={Colors.brown}
        strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={px(maxIdx)} cy={py(maxP.t)} r={5}
        fill={maxP.t > 37.2 ? C.amarillo : Colors.brownLight}
        stroke={Colors.bgCard} strokeWidth={2} />
      {xLabels.map((l, i) => (
        <SvgText key={i} x={l.x} y={H - 3}
          textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}
          fontSize="10" fill={Colors.textTertiary}>
          {l.label}
        </SvgText>
      ))}
    </Svg>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Resumen inteligente
// ═══════════════════════════════════════════════════════════════════════════
const generarResumen = (filtro, stats) => {
  if (!stats) return {
    emoji: '📡', titulo: 'sin datos aún', tono: 'neutro',
    lineas: [{ icono: '💡', texto: 'el historial se genera automáticamente mientras el sensor esté conectado.' }],
  };

  const { sueno, tempMax, tempMaxAlta, ambProm, humProm } = stats;
  const tono = tempMaxAlta ? 'alerta' : 'positivo';

  const base = {
    hoy: {
      emoji: tempMaxAlta ? '🌡️' : '😴',
      titulo: tempMaxAlta ? 'temperatura elevada hoy' : 'buen día hasta ahora',
      tono,
      lineas: [
        { icono: '🌙', texto: `el bebé estuvo en cuna aproximadamente ${sueno}.` },
        { icono: '🌡️', texto: `temperatura máxima: ${tempMax}${tempMaxAlta ? ' — por encima de 37.2°.' : ', dentro del rango normal.'}` },
        ambProm ? { icono: '🏠', texto: `cuarto a ${ambProm}°C en promedio.` } : null,
        humProm ? { icono: '💧', texto: `humedad del cuarto: ${humProm}% en promedio.` } : null,
      ].filter(Boolean),
    },
    semana: {
      emoji: '📊', titulo: 'resumen de la semana', tono: 'neutro',
      lineas: [
        { icono: '🌙', texto: `${sueno} con el bebé en cuna esta semana.` },
        { icono: '🌡️', texto: `temperatura máxima: ${tempMax}${tempMaxAlta ? ' — hubo momentos de calor elevado.' : '.'}` },
        ambProm ? { icono: '🏠', texto: `cuarto en promedio a ${ambProm}°C.` } : null,
        humProm ? { icono: '💧', texto: `humedad promedio: ${humProm}%.` }      : null,
      ].filter(Boolean),
    },
    mes: {
      emoji: '📈', titulo: 'resumen del mes', tono,
      lineas: [
        { icono: '🌙', texto: `tiempo total en cuna este mes: ${sueno}.` },
        { icono: '🌡️', texto: `temperatura máxima registrada: ${tempMax}${tempMaxAlta ? ' — revisar condiciones del cuarto.' : ', sin picos preocupantes.'}` },
        ambProm ? { icono: '🏠', texto: `cuarto promedió ${ambProm}°C.` }        : null,
        humProm ? { icono: '💧', texto: `humedad mensual promedio: ${humProm}%.` } : null,
      ].filter(Boolean),
    },
  };

  return base[filtro];
};

const TONO_COLORS = {
  positivo: { bg: C.successBg, border: C.menta,    titulo: C.successText        },
  neutro:   { bg: '#F5F0E8',   border: '#E0D5C0',  titulo: Colors.textSecondary },
  alerta:   { bg: C.warnBg,    border: C.amarillo, titulo: C.warnText           },
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

const EmptyState = ({ emoji = '🔍', texto, hint, errorColor }) => (
  <View style={s.emptyState}>
    <Text style={{ fontSize: 32 }}>{emoji}</Text>
    <Text style={[s.emptyText, { color: errorColor ?? Colors.textTertiary, marginTop: 8 }]}>{texto}</Text>
    {hint ? <Text style={[s.emptyHint, { color: Colors.textTertiary }]}>{hint}</Text> : null}
  </View>
);

// ═══════════════════════════════════════════════════════════════════════════
// TAB: STATS
// ═══════════════════════════════════════════════════════════════════════════
const StatsTab = () => {
  const [filtro, setFiltro] = useState('hoy');
  const { statsHoy, statsSemana, statsMes } = useSensor();
  const stats  = { hoy: statsHoy, semana: statsSemana, mes: statsMes }[filtro];
  const puntos = stats?.puntos ?? [];

  const TARJETAS = [
    { label: 'bebé en cuna',   value: stats?.sueno   ?? '—',                         highlight: false,              icon: '🌙' },
    { label: 'temp. máx.',     value: stats?.tempMax ?? '—',                         highlight: stats?.tempMaxAlta, icon: '🌡️' },
    { label: 'temp. ambiente', value: stats?.ambProm ? `${stats.ambProm}°C` : '—',  highlight: false,              icon: '🏠' },
    { label: 'humedad',        value: stats?.humProm ? `${stats.humProm}%`  : '—',  highlight: false,              icon: '💧' },
  ];

  return (
    <ScrollView contentContainerStyle={s.tabContent}>
      <View style={s.filtrosRow}>
        {['hoy', 'semana', 'mes'].map(f => (
          <TouchableOpacity key={f}
            style={[s.filtroBtn, { backgroundColor: filtro === f ? Colors.brown : Colors.bgCard, borderColor: Colors.brownPale }]}
            onPress={() => setFiltro(f)}>
            <Text style={[s.filtroLabel, { color: filtro === f ? '#F5F0E8' : Colors.textSecondary }]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.statsGrid}>
        {TARJETAS.map(item => (
          <View key={item.label} style={[s.statCard, { backgroundColor: Colors.bgCard }]}>
            <Text style={s.statIcon}>{item.icon}</Text>
            <Text style={[s.statLabel, { color: Colors.textSecondary }]}>{item.label}</Text>
            <Text style={[s.statValue, { color: item.highlight ? '#E05020' : Colors.brown }]}>{item.value}</Text>
          </View>
        ))}
      </View>

      <View style={[s.chartBox, { backgroundColor: Colors.bgCard, borderColor: Colors.brownPale }]}>
        <View style={s.chartHeader}>
          <Text style={[s.sectionLabel, { color: Colors.textSecondary }]}>zona caliente</Text>
          <View style={s.chartLegend}>
            <View style={[s.legendDot, { backgroundColor: Colors.brownPale }]} />
            <Text style={[s.legendLabel, { color: Colors.textTertiary }]}>37.0°</Text>
            <View style={[s.legendDot, { backgroundColor: C.amarillo }]} />
            <Text style={[s.legendLabel, { color: Colors.textTertiary }]}>37.2°</Text>
          </View>
        </View>
        <TempChart puntos={puntos} />
      </View>

      <ResumenCard filtro={filtro} stats={stats} />
    </ScrollView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// TAB: DIARIO
// ═══════════════════════════════════════════════════════════════════════════
const DiarioTab = () => {
  const [offset, setOffset] = useState(0);
  const MIN = -6;
  const isoDate = offsetToIso(offset);
  const label   = isoToLabel(isoDate);
  const { eventos, error } = useEventosDia(isoDate);

  return (
    <ScrollView contentContainerStyle={s.tabContent}>
      <View style={[s.dayNav, { backgroundColor: Colors.bgCard, borderColor: Colors.brownPale }]}>
        <TouchableOpacity onPress={() => setOffset(o => Math.max(o - 1, MIN))} disabled={offset <= MIN} style={s.navBtn}>
          <Text style={[s.navArrow, { color: offset <= MIN ? Colors.brownPale : Colors.textSecondary }]}>← ant</Text>
        </TouchableOpacity>
        <Text style={[s.dayLabel, { color: Colors.brown }]}>{label}</Text>
        <TouchableOpacity onPress={() => setOffset(o => Math.min(o + 1, 0))} disabled={offset >= 0} style={s.navBtn}>
          <Text style={[s.navArrow, { color: offset >= 0 ? Colors.brownPale : Colors.textSecondary }]}>sig →</Text>
        </TouchableOpacity>
      </View>

      {eventos === null && !error && <ActivityIndicator color={Colors.brown} style={{ marginTop: 32 }} />}
      {error && <EmptyState emoji="⚠️" texto="error al cargar eventos" errorColor={C.dangerText} />}
      {eventos?.length === 0 && (
        <EmptyState emoji="🌙" texto="sin eventos registrados este día"
          hint="los eventos aparecen aquí automáticamente mientras el sensor esté activo" />
      )}

      {eventos?.map((ev, idx) => (
        <View key={ev.id} style={s.eventoRow}>
          <View style={s.timelineCol}>
            <View style={[s.timelineDot, { backgroundColor: ev.color }]} />
            {idx < eventos.length - 1 && <View style={[s.timelineLine, { backgroundColor: Colors.brownPale }]} />}
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

// ← filtroInicial: recibe 'llanto' cuando se navega desde Inicio
const AlertasTab = ({ filtroInicial = 'todos' }) => {
  const [filtro, setFiltro] = useState(filtroInicial);
  const { alertas, error } = useAlertas();
  const lista = !alertas ? [] : filtro === 'todos' ? alertas : alertas.filter(a => a.cat === filtro);

  return (
    <ScrollView contentContainerStyle={s.tabContent}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={s.filtrosRowH}>
          {['todos', 'llanto', 'temperatura'].map(f => (
            <TouchableOpacity key={f}
              style={[s.filtroBtn, { backgroundColor: filtro === f ? Colors.brown : Colors.bgCard, borderColor: Colors.brownPale }]}
              onPress={() => setFiltro(f)}>
              <Text style={[s.filtroLabel, { color: filtro === f ? '#F5F0E8' : Colors.textSecondary }]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {alertas === null && !error && <ActivityIndicator color={Colors.brown} style={{ marginTop: 32 }} />}
      {error && <EmptyState emoji="⚠️" texto="error al cargar alertas" errorColor={C.dangerText} />}

      {lista.map(alerta => (
        <View key={alerta.id} style={[s.alertaCard, { backgroundColor: alerta.bg, borderColor: alerta.color + '80' }]}>
          <View style={s.alertaHeader}>
            <Text style={[s.alertaTipo, { color: alerta.color }]}>{alerta.tipo}</Text>
            {alerta.ts > 0 && <Text style={[s.alertaHora, { color: Colors.textTertiary }]}>{fmtHora(alerta.ts)}</Text>}
          </View>
          <Text style={[s.alertaDetalle, { color: Colors.textSecondary }]}>{alerta.detalle}</Text>
        </View>
      ))}

      {alertas !== null && lista.length === 0 && !error && (
        <EmptyState emoji="✅"
          texto={filtro === 'todos' ? 'sin alertas registradas' : `sin alertas de tipo "${filtro}"`} />
      )}
    </ScrollView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CONTENEDOR PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export default function Historial() {
  const route = useRoute();
  // tab y filtro opcionales — vienen cuando se navega desde Inicio:
  // navigation.navigate('historial', { tab: 'alertas', filtro: 'llanto' })
  const [activeTab, setActiveTab] = useState(route.params?.tab ?? 'stats');

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: Colors.bg }]} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>historial</Text>
      </View>

      <View style={[s.tabBar, { backgroundColor: Colors.bgCard, borderColor: Colors.brownPale }]}>
        {['stats', 'diario', 'alertas'].map(tab => (
          <TouchableOpacity key={tab}
            style={[s.tabBtn, activeTab === tab && { backgroundColor: Colors.brown }]}
            onPress={() => setActiveTab(tab)}>
            <Text style={[s.tabLabel, { color: activeTab === tab ? '#F5F0E8' : Colors.textSecondary }]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'stats'   && <StatsTab />}
      {activeTab === 'diario'  && <DiarioTab />}
      {activeTab === 'alertas' && <AlertasTab filtroInicial={route.params?.filtro} />}
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ESTILOS
// ═══════════════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  safe:          { flex: 1 },
  header:        { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title:         { fontSize: 22, fontWeight: '600', letterSpacing: -0.5, color: Colors.brown },
  tabBar:        { flexDirection: 'row', marginHorizontal: 16, borderRadius: 999, borderWidth: 1, padding: 3, gap: 2, marginBottom: 4 },
  tabBtn:        { flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: 'center' },
  tabLabel:      { fontSize: 13, fontWeight: '500' },
  tabContent:    { padding: 16, gap: 12, paddingBottom: 100 },
  filtrosRow:    { flexDirection: 'row', gap: 8 },
  filtrosRowH:   { flexDirection: 'row', gap: 8, paddingRight: 16 },
  filtroBtn:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  filtroLabel:   { fontSize: 13, fontWeight: '500' },
  statsGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard:      { width: '47.5%', borderRadius: 12, padding: 14, gap: 2 },
  statIcon:      { fontSize: 16, marginBottom: 2 },
  statLabel:     { fontSize: 11 },
  statValue:     { fontSize: 24, fontWeight: '600', letterSpacing: -0.5 },
  chartBox:      { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  chartHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabel:  { fontSize: 13 },
  chartLegend:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:     { width: 8, height: 8, borderRadius: 4 },
  legendLabel:   { fontSize: 10 },
  dayNav:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  navBtn:        { paddingVertical: 4, paddingHorizontal: 4 },
  navArrow:      { fontSize: 13, fontWeight: '500' },
  dayLabel:      { fontSize: 15, fontWeight: '600' },
  eventoRow:     { flexDirection: 'row', gap: 10, minHeight: 60 },
  timelineCol:   { width: 18, alignItems: 'center', paddingTop: 14 },
  timelineDot:   { width: 10, height: 10, borderRadius: 5 },
  timelineLine:  { flex: 1, width: 2, marginTop: 4 },
  eventoCard:    { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, gap: 3 },
  eventoTipo:    { fontSize: 14, fontWeight: '500' },
  eventoDetalle: { fontSize: 12 },
  alertaCard:    { borderRadius: 12, borderWidth: 1, padding: 14, gap: 4 },
  alertaHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alertaTipo:    { fontSize: 14, fontWeight: '600' },
  alertaHora:    { fontSize: 11 },
  alertaDetalle: { fontSize: 12 },
  emptyState:    { alignItems: 'center', paddingVertical: 40 },
  emptyText:     { fontSize: 13, textAlign: 'center' },
  emptyHint:     { fontSize: 11, textAlign: 'center', marginTop: 4, paddingHorizontal: 24 },
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