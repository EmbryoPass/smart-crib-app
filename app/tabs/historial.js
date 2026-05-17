// app/tabs/historial.js — Capullo App
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Dimensions, ActivityIndicator,
  Modal, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polyline, Line, Rect, Text as SvgText } from 'react-native-svg';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  getDatabase, ref, onValue,
  query, orderByChild, limitToLast,
} from 'firebase/database';
import Colors from '../constants/colors';

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
  // Naranja para temperatura del cuarto
  naranjaText: '#B85C00',
  naranjaBg:   '#FEF0E0',
};

const TIPO_META = {
  // Bebé
  'llanto': { color: C.infoText, bg: C.infoBg },
  'temp. elevada':      { color: C.naranjaText, bg: C.naranjaBg },
  'altura ajustada':    { color: C.infoText,    bg: C.infoBg    },
  // Normalizaciones de ambiente (positivas)
  'normalizacion_temp': { color: C.successText, bg: C.successBg },
  'normalizacion_hum':  { color: C.successText, bg: C.successBg },
  // Tendencia de temperatura
  'tendencia_alcista':  { color: C.naranjaText, bg: C.naranjaBg },
};

// Para eventos de ambiente cuyo `tipo` es un título largo (ej. "El cuarto está muy frío"),
// inferimos el color por palabras clave.
const getTipoMeta = (tipo) => {
  if (TIPO_META[tipo]) return TIPO_META[tipo];
  const t = tipo.toLowerCase();
  if (t.includes('normal') || t.includes('ideal') || t.includes('bien'))
    return { color: C.successText, bg: C.successBg };
  if (t.includes('muy') || t.includes('críti') || t.includes('!'))
    return { color: C.dangerText,  bg: C.dangerBg  };
  if (t.includes('frío') || t.includes('frio') || t.includes('seco') ||
      t.includes('caliente') || t.includes('húmedo') || t.includes('humedo'))
    return { color: C.naranjaText, bg: C.naranjaBg };
  return { color: Colors.brownPale, bg: Colors.bgCard };
};

const ALERTA_META = {
  llanto:      { color: C.infoText,   bg: C.infoBg   },  // 🔵 azul
  temperatura: { color: C.naranjaText, bg: C.naranjaBg }, // 🟠 naranja
  ambiente:    { color: C.dangerText,  bg: C.dangerBg  }, // 🔴 rojo
};

const DS = ['dom','lun','mar','mié','jue','vie','sáb'];
const MS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

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
  return `${DS[d.getDay()]} ${d.getDate()} ${MS[d.getMonth()]}`;
};

const fmtHora = (ts) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};

const fmtFecha = (date) =>
  `${date.getDate()} ${MS[date.getMonth()]} ${date.getFullYear()}`;

// Para alertas: muestra "hoy 14:30", "ayer 09:15" o "12 may 08:00"
const fmtFechaHora = (ts) => {
  if (!ts || ts === 0) return null;
  const d    = new Date(ts);
  const hora = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  const hoy  = new Date(); hoy.setHours(0, 0, 0, 0);
  const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1);
  const dia  = new Date(d);  dia.setHours(0, 0, 0, 0);
  if (dia.getTime() === hoy.getTime())  return `hoy ${hora}`;
  if (dia.getTime() === ayer.getTime()) return `ayer ${hora}`;
  return `${d.getDate()} ${MS[d.getMonth()]} ${hora}`;
};

// ─── Hook: llantos — retorna porDia y porHora según rango ─────────────────
const useLlantosStats = ({ desde, hasta }) => {
  const [porDia,  setPorDia ] = useState([]);
  const [porHora, setPorHora] = useState([]);

  useEffect(() => {
    const db = getDatabase();
    const r  = query(ref(db, 'alertas'), orderByChild('ts'), limitToLast(500));
    return onValue(r, (snap) => {
      if (!snap.exists()) { setPorDia([]); setPorHora([]); return; }

      const alertas = Object.values(snap.val())
        .filter(v => v.cat === 'llanto' && v.ts >= desde && v.ts <= hasta);

      const horas = Array(24).fill(0);
      alertas.forEach(v => { horas[new Date(v.ts).getHours()]++; });
      setPorHora(horas.map((count, hora) => ({
        count,
        label: String(hora).padStart(2, '0'),
      })));

      const dias = [];
      const diaMs  = 24 * 60 * 60 * 1000;
      const inicio = new Date(desde); inicio.setHours(0, 0, 0, 0);
      const fin    = new Date(hasta);
      let cursor   = new Date(inicio);

      let totalDias = 0;
      const tempCursor = new Date(inicio);
      while (tempCursor <= fin) { totalDias++; tempCursor.setTime(tempCursor.getTime() + diaMs); }

      while (cursor <= fin) {
        const dInicio = cursor.getTime();
        const dFin    = dInicio + diaMs;
        const count   = alertas.filter(v => v.ts >= dInicio && v.ts < dFin).length;
        const hoy     = new Date(); hoy.setHours(0, 0, 0, 0);
        const label   = cursor.getTime() === hoy.getTime()
          ? 'hoy'
          : totalDias > 14
            ? String(cursor.getDate())
            : `${DS[cursor.getDay()]} ${cursor.getDate()}`;
        dias.push({ count, label });
        cursor = new Date(cursor.getTime() + diaMs);
      }
      setPorDia(dias);
    });
  }, [desde, hasta]);

  return { porDia, porHora };
};

// ─── Hook: historial de ambiente ──────────────────────────────────────────
const useAmbienteHistory = ({ desde, hasta }) => {
  const [puntosTemp, setPuntosTemp] = useState([]);
  const [puntosHum,  setPuntosHum ] = useState([]);

  useEffect(() => {
    const db = getDatabase();
    const r  = ref(db, '/historial/ambiente');
    return onValue(r, (snap) => {
      if (!snap.exists()) { setPuntosTemp([]); setPuntosHum([]); return; }
      const entries = Object.values(snap.val())
        .map(v => ({ ...v, ts: v.ts * 1000 }))
        .filter(v => v.ts >= desde && v.ts <= hasta)
        .sort((a, b) => a.ts - b.ts);
      setPuntosTemp(entries.map(e => ({ v: e.temperatura, ts: e.ts })));
      setPuntosHum (entries.map(e => ({ v: e.humedad,     ts: e.ts })));
    });
  }, [desde, hasta]);

  return { puntosTemp, puntosHum };
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
          const meta = getTipoMeta(v.tipo);
          return { id, tipo: v.tipo ?? 'evento', detalle: v.detalle ?? '', color: meta.color, bg: meta.bg, ts: v.ts ?? 0 };
        })
        .sort((a, b) => b.ts - a.ts);   // más reciente arriba
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
    const r     = query(ref(db, 'alertas'), orderByChild('ts'), limitToLast(200));
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
// Gráfica de barras genérica
// ═══════════════════════════════════════════════════════════════════════════
const BarChart = ({ datos, mensajeVacio }) => {
  const W      = SW - 64;
  const H      = 114;
  const PAD    = { t: 18, b: 20, l: 4, r: 4 };
  const total  = datos.reduce((acc, b) => acc + b.count, 0);
  const maxVal = Math.max(...datos.map(d => d.count), 1);
  const n      = datos.length || 1;
  const barW   = (W - PAD.l - PAD.r) / n;
  const innerH = H - PAD.t - PAD.b;
  const labelStep = n <= 7 ? 1 : n <= 14 ? 2 : 5;

  if (total === 0) {
    return (
      <View style={{ height: H, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: Colors.textTertiary, fontSize: 13 }}>
          {mensajeVacio ?? 'sin datos en este período 🌙'}
        </Text>
      </View>
    );
  }

  return (
    <Svg width={W} height={H}>
      {datos.map(({ count }, i) => {
        const barH = count > 0 ? Math.max((count / maxVal) * innerH, 4) : 2;
        const x    = PAD.l + i * barW + barW * 0.15;
        const y    = PAD.t + innerH - barH;
        const w    = barW * 0.7;
        return (
          <React.Fragment key={i}>
            <Rect x={x} y={y} width={w} height={barH} rx={3}
              fill={count > 0 ? C.dangerText : Colors.brownPale}
              opacity={count > 0 ? 0.85 : 0.3}
            />
            {count > 0 && (
              <SvgText
                x={x + w / 2} y={y - 3}
                textAnchor="middle" fontSize="9" fontWeight="600"
                fill={C.dangerText}>
                {count}
              </SvgText>
            )}
          </React.Fragment>
        );
      })}
      {datos.map(({ label }, i) => {
        if (i % labelStep !== 0 && i !== datos.length - 1) return null;
        return (
          <SvgText key={i}
            x={PAD.l + i * barW + barW / 2} y={H - 4}
            textAnchor="middle" fontSize="9" fill={Colors.textTertiary}>
            {label}
          </SvgText>
        );
      })}
    </Svg>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Gráfica de línea — banda ideal + etiquetas separadas + valor actual
// ═══════════════════════════════════════════════════════════════════════════
const LineChart = ({ puntos, minVal, maxVal, colorLinea, minIdeal, maxIdeal, unidad = '' }) => {
  const W = SW - 64, H = 120;
  const PAD = { t: 18, b: 20, l: 36, r: 20 };

  if (!puntos || puntos.length < 2) {
    return (
      <View style={{ height: H, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: Colors.textTertiary, fontSize: 13 }}>acumulando datos…</Text>
      </View>
    );
  }

  const px = (i) => PAD.l + (i / (puntos.length - 1)) * (W - PAD.l - PAD.r);
  const py = (v) => PAD.t + (1 - (v - minVal) / (maxVal - minVal || 1)) * (H - PAD.t - PAD.b);
  const polyPoints = puntos.map((p, i) => `${px(i)},${py(p.v)}`).join(' ');

  const midIdx   = Math.floor(puntos.length / 2);
  const hasTimes = Boolean(puntos[0]?.ts);
  const xLabels  = hasTimes
    ? [0, midIdx, puntos.length - 1].map(i => ({ x: px(i), label: fmtHora(puntos[i].ts) }))
    : [{ x: px(0), label: 'inicio' }, { x: px(puntos.length - 1), label: 'ahora' }];

  const ultimo      = puntos[puntos.length - 1];
  const ultimoX     = px(puntos.length - 1);
  const ultimoY     = py(ultimo.v);
  const enRango     = ultimo.v >= minIdeal && ultimo.v <= maxIdeal;
  const colorActual = enRango ? C.successText : C.dangerText;
  const bgActual    = enRango ? C.successBg   : C.dangerBg;

  const yMax = py(maxIdeal); // línea superior de la banda
  const yMin = py(minIdeal); // línea inferior de la banda
  const bandaH = yMin - yMax;

  return (
    <Svg width={W} height={H}>
      {/* ── Banda del rango ideal ── */}
      <Rect x={PAD.l} y={yMax} width={W - PAD.l - PAD.r} height={bandaH}
        fill={C.menta} opacity={0.25} />

      {/* ── Líneas de borde de banda ── */}
      <Line x1={PAD.l} y1={yMax} x2={W - PAD.r} y2={yMax}
        stroke={C.menta} strokeWidth={1} strokeDasharray="3,3" />
      <Line x1={PAD.l} y1={yMin} x2={W - PAD.r} y2={yMin}
        stroke={C.menta} strokeWidth={1} strokeDasharray="3,3" />

      {/* ── Etiqueta maxIdeal — encima de la línea superior ── */}
      <SvgText
        x={PAD.l - 2} y={yMax + 4}
        textAnchor="end" fontSize="9" fill={C.successText} fontWeight="600">
        {maxIdeal}{unidad}
      </SvgText>

      {/* ── Etiqueta minIdeal — debajo de la línea inferior ── */}
      <SvgText
        x={PAD.l - 2} y={yMin + 9}
        textAnchor="end" fontSize="9" fill={C.successText} fontWeight="600">
        {minIdeal}{unidad}
      </SvgText>

      {/* ── Línea de datos ── */}
      <Polyline points={polyPoints} fill="none" stroke={colorLinea}
        strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

      {/* ── Valor actual — etiqueta flotante ── */}
      <Rect x={ultimoX - 18} y={ultimoY - 12} width={36} height={14}
        rx={7} fill={bgActual} />
      <SvgText
        x={ultimoX} y={ultimoY - 2}
        textAnchor="middle" fontSize="9" fontWeight="700"
        fill={colorActual}>
        {ultimo.v.toFixed(1)}{unidad}
      </SvgText>

      {/* ── Etiquetas eje X ── */}
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
  const [filtroTipo, setFiltroTipo] = useState('hoy');
  const [fechaDia,   setFechaDia  ] = useState(new Date());
  const [fechaDesde, setFechaDesde] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d; });
  const [fechaHasta, setFechaHasta] = useState(new Date());
  const [picker,     setPicker    ] = useState(null);

  const rango = useMemo(() => {
    const ahora = Date.now();
    const hoyInicio = new Date(); hoyInicio.setHours(0, 0, 0, 0);
    switch (filtroTipo) {
      case 'hoy':
        return { desde: hoyInicio.getTime(), hasta: ahora };
      case 'semana':
        return { desde: ahora - 7  * 86400000, hasta: ahora };
      case 'mes':
        return { desde: ahora - 30 * 86400000, hasta: ahora };
      case 'dia': {
        const d = new Date(fechaDia); d.setHours(0, 0, 0, 0);
        return { desde: d.getTime(), hasta: d.getTime() + 86400000 - 1 };
      }
      case 'rango': {
        const d = new Date(fechaDesde); d.setHours(0, 0, 0, 0);
        const h = new Date(fechaHasta); h.setHours(23, 59, 59, 999);
        return { desde: d.getTime(), hasta: h.getTime() };
      }
      default:
        return { desde: hoyInicio.getTime(), hasta: ahora };
    }
  }, [filtroTipo, fechaDia, fechaDesde, fechaHasta]);

  const { porDia, porHora }       = useLlantosStats(rango);
  const { puntosTemp, puntosHum } = useAmbienteHistory(rango);
  const mostrarPorDia = filtroTipo !== 'dia';

  const onPickerChange = (_, date) => {
    if (!date) { setPicker(null); return; }
    if (picker === 'dia')   setFechaDia(date);
    if (picker === 'desde') setFechaDesde(date);
    if (picker === 'hasta') setFechaHasta(date);
    if (Platform.OS === 'android') setPicker(null);
  };

  return (
    <ScrollView contentContainerStyle={s.tabContent}>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={s.filtrosRowH}>
          {['hoy', 'semana', 'mes', 'día', 'rango'].map(f => {
            const key = f === 'día' ? 'dia' : f;
            return (
              <TouchableOpacity key={key}
                style={[s.filtroBtn, { backgroundColor: filtroTipo === key ? Colors.brown : Colors.bgCard, borderColor: Colors.brownPale }]}
                onPress={() => setFiltroTipo(key)}>
                <Text style={[s.filtroLabel, { color: filtroTipo === key ? '#F5F0E8' : Colors.textSecondary }]}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {filtroTipo === 'dia' && (
        <TouchableOpacity
          style={[s.dateRow, { backgroundColor: Colors.bgCard, borderColor: Colors.brownPale }]}
          onPress={() => setPicker('dia')}>
          <Text style={[s.dateLabel, { color: Colors.textSecondary }]}>fecha</Text>
          <Text style={[s.dateValue, { color: Colors.brown }]}>{fmtFecha(fechaDia)}</Text>
        </TouchableOpacity>
      )}

      {filtroTipo === 'rango' && (
        <View style={[s.rangoBox, { backgroundColor: Colors.bgCard, borderColor: Colors.brownPale }]}>
          <TouchableOpacity style={s.rangoRow} onPress={() => setPicker('desde')}>
            <Text style={[s.dateLabel, { color: Colors.textSecondary }]}>desde</Text>
            <Text style={[s.dateValue, { color: Colors.brown }]}>{fmtFecha(fechaDesde)}</Text>
          </TouchableOpacity>
          <View style={[s.rangoDivider, { backgroundColor: Colors.brownPale }]} />
          <TouchableOpacity style={s.rangoRow} onPress={() => setPicker('hasta')}>
            <Text style={[s.dateLabel, { color: Colors.textSecondary }]}>hasta</Text>
            <Text style={[s.dateValue, { color: Colors.brown }]}>{fmtFecha(fechaHasta)}</Text>
          </TouchableOpacity>
        </View>
      )}

      {picker !== null && Platform.OS === 'android' && (
        <DateTimePicker
          value={picker === 'dia' ? fechaDia : picker === 'desde' ? fechaDesde : fechaHasta}
          mode="date" maximumDate={new Date()} onChange={onPickerChange}
        />
      )}

      {picker !== null && Platform.OS === 'ios' && (
        <Modal transparent animationType="fade" onRequestClose={() => setPicker(null)}>
          <TouchableOpacity style={s.pickerOverlay} activeOpacity={1} onPress={() => setPicker(null)}>
            <View style={s.pickerCard}>
              <DateTimePicker
                value={picker === 'dia' ? fechaDia : picker === 'desde' ? fechaDesde : fechaHasta}
                mode="date" display="inline" maximumDate={new Date()}
                accentColor={Colors.brown} themeVariant="light"
                onChange={onPickerChange} style={{ width: '100%' }}
              />
              <TouchableOpacity
                style={[s.pickerConfirm, { backgroundColor: Colors.brown }]}
                onPress={() => setPicker(null)}>
                <Text style={{ color: '#F5F0E8', fontWeight: '600', fontSize: 15 }}>listo</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {mostrarPorDia && (
        <View style={[s.chartBox, { backgroundColor: Colors.bgCard, borderColor: Colors.brownPale }]}>
          <View style={s.chartHeader}>
            <Text style={[s.sectionLabel, { color: Colors.textSecondary }]}>llantos por día</Text>
          </View>
          <BarChart datos={porDia} mensajeVacio="sin llantos en este período 🌙" />
        </View>
      )}

      <View style={[s.chartBox, { backgroundColor: Colors.bgCard, borderColor: Colors.brownPale }]}>
        <View style={s.chartHeader}>
          <Text style={[s.sectionLabel, { color: Colors.textSecondary }]}>llantos por hora</Text>
          <Text style={[s.legendLabel, { color: Colors.textTertiary }]}>0h – 23h</Text>
        </View>
        <BarChart datos={porHora} mensajeVacio="sin llantos registrados 🌙" />
      </View>

      <View style={[s.chartBox, { backgroundColor: Colors.bgCard, borderColor: Colors.brownPale }]}>
        <View style={s.chartHeader}>
          <Text style={[s.sectionLabel, { color: Colors.textSecondary }]}>temperatura del cuarto</Text>
        </View>
        <LineChart puntos={puntosTemp} minVal={10} maxVal={35}
          colorLinea="#3a5a8a" minIdeal={18} maxIdeal={22} unidad="°" />
      </View>

      <View style={[s.chartBox, { backgroundColor: Colors.bgCard, borderColor: Colors.brownPale }]}>
        <View style={s.chartHeader}>
          <Text style={[s.sectionLabel, { color: Colors.textSecondary }]}>humedad del cuarto</Text>
        </View>
        <LineChart puntos={puntosHum} minVal={0} maxVal={100}
          colorLinea="#4a8ab0" minIdeal={40} maxIdeal={60} unidad="%" />
      </View>

    </ScrollView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// TAB: DIARIO
// ═══════════════════════════════════════════════════════════════════════════
const DiarioTab = () => {
  const [offset, setOffset] = useState(0);
  const MIN     = -29;
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
            <View style={s.eventoHeader}>
              <Text style={[s.eventoTipo, { color: Colors.brown }]}>{ev.tipo}</Text>
              {ev.ts > 0 && (
                <Text style={[s.eventoHora, { color: Colors.textTertiary }]}>{fmtHora(ev.ts)}</Text>
              )}
            </View>
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
const AlertasTab = ({ filtroInicial = 'todos' }) => {
  const [filtro, setFiltro] = useState(filtroInicial);
  const { alertas, error }  = useAlertas();
  const lista = !alertas ? [] : filtro === 'todos' ? alertas : alertas.filter(al => al.cat === filtro);

  return (
    <ScrollView contentContainerStyle={s.tabContent}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={s.filtrosRowH}>
          {['todos', 'llanto', 'temperatura', 'ambiente'].map(f => (
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

      {lista.map(alerta => {
        const fechaHora = fmtFechaHora(alerta.ts);
        return (
          <View key={alerta.id} style={[s.alertaCard, { backgroundColor: alerta.bg, borderColor: alerta.color + '80' }]}>
            <View style={s.alertaHeader}>
              <Text style={[s.alertaTipo, { color: alerta.color }]}>{alerta.tipo}</Text>
              <Text style={[s.alertaHora, { color: Colors.textTertiary }]}>
                {fechaHora ?? '—'}
              </Text>
            </View>
            <Text style={[s.alertaDetalle, { color: Colors.textSecondary }]}>{alerta.detalle}</Text>
          </View>
        );
      })}

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
export default function Historial({ navigation }) {
  const route = useRoute();
  const [activeTab,     setActiveTab    ] = useState(route.params?.tab    ?? 'stats');
  const [filtroAlertas, setFiltroAlertas] = useState(route.params?.filtro ?? 'todos');

  useFocusEffect(
    useCallback(() => {
      if (route.params?.tab) setActiveTab(route.params.tab);
      setFiltroAlertas(route.params?.filtro ?? 'todos');
      navigation.setParams({ tab: undefined, filtro: undefined });
    }, [route.params?.tab, route.params?.filtro])
  );

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
      {activeTab === 'alertas' && <AlertasTab filtroInicial={filtroAlertas} />}
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
  filtrosRowH:   { flexDirection: 'row', gap: 8, paddingRight: 16 },
  filtroBtn:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  filtroLabel:   { fontSize: 13, fontWeight: '500' },

  dateRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  rangoBox:      { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  rangoRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  rangoDivider:  { height: 1, marginHorizontal: 16 },
  dateLabel:     { fontSize: 12, fontWeight: '500' },
  dateValue:     { fontSize: 14, fontWeight: '600' },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerCard:    { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 },
  pickerConfirm: { borderRadius: 12, padding: 14, alignItems: 'center' },

  chartBox:      { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  chartHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabel:  { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
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
  eventoHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eventoTipo:    { fontSize: 14, fontWeight: '500' },
  eventoHora:    { fontSize: 11 },
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
