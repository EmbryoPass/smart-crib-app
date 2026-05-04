// app/tabs/inicio.js — Capullo App
import React, { useState, useEffect, useRef } from 'react';
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

// ─── Hook: cuenta de llantos hoy desde Firebase ────────────────────────────
// Más confiable que el contador en memoria (persiste entre reinicios de app)
const useLlantosHoy = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const db     = getDatabase();
    const r      = query(
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

// ─── Dot animado — verde para live, rojo para alerta ──────────────────────
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

// ═══════════════════════════════════════════════════════════════════════════
export default function Inicio() {
  const navigation = useNavigation();
  const [cuidador, setCuidador] = useState('Mamá');

  const {
    tempBebe, bebeDetectado, termicoConectado,
    temperatura, humedad,
    llantoActivo, ultimoLlanto,
  } = useSensor();

  const llantosHoy = useLlantosHoy();

  const cuidadores = [
    { id: '1', name: 'Mamá',   dist: '65 cm', bg: Colors.danger,  text: Colors.dangerDark },
    { id: '2', name: 'Papá',   dist: '80 cm', bg: '#E3F2FD',      text: '#1B4F72'         },
    { id: '3', name: 'Abuela', dist: '55 cm', bg: Colors.success, text: Colors.successDark },
  ];

  // Estado de la hero card
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
          <Text style={styles.greeting}>buenos días, Sofía</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.bellBtn}>
            <Ionicons name="notifications-outline" size={22} color={Colors.brown} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

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
            <Text style={styles.ambLabel}>temperatura cuarto</Text>
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
            <Text style={styles.ambLabel}>humedad cuarto</Text>
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

        {/* ── ¿Quién atiende? ── */}
        <Text style={styles.sectionLabel}>¿quién atiende?</Text>
        <View style={[styles.row, { marginBottom: 20 }]}>
          {cuidadores.map(c => (
            <TouchableOpacity
              key={c.id}
              onPress={() => setCuidador(c.name)}
              style={[
                styles.cuidadorCard,
                { backgroundColor: c.bg },
                cuidador === c.name && styles.cuidadorSelected,
              ]}
            >
              <Text style={[styles.cuidadorName, { color: c.text }]}>{c.name}</Text>
              <Text style={[styles.cuidadorDist, { color: c.text }]}>{c.dist}</Text>
            </TouchableOpacity>
          ))}
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

        {/* ── Cámara en vivo ── */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('monitor', { abrirCamara: true })}
          style={styles.cameraCard}
        >
          <View style={styles.cameraHeader}>
            <Text style={styles.cameraLabel}>cámara en vivo</Text>
            <View style={styles.liveBadge}>
              <PulseDot color={Colors.successDark} />
              <Text style={styles.liveText}>live</Text>
            </View>
          </View>
          <View style={styles.videoPlaceholder}>
            <Feather name="video" size={24} color={Colors.brownMid} />
            <Text style={styles.tapToView}>toca para ver monitor</Text>
          </View>
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

  // Cuidadores
  sectionLabel: {
    fontSize: 13, color: Colors.textSecondary,
    fontWeight: '600', marginBottom: 10, marginLeft: 4,
  },
  cuidadorCard:     { flex: 1, padding: 14, borderRadius: 20, height: 72, justifyContent: 'center' },
  cuidadorSelected: { borderWidth: 1.5, borderColor: Colors.brownLight },
  cuidadorName:     { fontSize: 12, fontWeight: '500' },
  cuidadorDist:     { fontSize: 18, fontWeight: '700', marginTop: 2 },

  // Llantos
  llantoCard: {
    borderRadius: 22, padding: 18, marginBottom: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  llantoLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  llantoTitulo: { fontSize: 14, fontWeight: '600' },
  llantoSub:    { fontSize: 12, marginTop: 2 },

  // Cámara
  cameraCard:   { backgroundColor: Colors.bgCard, borderRadius: 24, padding: 16, marginBottom: 14 },
  cameraHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cameraLabel:  { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  liveBadge:    {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.success, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  liveText:        { fontSize: 11, fontWeight: '700', color: Colors.successDark },
  videoPlaceholder:{
    height: 100, backgroundColor: '#1A1A1A', borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  tapToView: { color: Colors.brownLight, fontSize: 11, marginTop: 6, opacity: 0.8 },
});
