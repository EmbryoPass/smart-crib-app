import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Colors from '../constants/colors'; // Verifica que esta ruta sea correcta en tu proyecto

// ─── COMPONENTES VISUALES ────────────────────────────────────────────────────

// Icono de la cunita
const BabyIcon = () => (
  <View style={styles.babyContainer}>
    <View style={styles.cradle}>
      <Text style={{ fontSize: 16 }}>😊</Text>
    </View>
    <View style={styles.cradleLegs}>
      <View style={styles.leg} />
      <View style={styles.leg} />
    </View>
  </View>
);

// Puntito verde animado ("Live")
const LiveDot = () => {
  const pulse = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.4, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  return (
    <View style={styles.liveDotWrapper}>
      <Animated.View style={[styles.liveDotOuter, { transform: [{ scale: pulse }] }]} />
      <View style={styles.liveDotInner} />
    </View>
  );
};

// ─── PANTALLA PRINCIPAL ──────────────────────────────────────────────────────

export default function Inicio() {
  const navigation = useNavigation();
  const [caregiver, setCaregiver] = useState('Mamá');
  const [sleeping, setSleeping]   = useState(true);

  // Datos para renderizar los cuidadores
  const caregivers = [
    { id: '1', name: 'Mamá',   dist: '65 cm', bg: Colors.danger,  text: Colors.dangerDark },
    { id: '2', name: 'Papá',   dist: '80 cm', bg: '#E3F2FD',      text: '#1B4F72' },
    { id: '3', name: 'Abuela', dist: '55 cm', bg: Colors.success, text: Colors.successDark },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>
            capullo<Text style={{ color: Colors.brownLight }}>.</Text>
          </Text>
          <Text style={styles.greeting}>buenos días, Sofía</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity>
            <Ionicons name="ellipsis-horizontal" size={22} color={Colors.brown} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.bellBtn}>
            <Ionicons name="notifications-outline" size={22} color={Colors.brown} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scroll} 
        showsVerticalScrollIndicator={false}
      >
        
        {/* Tarjeta de Temperatura */}
        <TouchableOpacity 
          activeOpacity={0.9} 
          onPress={() => setSleeping(!sleeping)}
          style={styles.tempCard}
        >
          <View style={styles.tempCardInfo}>
            <View style={[styles.statusPill, { backgroundColor: sleeping ? Colors.success : Colors.danger }]}>
              <Text style={[styles.statusText, { color: sleeping ? Colors.successDark : Colors.dangerDark }]}>
                {sleeping ? 'durmiendo tranquilo' : 'bebé despierto'}
              </Text>
            </View>
            <Text style={styles.tempValue}>36.8<Text style={styles.tempUnit}>ºC</Text></Text>
            <Text style={styles.tempSub}>temperatura bebé · hace 12s</Text>
          </View>
          <BabyIcon />
        </TouchableOpacity>

        {/* Sección Cuidadores */}
        <Text style={styles.sectionLabel}>¿quién atiende?</Text>
        <View style={styles.row}>
          {caregivers.map((c) => (
            <TouchableOpacity 
              key={c.id}
              onPress={() => setCaregiver(c.name)}
              style={[
                styles.caregiverCard, 
                { backgroundColor: c.bg },
                caregiver === c.name && styles.caregiverSelected
              ]}
            >
              <Text style={[styles.caregiverLabel, { color: c.text }]}>{c.name}</Text>
              <Text style={[styles.caregiverValue, { color: c.text }]}>{c.dist}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Stats Rápidas */}
        <View style={styles.row}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>sueño</Text>
            <Text style={styles.statValue}>6h 20m</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>llantos</Text>
            <Text style={styles.statValue}>2 hoy</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>prom.</Text>
            <Text style={styles.statValue}>36.8º</Text>
          </View>
        </View>

        {/* Cámara en Vivo (Navegación al Monitor) */}
        <TouchableOpacity 
          activeOpacity={0.8} 
          onPress={() => navigation.navigate('monitor', {abrirCamara: true})} // <--- Navegación activada
          style={styles.cameraContainer}
        >
          <View style={styles.cameraHeader}>
            <Text style={styles.cameraLabel}>cámara en vivo</Text>
            <View style={styles.liveBadge}>
              <LiveDot />
              <Text style={styles.liveText}>live</Text>
            </View>
          </View>
          <View style={styles.videoPlaceholder}>
            <Feather name="video" size={24} color={Colors.brownMid} />
            <Text style={styles.tapToView}>toca para ver monitor</Text>
          </View>
        </TouchableOpacity>

        {/* Alerta de Llanto */}
        <View style={styles.alertCard}>
          <Text style={styles.alertTitle}>llanto detectado</Text>
          <Text style={styles.alertSub}>hace 1h 12min · 3 min</Text>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── ESTILOS ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 25, paddingTop: 15, paddingBottom: 15
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  appName: { fontSize: 28, fontWeight: '700', color: Colors.brown, letterSpacing: -0.5 },
  greeting: { fontSize: 13, color: Colors.textSecondary, marginTop: -2 },
  bellBtn: { 
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.bgSurface, 
    alignItems: 'center', justifyContent: 'center' 
  },
  
  scroll: { paddingHorizontal: 20, paddingTop: 10 },

  // Tarjeta Temperatura
  tempCard: {
    backgroundColor: Colors.bgCard, borderRadius: 30, padding: 22,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20, 
    ...Platform.select({ 
      ios: { shadowColor: Colors.brown, shadowOpacity: 0.05, shadowRadius: 10 }, 
      android: { elevation: 2 } 
    })
  },
  tempCardInfo: { flex: 1 },
  statusPill: { 
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, 
    alignSelf: 'flex-start', marginBottom: 8 
  },
  statusText: { fontSize: 12, fontWeight: '600' },
  tempValue: { fontSize: 48, fontWeight: 'bold', color: Colors.brown },
  tempUnit: { fontSize: 22, fontWeight: '400' },
  tempSub: { fontSize: 12, color: Colors.textTertiary },

  // Baby Icon
  babyContainer: { alignItems: 'center', marginLeft: 15 },
  cradle: { 
    width: 75, height: 42, backgroundColor: Colors.bgCard, borderRadius: 25, 
    borderWidth: 2, borderColor: Colors.brownPale, alignItems: 'center', justifyContent: 'center' 
  },
  cradleLegs: { flexDirection: 'row', gap: 30, marginTop: -4 },
  leg: { width: 2, height: 12, backgroundColor: Colors.brownPale },

  // Grid Layout
  sectionLabel: { fontSize: 13, color: Colors.textSecondary, marginBottom: 10, fontWeight: '600', marginLeft: 5 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 15 },

  // Cuidadores
  caregiverCard: { flex: 1, padding: 15, borderRadius: 20, height: 75, justifyContent: 'center' },
  caregiverSelected: { borderWidth: 1.5, borderColor: Colors.brownLight },
  caregiverLabel: { fontSize: 12, fontWeight: '500' },
  caregiverValue: { fontSize: 17, fontWeight: '700' },

  // Stats Rápidas
  statCard: { flex: 1, backgroundColor: Colors.bgCard, padding: 15, borderRadius: 20, height: 75 },
  statLabel: { fontSize: 11, color: Colors.textSecondary },
  statValue: { fontSize: 15, fontWeight: '700', color: Colors.brown, marginTop: 2 },

  // Cámara
  cameraContainer: { backgroundColor: Colors.bgCard, borderRadius: 25, padding: 15, marginBottom: 15 },
  cameraHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' },
  cameraLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  liveBadge: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.success, 
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, gap: 6 
  },
  liveDotWrapper: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  liveDotOuter: { 
    width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.successDark, 
    opacity: 0.3, position: 'absolute' 
  },
  liveDotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.successDark },
  liveText: { fontSize: 11, fontWeight: 'bold', color: Colors.successDark },
  
  videoPlaceholder: { 
    height: 100, backgroundColor: '#1A1A1A', borderRadius: 20, 
    justifyContent: 'center', alignItems: 'center' 
  },
  tapToView: { color: Colors.brownLight, fontSize: 11, marginTop: 6, opacity: 0.8 },

  // Alerta
  alertCard: { backgroundColor: Colors.danger, padding: 18, borderRadius: 25 },
  alertTitle: { color: Colors.dangerDark, fontWeight: 'bold', fontSize: 14 },
  alertSub: { color: Colors.dangerDark, fontSize: 12, opacity: 0.8, marginTop: 2 },
});