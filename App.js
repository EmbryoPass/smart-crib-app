import { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet } from 'react-native';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';
 
import Colors from './app/constants/colors';
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
 
export default function App() {
  const [usuario, setUsuario] = useState(null);
 
  // Si no hay sesión → pantalla de auth
  if (!usuario) {
    return <InicioSesion onAuthSuccess={(datos) => setUsuario(datos)} />;
  }
 
  // Si hay sesión → app normal con tabs
  return (
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
    </NavigationContainer>
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
 