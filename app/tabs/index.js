// app/tabs/inicio.js — Capullo App
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Animated, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getDatabase, ref, onValue, query, orderByChild, startAt } from 'firebase/database';
import Colors from '../constants/colors';
import { useSensor } from '../constants/SensorContext';

// ─── Helpers ───────────────────────────────────────────────────────────────
const inicioDeHoy = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const getSaludo = () => {
  const hora = new Date().getHours();
  if (hora >= 6 && hora < 12)  return 'buenos días';
  if (hora >= 12 && hora < 19) return 'buenas tardes';
  return 'buenas noches';
};

// ─── Hook: cuenta de llantos hoy desde Firebase ────────────────────────────
const useLlantosHoy = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const db = getDatabase();
    const r  = query(
      ref(db, 'alertas'),
      orderByChild('ts'),
      startAt(inicioDeHoy()),
    );
    return onValue(r, (snap) => {
      if (!snap.exists()) { setCount(0); return; }
      const llantosDeHoy = Object.values(snap.val()).filter(v => v.cat === 'llanto');
      setCount(llantosDeHoy.length);
    });
  }, []);

  return count;
};

// ─── Dot animado ───────────────────────────────────────────────────────────
const PulseDot = ({ color }) => {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.5, duration: 550, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 550, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <View style={dot.wrapper}>
      <Animated.View style={[dot.outer, { backgroundColor: color, transform: [{ scale: pulse }] }]} />
      <View style={[dot.inner, { backgroundColor: color }]} />
    </View>
  );
};

const dot = StyleSheet.create({
  wrapper: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  outer:   { width: 12, height: 12, borderRadius: 6, opacity: 0.3, position: 'absolute' },
  inner:   { width: 7,  height: 7,  borderRadius: 4 },
});

// ─── Ícono de cuna ─────────────────────────────────────────────────────────
const CunaIcon = ({ detected }) => (
  <View style={styles.cunaWrap}>
    <View style={[styles.cunaBody, { borderColor: detected ? Colors.brownLight : Colors.brownPale }]}>
      <Text style={{ fontSize: 18 }}>{detected ? '😴' : '🛏️'}</Text>
    </View>
    <View style={styles.cunaLegs}>
      <View style={[styles.cunaLeg, { backgroundColor: Colors.brownPale }]} />
      <View style={[styles.cunaLeg, { backgroundColor: Colors.brownPale }]} />
    </View>
  </View>
);

// ─── EstadoDia ─────────────────────────────────────────────────────────────
const calcularEstadoBebe = ({ llantoActivo, llantosHoy, bebeDetectado, termicoConectado, suenoCuna }) => {
  if (!termicoConectado) {
    return {
      tipo:  'neutro',
      emoji: '📡',
      titulo: 'sensor desconectado',
      sub:   'conecta el sensor para ver cómo va el día.',
      chips: [],
    };
  }

  if (llantoActivo) {
    return {
      tipo:  'activo',
      emoji: '😢',
      titulo: 'bebé llorando ahora',
      sub:   'se detectó llanto en este momento. ve a revisar cómo está.',
      chips: ['llanto activo', 'revisar ahora'],
    };
  }

  if (llantosHoy === 0) {
    return {
      tipo:  'bien',
      emoji: '🌟',
      titulo: 'excelente día',
      sub:   `no ha llorado nada hoy${suenoCuna ? ` y estuvo ${suenoCuna} tranquilo en cuna.` : '.'}`,
      chips: [
        '0 llantos',
        suenoCuna ? `${suenoCuna} en cuna` : null,
        bebeDetectado ? 'en cuna ahora' : null,
      ].filter(Boolean),
    };
  }

  if (llantosHoy <= 2) {
    return {
      tipo:  'bien',
      emoji: '😊',
      titulo: 'buen día en general',
      sub:   `lloró ${llantosHoy === 1 ? 'una vez' : 'un par de veces'} pero se calmó rápido.`,
      chips: [
        `${llantosHoy} ${llantosHoy === 1 ? 'llanto' : 'llantos'}`,
        suenoCuna ? `${suenoCuna} en cuna` : null,
        'todo tranquilo',
      ].filter(Boolean),
    };
  }

  if (llantosHoy <= 4) {
    return {
      tipo:  'ojo',
      emoji: '😮‍💨',
      titulo: 'día un poco movido',
      sub:   `ha llorado ${llantosHoy} veces hoy. puede que esté incómodo o con sueño.`,
      chips: [
        `${llantosHoy} llantos`,
        suenoCuna ? `${suenoCuna} en cuna` : null,
        'estuvo inquieto',
      ].filter(Boolean),
    };
  }

  return {
    tipo:  'activo',
    emoji: '😢',
    titulo: 'día difícil',
    sub:   `ha llorado ${llantosHoy} veces hoy. revisa si necesita algo especial.`,
    chips: [`${llantosHoy} llantos`, 'necesita atención'],
  };
};

const estadoColores = {
  bien:   { bg: '#E8F5EE', border: '#9FE1CB', titulo: '#085041', sub: '#0F6E56', chip: { bg: '#C8EAD8', border: '#9FE1CB', text: '#085041' } },
  ojo:    { bg: '#FAEEDA', border: '#FAC775', titulo: '#633806', sub: '#854F0B', chip: { bg: '#FAD89A', border: '#FAC775', text: '#633806' } },
  activo: { bg: '#FAECE7', border: '#F0997B', titulo: '#712B13', sub: '#993C1D', chip: { bg: '#F5C4B3', border: '#F0997B', text: '#712B13' } },
  neutro: { bg: Colors.bgCard, border: Colors.brownPale, titulo: Colors.brown,  sub: Colors.textTertiary, chip: { bg: Colors.bgCard, border: Colors.brownPale, text: Colors.textTertiary } },
};

const EstadoDia = (props) => {
  const estado = calcularEstadoBebe(props);
  const c      = estadoColores[estado.tipo] ?? estadoColores.neutro;

  return (
    <View style={[edStyles.card, { backgroundColor: c.bg, borderColor: c.border }]}>
      <View style={edStyles.top}>
        <Text style={edStyles.emoji}>{estado.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[edStyles.titulo, { color: c.titulo }]}>{estado.titulo}</Text>
          <Text style={[edStyles.sub,    { color: c.sub    }]}>{estado.sub}</Text>
        </View>
      </View>
      {estado.chips.length > 0 && (
        <View style={edStyles.chips}>
          {estado.chips.map((chip, i) => (
            <View key={i} style={[edStyles.chip, { backgroundColor: c.chip.bg, borderColor: c.chip.border }]}>
              <Text style={[edStyles.chipText, { color: c.chip.text }]}>{chip}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const edStyles = StyleSheet.create({
  card:     { borderRadius: 24, borderWidth: 1, padding: 20, marginBottom: 14 },
  top:      { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  emoji:    { fontSize: 40, lineHeight: 48 },
  titulo:   { fontSize: 16, fontWeight: '700', marginBottom: 3 },
  sub:      { fontSize: 12, lineHeight: 18 },
  chips:    { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip:     { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 11, fontWeight: '500' },
});

// ═══════════════════════════════════════════════════════════════════════════
export default function Inicio() {
  const navigation = useNavigation();

  const {
    tempBebe, bebeDetectado, termicoConectado,
    temperatura, humedad,
    llantoActivo, ultimoLlanto,
    suenoCuna,
  } = useSensor();

  const llantosHoy = useLlantosHoy();

  const estadoLabel = !termicoConectado
    ? 'sin conexión'
    : bebeDetectado ? 'bebé en cuna' : 'cuna vacía';

  const estadoBg = !termicoConectado
    ? Colors.bgCard
    : bebeDetectado ? Colors.success : '#F5F0E8';

  const estadoColor = !termicoConectado
    ? Colors.textTertiary
    : bebeDetectado ? Colors.successDark : Colors.textSecondary;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>capullo<Text style={{ color: Colors.brownLight }}>.</Text></Text>
          <Text style={styles.greeting}>{getSaludo()}, Sofía</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.bellBtn}>
            <Ionicons name="notifications-outline" size={22} color={Colors.brown} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Cómo va el día del bebé — lo primero que ves ── */}
        <EstadoDia
          llantoActivo={llantoActivo}
          llantosHoy={llantosHoy}
          bebeDetectado={bebeDetectado}
          termicoConectado={termicoConectado}
          suenoCuna={suenoCuna ?? null}
        />

        {/* ── Hero: estado del bebé ── */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('monitor')}
          style={styles.heroCard}
        >
          <View style={styles.heroInfo}>
            <View style={[styles.statusPill, { backgroundColor: estadoBg }]}>
              {bebeDetectado && termicoConectado && (
                <PulseDot color={Colors.successDark} />
              )}
              <Text style={[styles.statusText, { color: estadoColor }]}>{estadoLabel}</Text>
            </View>

            <Text style={styles.tempValue}>
              {tempBebe != null ? `${tempBebe}` : '--'}
              <Text style={styles.tempUnit}> °C</Text>
            </Text>

            <Text style={styles.tempSub}>
              {bebeDetectado ? 'zona caliente' : 'toca para ver monitor'}
            </Text>
          </View>
          <CunaIcon detected={bebeDetectado} />
        </TouchableOpacity>

        {/* ── Ambiente y humedad ── */}
        <View style={styles.row}>
          <View style={[styles.ambCard, { backgroundColor: Colors.bgCard }]}>
            <Text style={styles.ambIcon}>🏠</Text>
            <Text style={styles.ambLabel}>temperatura en cuarto</Text>
            <Text style={styles.ambValue}>
              {temperatura != null ? `${temperatura}°C` : '--'}
            </Text>
            <Text style={styles.ambHint}>
              {temperatura != null
                ? temperatura >= 18 && temperatura <= 22
                  ? 'rango ideal ✓'
                  : temperatura < 18 ? 'cuarto frío' : 'cuarto caliente'
                : 'sin datos'}
            </Text>
          </View>
          <View style={[styles.ambCard, { backgroundColor: Colors.bgCard }]}>
            <Text style={styles.ambIcon}>💧</Text>
            <Text style={styles.ambLabel}>humedad en cuarto</Text>
            <Text style={styles.ambValue}>
              {humedad != null ? `${humedad}%` : '--'}
            </Text>
            <Text style={styles.ambHint}>
              {humedad != null
                ? humedad >= 40 && humedad <= 60
                  ? 'rango ideal ✓'
                  : humedad < 40 ? 'ambiente seco' : 'ambiente húmedo'
                : 'sin datos'}
            </Text>
          </View>
        </View>

        {/* ── Llantos hoy ── */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('historial', { tab: 'alertas', filtro: 'llanto' })}
          style={[
            styles.llantoCard,
            {
              backgroundColor: llantoActivo
                ? Colors.danger
                : llantosHoy > 0 ? '#FFF3F3' : Colors.bgCard,
            },
          ]}
        >
          <View style={styles.llantoLeft}>
            {llantoActivo && <PulseDot color={Colors.dangerDark} />}
            <View>
              <Text style={[styles.llantoTitulo, { color: llantoActivo ? Colors.dangerDark : Colors.brown }]}>
                {llantoActivo ? 'bebé llorando ahora' : `llantos hoy · ${llantosHoy}`}
              </Text>
              <Text style={[styles.llantoSub, { color: llantoActivo ? Colors.dangerDark : Colors.textTertiary }]}>
                {llantoActivo
                  ? 'detectado en este momento'
                  : ultimoLlanto
                    ? `último: ${ultimoLlanto.hora} · ${ultimoLlanto.duracion}`
                    : llantosHoy === 0 ? 'ninguno registrado hoy' : 'toca para ver historial'}
              </Text>
            </View>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={llantoActivo ? Colors.dangerDark : Colors.textTertiary}
          />
        </TouchableOpacity>

        {/* ── Resumen de hoy ── */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('historial', { tab: 'stats' })}
          style={[styles.llantoCard, { backgroundColor: Colors.bgCard }]}
        >
          <View style={styles.llantoLeft}>
            <Ionicons name="bar-chart-outline" size={18} color={Colors.brown} />
            <View>
              <Text style={[styles.llantoTitulo, { color: Colors.brown }]}>
                resumen de hoy
              </Text>
              <Text style={[styles.llantoSub, { color: Colors.textTertiary }]}>
                estadísticas y temperatura del día
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
        </TouchableOpacity>

        {/* ── Cámara en vivo ── */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('monitor', { abrirCamara: true })}
          style={[styles.llantoCard, { backgroundColor: Colors.bgCard }]}
        >
          <View style={styles.llantoLeft}>
            <Feather name="video" size={18} color={Colors.brown} />
            <View>
              <Text style={[styles.llantoTitulo, { color: Colors.brown }]}>
                cámara en vivo
              </Text>
              <Text style={[styles.llantoSub, { color: Colors.textTertiary }]}>
                toca para ver el monitor
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 10 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 25, paddingTop: 15, paddingBottom: 15,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  appName:  { fontSize: 28, fontWeight: '700', color: Colors.brown, letterSpacing: -0.5 },
  greeting: { fontSize: 13, color: Colors.textSecondary, marginTop: -2 },
  bellBtn:  {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.bgSurface,
    alignItems: 'center', justifyContent: 'center',
  },

  // Hero
  heroCard: {
    backgroundColor: Colors.bgCard, borderRadius: 28, padding: 22,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 14,
    ...Platform.select({
      ios:     { shadowColor: Colors.brown, shadowOpacity: 0.06, shadowRadius: 12 },
      android: { elevation: 2 },
    }),
  },
  heroInfo:   { flex: 1 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    alignSelf: 'flex-start', marginBottom: 10,
  },
  statusText: { fontSize: 12, fontWeight: '600' },
  tempValue:  { fontSize: 48, fontWeight: '700', color: Colors.brown, letterSpacing: -1 },
  tempUnit:   { fontSize: 22, fontWeight: '400' },
  tempSub:    { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },

  cunaWrap: { alignItems: 'center', marginLeft: 10 },
  cunaBody: {
    width: 72, height: 40, borderRadius: 22,
    borderWidth: 2, backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
  },
  cunaLegs: { flexDirection: 'row', gap: 28, marginTop: -3 },
  cunaLeg:  { width: 2, height: 11 },

  // Ambiente
  row:     { flexDirection: 'row', gap: 10, marginBottom: 14 },
  ambCard: { flex: 1, borderRadius: 22, padding: 16, gap: 2 },
  ambIcon:  { fontSize: 20, marginBottom: 4 },
  ambLabel: { fontSize: 11, color: Colors.textTertiary },
  ambValue: { fontSize: 26, fontWeight: '700', color: Colors.brown, letterSpacing: -0.5 },
  ambHint:  { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },

  // Llantos y cámara
  llantoCard: {
    borderRadius: 22, padding: 18, marginBottom: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  llantoLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  llantoTitulo: { fontSize: 14, fontWeight: '600' },
  llantoSub:    { fontSize: 12, marginTop: 2 },
});