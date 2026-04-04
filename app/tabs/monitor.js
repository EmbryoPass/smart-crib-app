import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import Colors from '../constants/colors';
import { db, ref, onValue } from '../constants/firebase';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, useWindowDimensions } from 'react-native';

// ── Colores del mapa térmico ───────────────────────────────────────────────
const STOPS = [
  [4,   102, 200],
  [72,  202, 228],
  [82,  183, 136],
  [249, 199, 79],
  [243, 114, 44],
  [230, 57,  70],
];

function tempToColor(t, min, max) {
  const ratio = Math.max(0, Math.min(1, (t - min) / (max - min || 1)));
  const idx = ratio * (STOPS.length - 1);
  const i = Math.min(Math.floor(idx), STOPS.length - 2);
  const f = idx - i;
  const [r, g, b] = STOPS[i].map((v, j) => Math.round(v + f * (STOPS[i+1][j] - v)));
  return `rgb(${r},${g},${b})`;
}

function interpolar32(grid8x8) {
  const N = 32;
  const out = [];
  const vals = grid8x8.split(',').map(Number);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const scale = 7 / (N - 1);

  for (let py = 0; py < N; py++) {
    for (let px = 0; px < N; px++) {
      const gx = px * scale;
      const gy = py * scale;
      const x0 = Math.floor(gx), x1 = Math.min(x0 + 1, 7);
      const y0 = Math.floor(gy), y1 = Math.min(y0 + 1, 7);
      const fx = gx - x0, fy = gy - y0;
      const v00 = vals[y0 * 8 + x0];
      const v10 = vals[y0 * 8 + x1];
      const v01 = vals[y1 * 8 + x0];
      const v11 = vals[y1 * 8 + x1];
      const v = v00*(1-fx)*(1-fy) + v10*fx*(1-fy) + v01*(1-fx)*fy + v11*fx*fy;
      out.push(tempToColor(v, min, max));
    }
  }
  return out;
}
// ── Info modals ────────────────────────────────────────────────────────────
const INFO_TERMICO = {
  titulo: 'Sensor térmico',
  descripcion: 'Capullo usa un sensor de calor para mantenerte informado sobre el bienestar de tu bebé en todo momento, sin interrumpir su sueño.\n\nDetecta la presencia del bebé en la cuna y monitorea si su temperatura corporal tiene cambios importantes, enviando una notificación para que puedas revisarlo.\n\nEs una capa extra de tranquilidad para los papás, complementa lo que ves en la cámara con información que no puedes ver a simple vista.\n\nEste sensor es un complemento de monitoreo, no un dispositivo médico. Para una medición exacta de temperatura, utiliza un termómetro.',
};

const INFO_AMBIENTE = {
  titulo: '¿Por qué monitorear el ambiente?',
  descripcion: 'Los bebés no pueden regular su propia temperatura corporal como los adultos, dependen completamente del ambiente que los rodea.\n\nUn cuarto entre 18°C y 22°C es el rango recomendado por la Academia Americana de Pediatría. Un ambiente muy caliente es factor de riesgo del Síndrome de Muerte Súbita del Lactante. Un ambiente muy frío puede causar hipotermia, ya que el bebé no genera suficiente calor propio para mantenerse abrigado.\n\nLa humedad ideal es entre 40% y 60%. Un ambiente muy seco irrita la nariz y garganta del bebé causando congestión. Uno muy húmedo favorece ácaros y hongos que afectan su respiración.',
};

// ── Componente sin conexión ────────────────────────────────────────────────
function SinConexion() {
  return (
    <View style={styles.sinConexionWrap}>
      <Text style={styles.sinConexionEmoji}>📡</Text>
      <Text style={styles.sinConexionTitulo}>Sin conexión</Text>
      <Text style={styles.sinConexionSub}>El sensor no está enviando datos.{'\n'}Verifica que el ESP32 esté encendido y conectado.</Text>
    </View>
  );
}

// ── Componente Modal de info ───────────────────────────────────────────────
function InfoModal({ visible, info, onClose }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitulo}>{info?.titulo}</Text>
          <Text style={styles.modalDesc}>{info?.descripcion}</Text>
          <TouchableOpacity style={styles.modalBtn} onPress={onClose}>
            <Text style={styles.modalBtnText}>entendido</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Pantalla principal ─────────────────────────────────────────────────────
export default function Monitor() {
  const { width } = useWindowDimensions();
  const cellSize = (width - 32) / 32; // 32px de padding total, 32 celdas
  const [modoIR, setModoIR] = useState(false);
  const [camaraExpandida, setCamaraExpandida] = useState(false);
  const [termicoExpandido, setTermicoExpandido] = useState(false);
  const [modalInfo, setModalInfo] = useState(null);

  // ── Estado Firebase ──────────────────────────────────────────────────
  const [grid, setGrid] = useState(Array(64).fill('#b3d4ff'));
  const [tempBebe, setTempBebe] = useState(null);
  const [bebeDetectado, setBebeDetectado] = useState(false);
  const [tendencia, setTendencia] = useState('estable');
  const [ultimaLectura, setUltimaLectura] = useState('--');
  const [temperatura, setTemperatura] = useState(null);
  const [humedad, setHumedad] = useState(null);
  const [prevTemp, setPrevTemp] = useState(null);
  const [termicoConectado, setTermicoConectado] = useState(false);
  const [ambienteConectado, setAmbienteConectado] = useState(false);
  const [historialTemp, setHistorialTemp] = useState([]);

  useEffect(() => {
    // ── Escuchar sensor térmico ──────────────────────────────────────
    const termicoRef = ref(db, '/termico');
    const unsubTermico = onValue(termicoRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setTermicoConectado(false);
        return;
      }
      setTermicoConectado(true);

      if (data.grid) {
        const colores = interpolar32(data.grid);
        setGrid(colores);
        setTempBebe(data.promCaliente ? data.promCaliente.toFixed(1) : null);
      }

      setBebeDetectado(data.bebeDetectado || false);

      if (data.max && data.bebeDetectado) {
  setHistorialTemp(prev => {
    const nuevo = [...prev, data.max].slice(-20);
    if (nuevo.length >= 20) {
      const mitad = Math.floor(nuevo.length / 2);
      const promReciente = nuevo.slice(mitad).reduce((a,b) => a+b,0) / mitad;
      const promAnterior = nuevo.slice(0, mitad).reduce((a,b) => a+b,0) / mitad;
      const diff = promReciente - promAnterior;
      if (diff > 1.5) setTendencia('subiendo');
      else if (diff < -1.5) setTendencia('bajando');
      else setTendencia('estable');
    }
    return nuevo;
  });
} else if (!data.bebeDetectado) {
  setHistorialTemp([]);
  setTendencia('estable');
}
      setUltimaLectura('hace unos segundos');
    });

    // ── Escuchar ambiente ────────────────────────────────────────────
    const ambienteRef = ref(db, '/ambiente');
    const unsubAmbiente = onValue(ambienteRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setAmbienteConectado(false);
        return;
      }
      setAmbienteConectado(true);
      setTemperatura(data.temperatura);
      setHumedad(data.humedad);
    });

    return () => {
      unsubTermico();
      unsubAmbiente();
    };
  }, []);

  // ── Configs de estado ────────────────────────────────────────────────
  const tendenciaConfig = {
    subiendo: { emoji: '↑', color: '#d04000', texto: 'subiendo' },
    bajando:  { emoji: '↓', color: '#3a5a8a', texto: 'bajando'  },
    estable:  { emoji: '',  color: Colors.successDark, texto: 'estable' },
  }[tendencia];

  const ambienteConfig = !ambienteConectado
    ? { color: Colors.textSecondary, bg: Colors.bgSurface, emoji: '📡', texto: 'Sin conexión' }
    : temperatura < 18
    ? { color: '#3a5a8a', bg: '#e8f0fa', emoji: '❄️', texto: 'Cuarto frío' }
    : temperatura > 22
    ? { color: '#d04000', bg: '#fdecea', emoji: '🌡️', texto: 'Cuarto caliente' }
    : { color: Colors.successDark, bg: '#e8f4ee', emoji: '😌', texto: 'Temperatura ideal' };

  const humedadConfig = !ambienteConectado
    ? { color: Colors.textSecondary, bg: Colors.bgSurface, emoji: '📡', texto: 'Sin conexión' }
    : humedad < 40
    ? { color: '#d04000', bg: '#fdecea', emoji: '💨', texto: 'Muy seco' }
    : humedad > 60
    ? { color: '#3a5a8a', bg: '#e8f0fa', emoji: '💧', texto: 'Muy húmedo' }
    : { color: Colors.successDark, bg: '#e8f4ee', emoji: '✓', texto: 'Humedad ideal' };

  // ── Cámara expandida ─────────────────────────────────────────────────
  if (camaraExpandida) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: modoIR ? '#070f07' : '#1a1410' }]} edges={['top']}>
        <View style={styles.expandedContainer}>
          <View style={styles.expandedHeader}>
            <Text style={styles.expandedTitle}>{modoIR ? 'noche IR' : 'día'}</Text>
            <TouchableOpacity style={styles.cerrarBtn} onPress={() => setCamaraExpandida(false)}>
              <Text style={styles.cerrarText}>cerrar</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.camaraExpandida}>
            <View style={[styles.camaraIcono, modoIR && styles.camaraIconoIR]}>
              <View style={[styles.lente, modoIR && styles.lenteIR]} />
            </View>
            <Text style={[styles.camaraLabel, modoIR && styles.camaraLabelIR]}>
              {modoIR ? 'ESP32-CAM · IR activo' : 'ESP32-CAM · modo día'}
            </Text>
            <Text style={[styles.camaraSubLabel, modoIR && styles.camaraSubLabelIR]}>
              conectando stream...
            </Text>
          </View>
          <View style={styles.botonesGrandes}>
            <TouchableOpacity
              style={[styles.btnGrande, !modoIR && styles.btnGrandeActivoDia]}
              onPress={() => setModoIR(false)}
            >
              <Text style={styles.btnGrandeEmoji}>☀️</Text>
              <Text style={[styles.btnGrandeLabel, !modoIR && styles.btnGrandeLabelActivo]}>Día</Text>
              <Text style={[styles.btnGrandeSub, !modoIR && styles.btnGrandeSubActivo]}>cámara normal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnGrande, modoIR && styles.btnGrandeActivoIR]}
              onPress={() => setModoIR(true)}
            >
              <Text style={styles.btnGrandeEmoji}>🌙</Text>
              <Text style={[styles.btnGrandeLabel, modoIR && styles.btnGrandeLabelActivoIR]}>Noche IR</Text>
              <Text style={[styles.btnGrandeSub, modoIR && styles.btnGrandeSubActivoIR]}>visión en oscuridad</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Térmico expandido ────────────────────────────────────────────────
  if (termicoExpandido) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#1a1410' }]} edges={['top']}>
        <View style={styles.expandedContainer}>
          <View style={styles.expandedHeader}>
            <Text style={styles.expandedTitle}>sensor térmico</Text>
            <TouchableOpacity style={styles.cerrarBtn} onPress={() => setTermicoExpandido(false)}>
              <Text style={styles.cerrarText}>cerrar</Text>
            </TouchableOpacity>
          </View>

          {!termicoConectado ? (
            <SinConexion />
          ) : (
            <>
              <View style={{ width: '100%' }}>
               <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {grid.map((color, i) => (
                 <View
                   key={i}
                   style={{
                      width: cellSize,
                       height: cellSize,
                       backgroundColor: color,
                   }}
                 />
                ))}
               </View>
             </View>

              <View style={styles.scaleBar}>
                {['#b3d4ff','#99c8ff','#ffddaa','#ffaa66','#ff8833','#ff5500','#ff3300'].map((c, i) => (
                  <View key={i} style={[styles.scaleCell, { backgroundColor: c }]} />
                ))}
              </View>
              <View style={styles.scaleLabels}>
                <Text style={[styles.scaleLabel, { color: '#88aadd' }]}>frío</Text>
                <Text style={[styles.scaleLabel, { color: '#ff8855' }]}>caliente</Text>
              </View>

              <View style={styles.expandedStats}>
                <View style={styles.expandedStat}>
                  <Text style={styles.expandedStatLabel}>bebé</Text>
                  <Text style={[styles.expandedStatVal, { color: bebeDetectado ? '#b5d8a8' : '#f4c2c2' }]}>
                    {bebeDetectado ? 'detectado' : 'no detectado'}
                  </Text>
                </View>
                <View style={styles.expandedStat}>
                  <Text style={styles.expandedStatLabel}>zona caliente</Text>
                  <Text style={[styles.expandedStatVal, { color: tendenciaConfig.color }]}>
                    ~{tempBebe}°C {tendenciaConfig.emoji}
                  </Text>
                </View>
                <View style={styles.expandedStat}>
                  <Text style={styles.expandedStatLabel}>tendencia</Text>
                  <Text style={[styles.expandedStatVal, { color: tendenciaConfig.color }]}>
                    {tendenciaConfig.texto}
                  </Text>
                </View>
              </View>

              <View style={styles.expandedDisclaimer}>
                <Text style={styles.expandedDisclaimerText}>
                  ±2.5°C de margen · las alertas se basan en cambios, no en valores absolutos · no sustituye evaluación médica
                </Text>
              </View>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── Vista normal ─────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      <InfoModal
        visible={modalInfo !== null}
        info={modalInfo}
        onClose={() => setModalInfo(null)}
      />

      {/* Cámara */}
      <TouchableOpacity
        style={[styles.camaraBox, modoIR && styles.camaraBoxIR]}
        onPress={() => setCamaraExpandida(true)}
        activeOpacity={0.9}
      >
        <View style={styles.bebeDetectado}>
          <View style={styles.bebeDetectadoDot} />
          <Text style={styles.bebeDetectadoText}>bebé detectado</Text>
        </View>
        <View style={styles.camaraPlaceholder}>
          <View style={[styles.camaraIcono, modoIR && styles.camaraIconoIR]}>
            <View style={[styles.lente, modoIR && styles.lenteIR]} />
          </View>
          <Text style={[styles.camaraLabel, modoIR && styles.camaraLabelIR]}>
            {modoIR ? 'ESP32-CAM · IR activo' : 'ESP32-CAM · modo día'}
          </Text>
          <Text style={[styles.camaraSubLabel, modoIR && styles.camaraSubLabelIR]}>
            toca para expandir
          </Text>
        </View>
        <View style={styles.liveBadge}>
          <View style={[styles.liveDot, modoIR && styles.liveDotIR]} />
          <Text style={[styles.liveText, modoIR && styles.liveTextIR]}>en vivo</Text>
        </View>
      </TouchableOpacity>

      {/* Botones modo cámara */}
      <View style={styles.botonesRow}>
        <TouchableOpacity
          style={[styles.btnModo, !modoIR && styles.btnModoActivoDia]}
          onPress={() => setModoIR(false)}
          activeOpacity={0.8}
        >
          <Text style={styles.btnModoEmoji}>☀️</Text>
          <View>
            <Text style={[styles.btnModoLabel, !modoIR && styles.btnModoLabelActivo]}>Día</Text>
            <Text style={[styles.btnModoSub, !modoIR && styles.btnModoSubActivo]}>cámara normal</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnModo, modoIR && styles.btnModoActivoIR]}
          onPress={() => setModoIR(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.btnModoEmoji}>🌙</Text>
          <View>
            <Text style={[styles.btnModoLabel, modoIR && styles.btnModoLabelActivoIR]}>Noche IR</Text>
            <Text style={[styles.btnModoSub, modoIR && styles.btnModoSubActivoIR]}>visión en oscuridad</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* Sensor térmico */}
        <View style={styles.seccionHeader}>
          <Text style={styles.seccionTitulo}>sensor térmico</Text>
          <TouchableOpacity onPress={() => setModalInfo(INFO_TERMICO)}>
            <View style={styles.infoBadge}>
              <Text style={styles.infoIcon}>ⓘ</Text>
              <Text style={styles.infoText}>¿qué es esto?</Text>
            </View>
          </TouchableOpacity>
        </View>

        {!termicoConectado ? (
          <View style={styles.sinConexionCard}>
            <SinConexion />
          </View>
        ) : (
          <TouchableOpacity
            style={styles.termicoCard}
            onPress={() => setTermicoExpandido(true)}
            activeOpacity={0.85}
          >
            <View style={styles.termicoBody}>
              <View style={styles.gridMini}>
                {grid.map((color, i) => (
                  <View key={i} style={[styles.cellMini, { backgroundColor: color }]} />
                ))}
              </View>
              <View style={styles.termicoInfo}>
                <View style={[styles.bebeChip, { backgroundColor: bebeDetectado ? '#e8f4ee' : '#fdecea' }]}>
                  <View style={[styles.bebeChipDot, { backgroundColor: bebeDetectado ? Colors.successDark : Colors.dangerDark }]} />
                  <Text style={[styles.bebeChipText, { color: bebeDetectado ? Colors.successDark : Colors.dangerDark }]}>
                    {bebeDetectado ? 'bebé en cuna' : 'bebé no detectado'}
                  </Text>
                </View>
                <View style={styles.tempBebeFila}>
                  <Text style={styles.tempBebeLabel}>zona caliente</Text>
                  <Text style={[styles.tempBebeVal, { color: tendenciaConfig.color }]}>
                    ~{tempBebe}°C {tendenciaConfig.emoji}
                  </Text>
                </View>
                <View style={styles.tempBebeFila}>
                  <Text style={styles.tempBebeLabel}>tendencia</Text>
                  <Text style={[styles.tempBebeTendencia, { color: tendenciaConfig.color }]}>
                    {tendenciaConfig.texto}
                  </Text>
                </View>
                <Text style={styles.ultimaLecturaText}>{ultimaLectura}</Text>
              </View>
            </View>
            <Text style={styles.expandirText}>toca para ver el mapa completo →</Text>
          </TouchableOpacity>
        )}

        {/* Ambiente del cuarto */}
        <View style={styles.seccionHeader}>
          <Text style={styles.seccionTitulo}>ambiente del cuarto</Text>
          <TouchableOpacity onPress={() => setModalInfo(INFO_AMBIENTE)}>
            <View style={styles.infoBadge}>
              <Text style={styles.infoIcon}>ⓘ</Text>
              <Text style={styles.infoText}>¿por qué importa?</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Temperatura ambiente */}
        <View style={styles.ambienteCard}>
          <View style={styles.ambienteCardTop}>
            <Text style={styles.ambienteCardTitulo}>🌡️ temperatura</Text>
            <View style={[styles.ambienteIndicador, { backgroundColor: ambienteConfig.bg }]}>
              <View style={[styles.ambienteIndicadorDot, { backgroundColor: ambienteConfig.color }]} />
              <Text style={[styles.ambienteIndicadorText, { color: ambienteConfig.color }]}>
                {ambienteConfig.texto}
              </Text>
            </View>
          </View>
          <View style={styles.ambienteCardMid}>
            <Text style={[styles.ambienteValGrande, { color: ambienteConfig.color }]}>
              {ambienteConectado ? `${temperatura}°C` : '--'}
            </Text>
          </View>
          {ambienteConectado && (
            <>
              <View style={styles.barraWrap}>
                <View style={styles.barra}>
                  <View style={[styles.barraZona, { flex: 18, backgroundColor: '#c4d9f0' }]} />
                  <View style={[styles.barraZona, { flex: 4,  backgroundColor: '#b5d8c8' }]} />
                  <View style={[styles.barraZona, { flex: 28, backgroundColor: '#f4c2c2' }]} />
                </View>
                <View style={[styles.barraMarcador, {
                  left: `${Math.min(Math.max((temperatura - 0) / 50 * 100, 2), 98)}%`
                }]} />
              </View>
              <View style={styles.barraLabels}>
                <Text style={styles.barraLabel}>0°C</Text>
                <Text style={[styles.barraLabelIdeal, { color: Colors.successDark }]}>ideal 18°–22°C</Text>
                <Text style={styles.barraLabel}>50°C</Text>
              </View>
            </>
          )}
          <Text style={styles.ambienteHora}>
            {ambienteConectado ? 'última lectura hace unos segundos' : 'ESP32 sin conexión'}
          </Text>
        </View>

        {/* Humedad */}
        <View style={styles.ambienteCard}>
          <View style={styles.ambienteCardTop}>
            <Text style={styles.ambienteCardTitulo}>💧 humedad</Text>
            <View style={[styles.ambienteIndicador, { backgroundColor: humedadConfig.bg }]}>
              <View style={[styles.ambienteIndicadorDot, { backgroundColor: humedadConfig.color }]} />
              <Text style={[styles.ambienteIndicadorText, { color: humedadConfig.color }]}>
                {humedadConfig.texto}
              </Text>
            </View>
          </View>
          <View style={styles.ambienteCardMid}>
            <Text style={[styles.ambienteValGrande, { color: humedadConfig.color }]}>
              {ambienteConectado ? `${humedad}%` : '--'}
            </Text>
          </View>
          {ambienteConectado && (
            <>
              <View style={styles.barraWrap}>
                <View style={styles.barra}>
                  <View style={[styles.barraZona, { flex: 40, backgroundColor: '#f4c2c2' }]} />
                  <View style={[styles.barraZona, { flex: 20, backgroundColor: '#b5d8c8' }]} />
                  <View style={[styles.barraZona, { flex: 40, backgroundColor: '#c4d9f0' }]} />
                </View>
                <View style={[styles.barraMarcador, {
                  left: `${Math.min(Math.max(humedad, 2), 98)}%`
                }]} />
              </View>
              <View style={styles.barraLabels}>
                <Text style={styles.barraLabel}>0%</Text>
                <Text style={[styles.barraLabelIdeal, { color: Colors.successDark }]}>ideal 40%–60%</Text>
                <Text style={styles.barraLabel}>100%</Text>
              </View>
            </>
          )}
          <Text style={styles.ambienteHora}>
            {ambienteConectado ? 'última lectura hace unos segundos' : 'ESP32 sin conexión'}
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:                    { flex: 1, backgroundColor: Colors.bg },

  // Sin conexión
  sinConexionCard:         { backgroundColor: Colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: Colors.brownPale, padding: 24 },
  sinConexionWrap:         { alignItems: 'center', gap: 8, paddingVertical: 16 },
  sinConexionEmoji:        { fontSize: 36 },
  sinConexionTitulo:       { fontSize: 16, fontWeight: '500', color: Colors.brown },
  sinConexionSub:          { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Cámara
  camaraBox:               { height: 220, backgroundColor: '#1a1410', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  camaraBoxIR:             { backgroundColor: '#070f07' },
  camaraPlaceholder:       { alignItems: 'center', gap: 8 },
  camaraIcono:             { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  camaraIconoIR:           { backgroundColor: 'rgba(68,255,68,0.07)' },
  lente:                   { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' },
  lenteIR:                 { borderColor: 'rgba(68,255,68,0.35)' },
  camaraLabel:             { fontSize: 15, color: 'rgba(255,255,255,0.45)', fontWeight: '500' },
  camaraLabelIR:           { color: 'rgba(68,255,68,0.55)' },
  camaraSubLabel:          { fontSize: 13, color: 'rgba(255,255,255,0.25)' },
  camaraSubLabelIR:        { color: 'rgba(68,255,68,0.3)' },
  bebeDetectado:           { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(181,216,168,0.18)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99 },
  bebeDetectadoDot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: '#b5d8a8' },
  bebeDetectadoText:       { fontSize: 13, color: '#b5d8a8', fontWeight: '500' },
  liveBadge:               { position: 'absolute', bottom: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  liveDot:                 { width: 5, height: 5, borderRadius: 3, backgroundColor: '#b5d8a8' },
  liveDotIR:               { backgroundColor: '#44dd44' },
  liveText:                { fontSize: 12, color: '#b5d8a8' },
  liveTextIR:              { color: '#44dd44' },

  // Botones modo
  botonesRow:              { flexDirection: 'row', gap: 10, padding: 12, paddingBottom: 6 },
  btnModo:                 { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.bgCard, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.brownPale, padding: 12 },
  btnModoActivoDia:        { borderColor: Colors.brownLight, backgroundColor: Colors.bgSurface },
  btnModoActivoIR:         { borderColor: '#44aa44', backgroundColor: '#0d200d' },
  btnModoEmoji:            { fontSize: 24 },
  btnModoLabel:            { fontSize: 15, fontWeight: '500', color: Colors.textSecondary },
  btnModoLabelActivo:      { color: Colors.brown },
  btnModoLabelActivoIR:    { color: '#88dd88' },
  btnModoSub:              { fontSize: 12, color: Colors.textTertiary, marginTop: 1 },
  btnModoSubActivo:        { color: Colors.textSecondary },
  btnModoSubActivoIR:      { color: '#44aa44' },

  // Scroll
  scroll:                  { flex: 1 },
  scrollContent:           { padding: 12, gap: 10, paddingBottom: 90 },

  // Sección header
  seccionHeader:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  seccionTitulo:           { fontSize: 15, fontWeight: '500', color: Colors.brown },
  infoBadge:               { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.bgSurface, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  infoIcon:                { fontSize: 13, color: Colors.brownLight },
  infoText:                { fontSize: 12, color: Colors.brownMid },

  // Térmico card
  termicoCard:             { backgroundColor: Colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: Colors.brownPale, padding: 14, marginBottom: 4 },
  termicoBody:             { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 10 },
  gridMini:   { flexDirection: 'row', flexWrap: 'wrap', gap: 0, width: 136 },
  cellMini:   { width: 4.25, height: 4.25, borderRadius: 0 },
  termicoInfo:             { flex: 1, gap: 8 },
  bebeChip:                { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, alignSelf: 'flex-start' },
  bebeChipDot:             { width: 6, height: 6, borderRadius: 3 },
  bebeChipText:            { fontSize: 12, fontWeight: '500' },
  tempBebeFila:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tempBebeLabel:           { fontSize: 13, color: Colors.textSecondary },
  tempBebeVal:             { fontSize: 18, fontWeight: '500' },
  tempBebeTendencia:       { fontSize: 15, fontWeight: '500' },
  ultimaLecturaText:       { fontSize: 11, color: Colors.textTertiary },
  expandirText:            { fontSize: 12, color: Colors.brownLight, textAlign: 'right' },

  // Ambiente card
  ambienteCard:            { backgroundColor: Colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: Colors.brownPale, padding: 16, gap: 12 },
  ambienteCardTop:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ambienteCardTitulo:      { fontSize: 15, fontWeight: '500', color: Colors.brown },
  ambienteIndicador:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  ambienteIndicadorDot:    { width: 6, height: 6, borderRadius: 3 },
  ambienteIndicadorText:   { fontSize: 12, fontWeight: '500' },
  ambienteCardMid:         { alignItems: 'center' },
  ambienteValGrande:       { fontSize: 42, fontWeight: '500' },
  ambienteHora:            { fontSize: 11, color: Colors.textTertiary, textAlign: 'center' },
  barraWrap:               { position: 'relative' },
  barra:                   { flexDirection: 'row', height: 8, borderRadius: 99, overflow: 'hidden' },
  barraZona:               { height: 8 },
  barraMarcador:           { position: 'absolute', top: -3, width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.brown, borderWidth: 2, borderColor: Colors.bgCard, marginLeft: -7 },
  barraLabels:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barraLabel:              { fontSize: 11, color: Colors.textTertiary },
  barraLabelIdeal:         { fontSize: 11, fontWeight: '500' },

  // Modal
  modalOverlay:            { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard:               { backgroundColor: Colors.bgCard, borderRadius: 20, padding: 24, gap: 14, width: '100%' },
  modalTitulo:             { fontSize: 17, fontWeight: '500', color: Colors.brown },
  modalDesc:               { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  modalBtn:                { backgroundColor: Colors.yellow, borderRadius: 12, padding: 14, alignItems: 'center' },
  modalBtnText:            { fontSize: 15, fontWeight: '500', color: Colors.brown },

  // Expandido
  expandedHeader:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  expandedTitle:           { fontSize: 22, fontWeight: '500', color: '#e8c99a' },
  cerrarBtn:               { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99 },
  cerrarText:              { fontSize: 14, color: 'rgba(255,255,255,0.6)' },
  camaraExpandida:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  expandedContainer: { flex: 1, padding: 16, paddingBottom: 20 },
  expandedGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 0, width: '100%' },
  cellGrande:        { width: '3.125%', aspectRatio: 1, borderRadius: 0 },
  scaleBar:                { flexDirection: 'row', height: 6, borderRadius: 4, overflow: 'hidden' },
  scaleCell:               { flex: 1 },
  scaleLabels:             { flexDirection: 'row', justifyContent: 'space-between' },
  scaleLabel:              { fontSize: 13 },
  expandedStats:           { flexDirection: 'row', justifyContent: 'space-around' },
  expandedStat:            { alignItems: 'center', gap: 6 },
  expandedStatLabel:       { fontSize: 13, color: 'rgba(255,255,255,0.45)' },
  expandedStatVal:         { fontSize: 20, fontWeight: '500' },
  expandedDisclaimer:      { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 12 },
  expandedDisclaimerText:  { fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center', lineHeight: 18 },

  // Botones grandes
  botonesGrandes:          { flexDirection: 'row', gap: 12 },
  btnGrande:               { flex: 1, alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', padding: 16 },
  btnGrandeActivoDia:      { borderColor: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.12)' },
  btnGrandeActivoIR:       { borderColor: 'rgba(68,255,68,0.4)', backgroundColor: 'rgba(68,255,68,0.08)' },
  btnGrandeEmoji:          { fontSize: 32 },
  btnGrandeLabel:          { fontSize: 16, fontWeight: '500', color: 'rgba(255,255,255,0.4)' },
  btnGrandeLabelActivo:    { color: 'rgba(255,255,255,0.9)' },
  btnGrandeLabelActivoIR:  { color: 'rgba(68,255,68,0.9)' },
  btnGrandeSub:            { fontSize: 13, color: 'rgba(255,255,255,0.25)' },
  btnGrandeSubActivo:      { color: 'rgba(255,255,255,0.5)' },
  btnGrandeSubActivoIR:    { color: 'rgba(68,255,68,0.5)' },
});