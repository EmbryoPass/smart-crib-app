import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { db, ref, onValue, push } from './firebase';

const SensorContext = createContext(null);
const MAX_HISTORIAL = 288;

// ─── Utilidades de fecha ────────────────────────────────────────────────────
const isoHoy = () => new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

const fmtHora = (ts = Date.now()) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};

const msDuracion = (ms) => {
  const m = Math.round(ms / 60000);
  if (m < 1)  return 'duración: menos de 1 min';
  if (m < 60) return `duración: ${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r > 0 ? `duración: ${h}h ${r}m` : `duración: ${h}h`;
};

// ─── Escritura a Firebase ───────────────────────────────────────────────────
//
//  /eventos/{YYYY-MM-DD}/{pushId}  ← timeline del DiarioTab
//    tipo, detalle, ts
//
//  /alertas/{pushId}               ← AlertasTab (llanto y temp. elevada)
//    tipo, detalle, cat, ts
//
// escribirEvento también está exportada vía registrarEvento() en el contexto.
// Cuando el circuito de altura esté listo, la tab Cuna puede llamar:
//   registrarEvento({ tipo: 'altura ajustada', detalle: 'Mamá → 65 cm' })

const escribirEvento = ({ tipo, detalle, ts = Date.now() }) => {
  // Siempre va al diario del día
  push(ref(db, `eventos/${isoHoy()}`), { tipo, detalle, ts });

  // Solo llanto y temp. elevada generan una alerta
  const catMap = { 'llanto': 'llanto', 'temp. elevada': 'temperatura' };
  const cat = catMap[tipo];
  if (cat) {
    const tipoAlerta = tipo === 'llanto' ? 'llanto detectado' : 'temperatura elevada';
    push(ref(db, 'alertas'), { tipo: tipoAlerta, detalle, cat, ts });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
export function SensorProvider({ children }) {

  // ── Estado térmico ─────────────────────────────────────────────────────
  const [tempBebe, setTempBebe]                 = useState(null);
  const [bebeDetectado, setBebeDetectado]       = useState(false);
  const [tendencia, setTendencia]               = useState('estable');
  const [termicoConectado, setTermicoConectado] = useState(false);

  // ── Estado ambiente ────────────────────────────────────────────────────
  const [temperatura, setTemperatura]           = useState(null);
  const [humedad, setHumedad]                   = useState(null);
  const [ambienteConectado, setAmbienteConectado] = useState(false);

  // ── Estado llanto ──────────────────────────────────────────────────────
  const [llantoActivo, setLlantoActivo]         = useState(false);
  const [ultimoLlanto, setUltimoLlanto]         = useState(null);
  const [llantoHoy, setLlantoHoy]               = useState(0);
  const llantoInicioRef                          = useRef(null);
  const llantoActivoRef                          = useRef(false);

  // ── Historial ──────────────────────────────────────────────────────────
  const [historial, setHistorial]               = useState([]);
  const historialTempRef                         = useRef([]);

  // ── Refs para detección de eventos (evita spam a Firebase) ────────────
  const tempAltaRef       = useRef(false); // si ya disparamos alerta de temp

  useEffect(() => {

    // ── /termico ─────────────────────────────────────────────────────────
    const unsubTermico = onValue(ref(db, '/termico'), (snapshot) => {
      const data = snapshot.val();
      if (!data) { setTermicoConectado(false); return; }
      setTermicoConectado(true);

      const nuevaTempBebe = data.promCaliente ? parseFloat(data.promCaliente.toFixed(1)) : null;
      const nuevoBebe     = data.bebeDetectado || false;

      setTempBebe(nuevaTempBebe);
      setBebeDetectado(nuevoBebe);

      // ── Tendencia (sin cambios) ───────────────────────────────────────
      if (data.max && nuevoBebe) {
        historialTempRef.current = [...historialTempRef.current, data.max].slice(-20);
        const arr = historialTempRef.current;
        if (arr.length >= 20) {
          const mitad   = Math.floor(arr.length / 2);
          const promRec = arr.slice(mitad).reduce((a, b) => a + b, 0) / mitad;
          const promAnt = arr.slice(0, mitad).reduce((a, b) => a + b, 0) / mitad;
          const diff    = promRec - promAnt;
          setTendencia(diff > 1.5 ? 'subiendo' : diff < -1.5 ? 'bajando' : 'estable');
        }
      } else if (!nuevoBebe) {
        historialTempRef.current = [];
        setTendencia('estable');
      }

      // ── Evento: TEMPERATURA ELEVADA ──────────────────────────────────
      // Dispara UNA SOLA VEZ por episodio (reset cuando baja del umbral)
      if (nuevaTempBebe !== null) {
        if (nuevaTempBebe > 37.2 && !tempAltaRef.current) {
          tempAltaRef.current = true;
          escribirEvento({
            tipo:    'temp. elevada',
            detalle: `${fmtHora()} · ${nuevaTempBebe}°C`,
          });
        } else if (nuevaTempBebe <= 37.2 && tempAltaRef.current) {
          tempAltaRef.current = false; // listo para el próximo episodio
        }
      }

      // ── Historial en memoria ─────────────────────────────────────────
      const tsAhora = Date.now();
      setHistorial(prev => {
        const entrada = {
          ts: tsAhora,
          tempBebe:      nuevaTempBebe,
          bebeDetectado: nuevoBebe,
          temperatura:   null,
          humedad:       null,
        };
        return [...prev, entrada].slice(-MAX_HISTORIAL);
      });
    });

    // ── /ambiente ─────────────────────────────────────────────────────────
    const unsubAmbiente = onValue(ref(db, '/ambiente'), (snapshot) => {
      const data = snapshot.val();
      if (!data) { setAmbienteConectado(false); return; }
      setAmbienteConectado(true);
      setTemperatura(data.temperatura);
      setHumedad(data.humedad);

      setHistorial(prev => {
        if (prev.length === 0) return prev;
        const ultima = { ...prev[prev.length - 1], temperatura: data.temperatura, humedad: data.humedad };
        return [...prev.slice(0, -1), ultima];
      });
    });

    // ── /llanto ───────────────────────────────────────────────────────────
    const unsubLlanto = onValue(ref(db, '/llanto'), (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      const nuevoActivo    = data.activo || false;
      const anteriorActivo = llantoActivoRef.current;

      // Llanto EMPEZÓ
      if (nuevoActivo && !anteriorActivo) {
        llantoInicioRef.current = Date.now();
        setLlantoActivo(true);
        setLlantoHoy(prev => prev + 1);
      }

      // Llanto TERMINÓ
      if (!nuevoActivo && anteriorActivo && llantoInicioRef.current) {
        const durMs   = Date.now() - llantoInicioRef.current;
        const entrada = {
          hora:     fmtHora(),
          duracion: msDuracion(durMs),
        };
        setUltimoLlanto(entrada);

        // Escribe en /eventos/{fecha} + /alertas
        escribirEvento({
          tipo:    'llanto',
          detalle: `${entrada.hora} · ${entrada.duracion}`,
          ts:      llantoInicioRef.current,
        });

        llantoInicioRef.current = null;
        setLlantoActivo(false);
      }

      llantoActivoRef.current = nuevoActivo;
    });

    return () => { unsubTermico(); unsubAmbiente(); unsubLlanto(); };
  }, []);

  // ── Estadísticas ──────────────────────────────────────────────────────
  const entriasPorRango = (horas) => {
    const desde = Date.now() - horas * 3600 * 1000;
    return historial.filter(e => e.ts >= desde);
  };

  const calcStats = (entradas) => {
    if (entradas.length === 0) return null;

    const conBebe      = entradas.filter(e => e.bebeDetectado);
    const tempsValidas = entradas.map(e => e.tempBebe).filter(Boolean);
    const ambiValidas  = entradas.map(e => e.temperatura).filter(Boolean);
    const humValidas   = entradas.map(e => e.humedad).filter(Boolean);

    const minsDormido = conBebe.length * (5 / 60);
    const h = Math.floor(minsDormido / 60);
    const m = Math.round(minsDormido % 60);
    const sueno = h > 0 ? `${h}h ${m}m` : `${m}m`;

    const tempProm    = tempsValidas.length ? (tempsValidas.reduce((a, b) => a + b, 0) / tempsValidas.length).toFixed(1) : null;
    const tempMax     = tempsValidas.length ? Math.max(...tempsValidas).toFixed(1) : null;
    const tempMaxAlta = tempMax ? parseFloat(tempMax) > 37.2 : false;
    const ambProm     = ambiValidas.length ? (ambiValidas.reduce((a, b) => a + b, 0) / ambiValidas.length).toFixed(1) : null;
    const humProm     = humValidas.length  ? (humValidas.reduce((a, b)  => a + b, 0) / humValidas.length).toFixed(1)  : null;

    // puntos para gráfica — incluye ts para etiquetas de hora en el chart
    const paso   = Math.max(1, Math.floor(entradas.length / 9));
    const puntos = entradas
      .filter((_, i) => i % paso === 0)
      .slice(0, 9)
      .map((e, i) => ({
        h:  i,
        t:  e.tempBebe ?? parseFloat(tempProm ?? '36.5'),
        ts: e.ts, // ← timestamp real; el TempChart lo usa para mostrar horas
      }));

    return {
      sueno,
      tempProm:    tempProm ? `${tempProm}°` : '--',
      tempMax:     tempMax  ? `${tempMax}°`  : '--',
      tempMaxAlta,
      ambProm,
      humProm,
      puntos,
    };
  };

  const statsHoy    = calcStats(entriasPorRango(24));
  const statsSemana = calcStats(entriasPorRango(24 * 7));
  const statsMes    = calcStats(entriasPorRango(24 * 30));

  // ── registrarEvento — para uso externo cuando se implementen más features ─
  // Uso: registrarEvento({ tipo: 'altura ajustada', detalle: 'Mamá → 65 cm' })
  const registrarEvento = useCallback((params) => {
    escribirEvento(params);
  }, []);

  const value = {
    // Tiempo real
    tempBebe, bebeDetectado, tendencia, termicoConectado,
    temperatura, humedad, ambienteConectado,
    // Llanto
    llantoActivo, ultimoLlanto, llantoHoy,
    // Historial
    historial, statsHoy, statsSemana, statsMes,
    // Helper para otras tabs
    registrarEvento,
  };

  return (
    <SensorContext.Provider value={value}>
      {children}
    </SensorContext.Provider>
  );
}

export function useSensor() {
  const ctx = useContext(SensorContext);
  if (!ctx) throw new Error('useSensor debe usarse dentro de <SensorProvider>');
  return ctx;
}
