// app/tabs/ajustes.js — Capullo App
import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getDatabase, ref, onValue, set } from 'firebase/database';
import { auth, signOut } from '../constants/firebase';
import { useSensor } from '../constants/SensorContext';
import Colors from '../constants/colors';

// ─── Hook: nombre del cuidador ─────────────────────────────────────────────
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

  return [nombre, setNombre];
};

// ─── Hook: estado de cámaras ───────────────────────────────────────────────
// ─── Hook: voltajes desde Firebase ────────────────────────────────────────
const useVoltajes = () => {
  const [fuente, setFuente] = useState(null);
  const [pila,   setPila  ] = useState(null);

  useEffect(() => {
    const db = getDatabase();
    const u1 = onValue(ref(db, '/voltajes/fuente29V'), s => setFuente(s.val()));
    const u2 = onValue(ref(db, '/voltajes/pila12V'),   s => setPila(s.val()));
    return () => { u1(); u2(); };
  }, []);

  return { fuente, pila };
};

// ─── Componentes ──────────────────────────────────────────────────────────
const SeccionTitulo = ({ texto }) => (
  <Text style={s.seccionTitulo}>{texto}</Text>
);

const InfoRow = ({ icono, label, valor, valorColor }) => (
  <View style={s.row}>
    <View style={s.rowLeft}>
      <View style={s.iconWrap}>
        <Ionicons name={icono} size={16} color={Colors.brownLight} />
      </View>
      <Text style={s.rowLabel}>{label}</Text>
    </View>
    <Text style={[s.rowValor, valorColor && { color: valorColor }]}>{valor}</Text>
  </View>
);

// ═══════════════════════════════════════════════════════════════════════════
export default function Ajustes() {
  const [nombre, setNombre]     = useNombreCuidador();
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState('');
  const { cameraIp, cameraIpIR, enBateria } = useSensor();
  const { fuente, pila } = useVoltajes();

  const email = auth.currentUser?.email ?? '—';

  const iniciarEdicion = () => {
    setBorrador(nombre);
    setEditando(true);
  };

  const guardarNombre = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const trimmed = borrador.trim();
    if (!trimmed) return;
    try {
      await set(ref(getDatabase(), `usuarios/${uid}/nombre`), trimmed);
      setEditando(false);
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar el nombre.');
    }
  };

  const cancelarEdicion = () => {
    setEditando(false);
    setBorrador('');
  };

  const cerrarSesion = () => {
    Alert.alert(
      'cerrar sesión',
      '¿estás segur@ de que quieres salir?',
      [
        { text: 'cancelar', style: 'cancel' },
        { text: 'salir', style: 'destructive', onPress: () => signOut(auth) },
      ]
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>ajustes</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Cuidador ── */}
        <SeccionTitulo texto="cuidador" />
        <View style={s.card}>

          {/* Avatar con iniciales */}
          <View style={s.avatarRow}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>
                {nombre ? nombre.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.avatarNombre}>{nombre || 'sin nombre'}</Text>
              <Text style={s.avatarEmail}>{email}</Text>
            </View>
            {!editando && (
              <TouchableOpacity onPress={iniciarEdicion} style={s.editBtn}>
                <Ionicons name="pencil-outline" size={16} color={Colors.brownLight} />
              </TouchableOpacity>
            )}
          </View>

          {/* Editor inline */}
          {editando && (
            <View style={s.editorWrap}>
              <TextInput
                style={s.input}
                value={borrador}
                onChangeText={setBorrador}
                placeholder="tu nombre"
                placeholderTextColor={Colors.textTertiary}
                autoFocus
                maxLength={30}
              />
              <View style={s.editorBtns}>
                <TouchableOpacity style={s.btnCancelar} onPress={cancelarEdicion}>
                  <Text style={[s.btnText, { color: Colors.textSecondary }]}>cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnGuardar} onPress={guardarNombre}>
                  <Text style={[s.btnText, { color: '#F5F0E8' }]}>guardar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ── Dispositivo ── */}
        <SeccionTitulo texto="dispositivo" />
        <View style={s.card}>
          <InfoRow
            icono="sunny-outline"
            label="cámara día"
            valor={cameraIp ?? 'sin señal'}
            valorColor={cameraIp ? Colors.textSecondary : Colors.textTertiary}
          />
          <View style={s.divider} />
          <InfoRow
            icono="moon-outline"
            label="cámara IR"
            valor={cameraIpIR ?? 'sin señal'}
            valorColor={cameraIpIR ? Colors.textSecondary : Colors.textTertiary}
          />
        </View>

        {/* ── Energía ── */}
        <SeccionTitulo texto="energía" />
        <View style={s.card}>
          <InfoRow
            icono={fuente != null && fuente < 5 ? 'battery-half-outline' : 'flash-outline'}
            label="fuente"
            valor={fuente == null ? '—' : fuente < 5 ? 'batería' : 'corriente'}
            valorColor={fuente != null && fuente < 5 ? '#B85C00' : Colors.successDark}
          />
          <View style={s.divider} />
          <InfoRow
            icono="flash-outline"
            label="voltaje fuente"
            valor={fuente != null ? `${fuente.toFixed(1)} V` : '— V'}
            valorColor={
              fuente == null ? Colors.textTertiary
              : fuente < 5   ? '#C05050'
              : Colors.textSecondary
            }
          />
          <View style={s.divider} />
          <InfoRow
            icono="battery-charging-outline"
            label="voltaje batería"
            valor={pila != null ? `${pila.toFixed(1)} V` : '— V'}
            valorColor={
              pila == null  ? Colors.textTertiary
              : pila < 11   ? '#C05050'
              : pila < 11.5 ? '#B85C00'
              : Colors.textSecondary
            }
          />
        </View>

        {/* ── Cuenta ── */}
        <SeccionTitulo texto="cuenta" />
        <TouchableOpacity style={s.btnSalir} onPress={cerrarSesion} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color="#C05050" />
          <Text style={s.btnSalirText}>cerrar sesión</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title:  { fontSize: 22, fontWeight: '600', letterSpacing: -0.5, color: Colors.brown },
  scroll: { paddingHorizontal: 20, paddingTop: 4 },

  seccionTitulo: {
    fontSize: 11, fontWeight: '600', color: Colors.textTertiary,
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginTop: 20, marginBottom: 8, marginLeft: 4,
  },

  card: {
    backgroundColor: Colors.bgCard, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.brownPale,
    overflow: 'hidden',
  },

  // Avatar
  avatarRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  avatar:      {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.brownPale,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:  { fontSize: 20, fontWeight: '700', color: Colors.brown },
  avatarNombre:{ fontSize: 15, fontWeight: '600', color: Colors.brown },
  avatarEmail: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  editBtn:     {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.bgSurface,
    alignItems: 'center', justifyContent: 'center',
  },

  // Editor
  editorWrap: { paddingHorizontal: 16, paddingBottom: 14, gap: 10 },
  input: {
    backgroundColor: Colors.bgSurface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.brownPale,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: Colors.brown,
  },
  editorBtns:  { flexDirection: 'row', gap: 8 },
  btnCancelar: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: Colors.bgSurface,
    alignItems: 'center',
  },
  btnGuardar:  {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: Colors.brown,
    alignItems: 'center',
  },
  btnText: { fontSize: 14, fontWeight: '500' },

  // Info rows
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13,
  },
  rowLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: Colors.bgSurface,
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { fontSize: 14, color: Colors.brown },
  rowValor: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  divider:  { height: 1, backgroundColor: Colors.brownPale, marginHorizontal: 16 },

  // Cerrar sesión
  btnSalir: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FCEAEA', borderRadius: 18,
    borderWidth: 1, borderColor: '#F0BFBF',
    padding: 16,
  },
  btnSalirText: { fontSize: 15, fontWeight: '600', color: '#C05050' },
});