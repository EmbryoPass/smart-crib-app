import { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSensor } from '../constants/SensorContext';

// ── Colores por tipo de alerta ─────────────────────────────────────────────
const TEMA = {
  // Temperatura sola
  temp: {
    critico_calor: { bg: '#7B1A1A', borde: '#FF4444', icono: '🔥' },
    alerta_calor:  { bg: '#7B3A1A', borde: '#FF7A00', icono: '🔴' },
    precaucion:    { bg: '#5C4A00', borde: '#FFD000', icono: '🟡' },
    frio:          { bg: '#1A2E5C', borde: '#4A8FFF', icono: '🔵' },
    frio_critico:  { bg: '#0D1F3C', borde: '#00AAFF', icono: '🔥' },
    tendencia_alcista: { bg: '#4A2D00', borde: '#FF9500', icono: '📈' },
    normalizacion_temp: { bg: '#1A3A1A', borde: '#4CAF50', icono: '✅' },
  },
  // Humedad sola
  hum: {
    muy_seco:   { bg: '#3A2200', borde: '#C8860A', icono: '🌵' },
    seco:       { bg: '#2E2000', borde: '#A0700A', icono: '💧' },
    humedo:     { bg: '#0D2030', borde: '#2196F3', icono: '💧' },
    muy_humedo: { bg: '#0A1A30', borde: '#0D47A1', icono: '🌊' },
    normalizacion_hum: { bg: '#1A3A1A', borde: '#4CAF50', icono: '✅' },
  },
  // Combinados y fallback
  combo: {
    critico:  { bg: '#4A0A0A', borde: '#FF1111', icono: '🚨' },
    moderado: { bg: '#3A2000', borde: '#FF6600', icono: '⚠️' },
    leve:     { bg: '#2A2A00', borde: '#CCCC00', icono: '⚠️' },
  },
};

const getTema = (alerta) => {
  if (!alerta) return null;
  if (alerta.tipo === 'combo')    return TEMA.combo[alerta.severity] || TEMA.combo.moderado;
  if (alerta.tipo === 'temp')     return TEMA.temp[alerta.zona]  || TEMA.temp.alerta_calor;
  if (alerta.tipo === 'hum')      return TEMA.hum[alerta.zona]   || TEMA.hum.muy_humedo;
  if (alerta.tipo === 'tendencia_alcista')  return TEMA.temp.tendencia_alcista;
  if (alerta.tipo === 'normalizacion_temp') return TEMA.temp.normalizacion_temp;
  if (alerta.tipo === 'normalizacion_hum')  return TEMA.hum.normalizacion_hum;
  return { bg: '#2A2A2A', borde: '#888888', icono: 'ℹ️' };
};

// Normalización se cierra sola en 5 s; el resto requiere toque manual
const AUTO_DISMISS_TIPOS = new Set(['normalizacion_temp', 'normalizacion_hum']);
const AUTO_DISMISS_MS    = 5000;

// extraTop: píxeles adicionales de desplazamiento hacia abajo
// (lo usa App.js para evitar traslape con LlantoBanner)
export default function AlertaAmbienteBanner({ extraTop = 0 }) {
  const { alertaAmbiente, dismissAlertaAmbiente } = useSensor();

  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const autoDismissTimer = useRef(null);

  // ── Animar entrada / salida ────────────────────────────────────────────
  useEffect(() => {
    if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);

    if (alertaAmbiente) {
      // Entra desde arriba
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(opacity,    { toValue: 1, useNativeDriver: true, duration: 200 }),
      ]).start();

      // Auto-dismiss para normalizaciones
      if (AUTO_DISMISS_TIPOS.has(alertaAmbiente.tipo)) {
        autoDismissTimer.current = setTimeout(dismissAlertaAmbiente, AUTO_DISMISS_MS);
      }
    } else {
      // Sale hacia arriba
      Animated.parallel([
        Animated.timing(translateY, { toValue: -120, useNativeDriver: true, duration: 250 }),
        Animated.timing(opacity,    { toValue: 0,    useNativeDriver: true, duration: 200 }),
      ]).start();
    }

    return () => { if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current); };
  }, [alertaAmbiente]);

  if (!alertaAmbiente) return null;

  const tema = getTema(alertaAmbiente);

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { transform: [{ translateY }], opacity, paddingTop: 52 + extraTop },
      ]}
      pointerEvents="box-none"
    >
      <View style={[styles.banner, { backgroundColor: tema.bg, borderLeftColor: tema.borde }]}>
        {/* Icono + textos */}
        <Text style={styles.icono}>{tema.icono}</Text>
        <View style={styles.textos}>
          <Text style={styles.titulo} numberOfLines={1}>{alertaAmbiente.titulo}</Text>
          <Text style={styles.cuerpo}>{alertaAmbiente.cuerpo}</Text>
        </View>

        {/* Botón cerrar — no aparece en normalizaciones (se cierran solas) */}
        {!AUTO_DISMISS_TIPOS.has(alertaAmbiente.tipo) && (
          <Pressable
            style={({ pressed }) => [styles.cerrar, pressed && styles.cerrarPressed]}
            onPress={dismissAlertaAmbiente}
            hitSlop={12}
          >
            <Text style={[styles.cerrarTexto, { color: tema.borde }]}>✕</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position:  'absolute',
    top:        0,
    left:       0,
    right:      0,
    zIndex:     9999,
    paddingTop: 52,      // espacio para status bar (ajusta según tu setup)
    paddingHorizontal: 12,
  },
  banner: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    borderRadius:   14,
    borderLeftWidth: 4,
    paddingVertical:   12,
    paddingHorizontal: 14,
    // Sombra
    shadowColor:   '#000',
    shadowOpacity:  0.4,
    shadowRadius:   8,
    shadowOffset:  { width: 0, height: 4 },
    elevation:      8,
  },
  icono: {
    fontSize:    22,
    marginRight: 10,
    marginTop:    1,
  },
  textos: {
    flex: 1,
    gap:  3,
  },
  titulo: {
    color:      '#FFFFFF',
    fontSize:   14,
    fontWeight: '700',
    lineHeight: 18,
  },
  cuerpo: {
    color:      'rgba(255,255,255,0.82)',
    fontSize:   12.5,
    lineHeight: 17,
  },
  cerrar: {
    marginLeft:  10,
    paddingLeft:  4,
    marginTop:    1,
  },
  cerrarPressed: {
    opacity: 0.5,
  },
  cerrarTexto: {
    fontSize:   16,
    fontWeight: '600',
  },
});
