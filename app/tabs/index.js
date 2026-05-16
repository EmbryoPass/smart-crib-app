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
import { auth } from '../constants/firebase';

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

// ─── Hook: nombre del cuidador desde Firebase ──────────────────────────────
const useNombreCuidador = () => {
  const [nombre, setNombre] = useState('');

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const db = getDatabase();
    return onValue(ref(db, `usuarios/${uid}/nombre`), (snap) => {
      setNombre(snap.val() ?? '');
    });
  }, []);

  return nombre;
};

// ─── Hook: cuenta de llantos hoy desde Firebase ────────────────────────────
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
      <Text style={{ fontSize: 18 }}>{detected ? '🧸' : '🛏️'}</Text>
    </View>
    <View style={styles.cunaLegs}>
      <View style={[styles.cunaLeg, { backgroundColor: Colors.brownPale }]} />
      <View style={[styles.cunaLeg, { backgroundColor: Colors.brownPale }]} />
    </View>
  </View>
);

// ─── Mensaje de aviso de ambiente ──────────────────────────────────────────
const getMensajeAmbiente = (temperatura, humedad, tempFuera, humedadFuera) => {
  if (tempFuera && humedadFuera)
    return { tipo: 'warn', texto: 'revisa las condiciones del cuarto — temperatura y humedad fuera del rango ideal.' };
  if (tempFuera)
    return { tipo: 'warn', texto: temperatura < 18
      ? 'el cuarto está frío. asegúrate de que el bebé esté bien abrigado.'
      : 'el cuarto está caliente para dormir. ventila el cuarto o usa un ventilador.' };
  if (humedadFuera)
    return { tipo: 'warn', texto: humedad > 60
      ? 'el cuarto está muy húmedo. abre una ventana para ventilar.'
      : 'el ambiente está seco. un humidificador ayuda a que el bebé respire mejor.' };
  if (temperatura != null && humedad != null)
    return { tipo: 'ok', texto: 'el cuarto está en condiciones ideales para el bebé. ✓' };
  return null;
};

// ═══════════════════════════════════════════════════════════════════════════
export default function Inicio() {
  const navigation = useNavigation();
  const nombre     = useNombreCuidador();

  const {
    tempBebe, bebeDetectado, termicoConectado,
    temperatura, humedad,
    llantoActivo, ultimoLlanto,
  } = useSensor();

  const llantosHoy = useLlantosHoy();

  const tempFueraDeRango    = temperatura != null && (temperatura < 18 || temperatura > 22);
  const humedadFueraDeRango = humedad     != null && (humedad < 40     || humedad > 60);
  const tempEnRango         = temperatura != null && temperatura >= 18 && temperatura <= 22;
  const humedadEnRango      = humedad     != null && humedad >= 40     && humedad <= 60;
  const mensajeAmbiente     = getMensajeAmbiente(temperatura, humedad, tempFueraDeRango, humedadFueraDeRango);

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
          <Text style={styles.greeting}>
            {getSaludo()}{nombre ? `, ${nombre}` : ''}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => navigation.navigate('historial', { tab: 'alertas', filtro: 'todos' })}
          >
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
          <View style={[
            styles.ambCard,
            { backgroundColor: Colors.bgCard },
            tempFueraDeRango && { borderWidth: 1.5, borderColor: '#E8C94A' },
            tempEnRango      && { borderWidth: 1.5, borderColor: '#A8D5C2' },
          ]}>
            <Text style={styles.ambIcon}>🌡️</Text>
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
          <View style={[
            styles.ambCard,
            { backgroundColor: Colors.bgCard },
            humedadFueraDeRango && { borderWidth: 1.5, borderColor: '#E8C94A' },
            humedadEnRango      && { borderWidth: 1.5, borderColor: '#A8D5C2' },
          ]}>
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

        {/* ── Aviso / mensaje de ambiente ── */}
        {mensajeAmbiente && (
          <View style={[
            styles.avisoCard,
            mensajeAmbiente.tipo === 'ok' && { backgroundColor: '#EBF7F2', borderColor: '#A8D5C2' },
          ]}>
            <View style={[
              styles.avisoIconWrap,
              mensajeAmbiente.tipo === 'ok' && { backgroundColor: '#A8D5C2' },
            ]}>
              <Text style={styles.avisoEmoji}>
                {mensajeAmbiente.tipo === 'ok' ? '✓' : '⚠️'}
              </Text>
            </View>
            <Text style={[
              styles.avisoTexto,
              mensajeAmbiente.tipo === 'ok' && { color: '#2A7A5A' },
            ]}>
              {mensajeAmbiente.texto}
            </Text>
          </View>
        )}

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
            <Ionicons name="ear-outline" size={18} color={Colors.brown} />
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
                estadísticas del día
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
                cámara
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

  row:     { flexDirection: 'row', gap: 10, marginBottom: 14 },
  ambCard: { flex: 1, borderRadius: 22, padding: 16, gap: 2 },
  ambIcon:  { fontSize: 20, marginBottom: 4 },
  ambLabel: { fontSize: 11, color: Colors.textTertiary },
  ambValue: { fontSize: 26, fontWeight: '700', color: Colors.brown, letterSpacing: -0.5 },
  ambHint:  { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },

  avisoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FDF6D8',
    borderWidth: 1.5, borderColor: '#E8C94A',
    borderRadius: 18, padding: 14,
    marginBottom: 14,
  },
  avisoIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#E8C94A',
    alignItems: 'center', justifyContent: 'center',
  },
  avisoEmoji: { fontSize: 18 },
  avisoTexto: { flex: 1, fontSize: 13, color: '#7A5C00', lineHeight: 19, fontWeight: '500' },

  llantoCard: {
    borderRadius: 22, padding: 18, marginBottom: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  llantoLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  llantoTitulo: { fontSize: 14, fontWeight: '600' },
  llantoSub:    { fontSize: 12, marginTop: 2 },
});
