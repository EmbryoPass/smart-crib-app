import { useState, useEffect, useRef } from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, View, Text, TouchableOpacity, Animated } from 'react-native';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';

import Colors from './app/constants/colors';
import { SensorProvider, useSensor } from './app/constants/SensorContext';
import Inicio from './app/tabs/index';
import Monitor from './app/tabs/monitor';
import Cuna from './app/tabs/cuna';
import Historial from './app/tabs/historial';
import Ajustes from './app/tabs/ajustes';
import InicioSesion from './app/tabs/InicioSesion';

const Tab = createBottomTabNavigator();

function IconInicio({ color }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 16 16" fill="none">
      <Path
        d="M2 7L8 2l6 5v6.5a.5.5 0 01-.5.5H10v-4H6v4H2.5a.5.5 0 01-.5-.5z"
        stroke={color} strokeWidth={1.3} fill={color} fillOpacity={0.2} strokeLinejoin="round"
      />
    </Svg>
  );
}

function IconMonitor({ color }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 16 16" fill="none">
      <Rect x={1} y={4} width={10} height={8} rx={2} stroke={color} strokeWidth={1.2} />
      <Circle cx={6} cy={8} r={2} stroke={color} strokeWidth={1.1} />
      <Path d="M11 6.5l4-2v7l-4-2" stroke={color} strokeWidth={1.2} fill="none" />
    </Svg>
  );
}

function IconCuna({ color }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 16 16" fill="none">
      <Rect x={1} y={5} width={14} height={9} rx={4} stroke={color} strokeWidth={1.3} />
      <Line x1={4} y1={14} x2={3} y2={17} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={12} y1={14} x2={13} y2={17} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M5 2.5Q8 1 11 2.5" stroke={color} strokeWidth={1.2} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function IconHistorial({ color }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 16 16" fill="none">
      <Rect x={1}  y={10} width={3}  height={5}  rx={0.5} fill={color} opacity={0.5} />
      <Rect x={6}  y={7}  width={3}  height={8}  rx={0.5} fill={color} opacity={0.5} />
      <Rect x={11} y={4}  width={3}  height={11} rx={0.5} fill={color} opacity={0.5} />
    </Svg>
  );
}

function IconAjustes({ color }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 16 16" fill="none">
      <Circle cx={8} cy={8} r={3} stroke={color} strokeWidth={1.2} />
      <Path
        d="M8 1v2M8 13v2M1 8h2M13 8h2M3.3 3.3l1.4 1.4M11.3 11.3l1.4 1.4M3.3 12.7l1.4-1.4M11.3 4.7l1.4-1.4"
        stroke={color} strokeWidth={1.1} strokeLinecap="round"
      />
    </Svg>
  );
}

function LlantoBanner() {
  const { llantoActivo } = useSensor();
  const navigation       = useNavigation();
  const translateY       = useRef(new Animated.Value(-120)).current;
  const pulse            = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (llantoActivo) {
      Animated.spring(translateY, {
        toValue: 0, useNativeDriver: true, tension: 80, friction: 10,
      }).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.04, duration: 500, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1,    duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      Animated.timing(translateY, {
        toValue: -120, duration: 280, useNativeDriver: true,
      }).start();
      pulse.stopAnimation();
      pulse.setValue(1);
    }
  }, [llantoActivo]);

  return (
    <Animated.View
      pointerEvents={llantoActivo ? 'box-none' : 'none'}
      style={[
        bannerStyles.wrapper,
        { transform: [{ translateY }, { scale: pulse }] },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => navigation.navigate('historial', { tab: 'alertas', filtro: 'llanto' })}
        style={bannerStyles.card}
      >
        <View style={bannerStyles.dotWrap}>
          <View style={bannerStyles.dotOuter} />
          <View style={bannerStyles.dotInner} />
        </View>
        <View style={bannerStyles.texts}>
          <Text style={bannerStyles.titulo}>{'bebe llorando'}</Text>
          <Text style={bannerStyles.sub}>{'toca para ver historial de alertas'}</Text>
        </View>
        <Text style={bannerStyles.arrow}>{'>'}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function App() {
  const [usuario, setUsuario] = useState(null);

  if (!usuario) {
    return <InicioSesion onAuthSuccess={(datos) => setUsuario(datos)} />;
  }

  return (
    <SensorProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: styles.tabBar,
            tabBarActiveTintColor: Colors.brown,
            tabBarInactiveTintColor: Colors.brownLight,
            tabBarLabelStyle: styles.tabLabel,
          }}
        >
          <Tab.Screen
            name="inicio"
            component={Inicio}
            options={{ tabBarIcon: ({ color }) => <IconInicio color={color} /> }}
          />
          <Tab.Screen
            name="monitor"
            component={Monitor}
            options={{ tabBarIcon: ({ color }) => <IconMonitor color={color} /> }}
          />
          <Tab.Screen
            name="cuna"
            component={Cuna}
            options={{ tabBarIcon: ({ color }) => <IconCuna color={color} /> }}
          />
          <Tab.Screen
            name="historial"
            component={Historial}
            options={{ tabBarIcon: ({ color }) => <IconHistorial color={color} /> }}
          />
          <Tab.Screen
            name="ajustes"
            component={Ajustes}
            options={{ tabBarIcon: ({ color }) => <IconAjustes color={color} /> }}
          />
        </Tab.Navigator>
        <LlantoBanner />
      </NavigationContainer>
    </SensorProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 1,
    borderTopColor: Colors.brownPale,
    backgroundColor: Colors.bgCard,
    height: 72,
    paddingBottom: 14,
    paddingTop: 8,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
});

const bannerStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute', left: 16, right: 16,
    top: 55,
    zIndex: 999, elevation: 10,
  },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FCEAEA', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1.5, borderColor: '#F0BFBF', gap: 12,
    shadowColor: '#C05050', shadowOpacity: 0.15,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  dotWrap:  { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  dotOuter: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#C05050', opacity: 0.3, position: 'absolute' },
  dotInner: { width: 8,  height: 8,  borderRadius: 4, backgroundColor: '#C05050' },
  texts:    { flex: 1 },
  titulo:   { fontSize: 14, fontWeight: '700', color: '#C05050' },
  sub:      { fontSize: 11, color: '#C05050', opacity: 0.8, marginTop: 1 },
  arrow:    { fontSize: 22, color: '#C05050', fontWeight: '300' },
});