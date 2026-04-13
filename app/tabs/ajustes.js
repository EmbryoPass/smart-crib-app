import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '../constants/colors';

export default function Ajustes() {
  const [tab, setTab] = useState('conexion');

  const renderTabs = () => (
    <View style={styles.tabs}>
      {['conexion', 'notif', 'apariencia'].map((t) => (
        <TouchableOpacity
          key={t}
          style={[styles.tab, tab === t && styles.tabActive]}
          onPress={() => setTab(t)}
        >
          <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
            {t}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderConexion = () => (
    <>
      <Card title="estado wifi" value="Casa_Red" badge="activo" />
      <Card title="IP del ESP32" value="192.168.4.1" />
      <SwitchCard title="modo Access Point" subtitle="sin router externo" />
      <Card title="intervalo sensor" value="5 seg" />
      <Button text="probar conexión" />
    </>
  );

  const renderNotif = () => (
    <>
      <SwitchCard title="llanto detectado" subtitle="notificación inmediata" />
      <SwitchCard title="temperatura alta" subtitle="umbral: 38°C" />
      <SwitchCard title="cambio de altura" subtitle="al ajustar manualmente" />
      <SwitchCard title="no molestar" subtitle="23:00 — 07:00" />
    </>
  );

  const renderApariencia = () => (
    <>
      <SwitchCard title="modo noche" subtitle="pantalla oscura y tenue" />
      <SwitchCard title="activación automática" subtitle="21:00 — 07:00" />
    </>
  );

  const renderContent = () => {
    if (tab === 'conexion') return renderConexion();
    if (tab === 'notif') return renderNotif();
    return renderApariencia();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>ajustes</Text>

        {renderTabs()}

        <View style={styles.content}>
          {renderContent()}
        </View>
      </View>
    </SafeAreaView>
  );
}

/* 🔹 COMPONENTES */

function Card({ title, value, badge }) {
  return (
    <View style={styles.card}>
      <View>
        <Text style={styles.cardTitle}>{title}</Text>
        {value && <Text style={styles.cardValue}>{value}</Text>}
      </View>
      {badge && <Text style={styles.badge}>{badge}</Text>}
    </View>
  );
}

function SwitchCard({ title, subtitle }) {
  const [value, setValue] = useState(true);

  return (
    <View style={styles.card}>
      <View>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSub}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={setValue}
        trackColor={{ true: Colors.success, false: '#ccc' }}
        thumbColor={'#fff'}
      />
    </View>
  );
}

function Button({ text }) {
  return (
    <TouchableOpacity style={styles.button}>
      <Text style={styles.buttonText}>{text}</Text>
    </TouchableOpacity>
  );
}

/* 🔹 ESTILOS */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  container: {
    flex: 1,
    padding: 16,
  },

  title: {
    fontSize: 24,
    color: Colors.brown,
    marginBottom: 10,
  },

  /* Tabs */
  tabs: {
    flexDirection: 'row',
    marginBottom: 16,
  },

  tab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: Colors.bgSurface,
  },

  tabActive: {
    backgroundColor: Colors.brownLight,
  },

  tabText: {
    color: Colors.textSecondary,
  },

  tabTextActive: {
    color: Colors.brown,
    fontWeight: '500',
  },

  /* Cards */
  content: {
    gap: 12,
  },

  card: {
    backgroundColor: Colors.bgCard,
    padding: 14,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderColor: Colors.brownPale,
    borderWidth: 1,
  },

  cardTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
  },

  cardValue: {
    color: Colors.textSecondary,
    fontSize: 13,
  },

  cardSub: {
    color: Colors.textTertiary,
    fontSize: 12,
  },

  badge: {
    backgroundColor: Colors.success,
    color: Colors.successDark,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    fontSize: 12,
  },

  /* Button */
  button: {
    backgroundColor: Colors.yellow,
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
  },

  buttonText: {
    color: Colors.brown,
    fontWeight: '500',
  },
});