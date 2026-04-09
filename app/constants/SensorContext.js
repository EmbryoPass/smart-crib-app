// app/constants/SensorContext.js — Capullo App
// Contexto global que escucha Firebase UNA sola vez y comparte los datos
// con Monitor, Historial y cualquier otra pantalla que los necesite.
//
// Uso:
//   1. Envuelve tu app en <SensorProvider> dentro de App.js
//   2. En cualquier pantalla: const { tempBebe, historial, ... } = useSensor()

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { db, ref, onValue } from './firebase';

const SensorContext = createContext(null);

// ─── Cuántos registros guardar en el historial en memoria ─────────────────
const MAX_HISTORIAL = 288; // 24h a 1 lectura cada 5 min

export function SensorProvider({ children }) {

  // ── Estado térmico (igual que en Monitor) ────────────────────────────
  const [tempBebe, setTempBebe]           = useState(null);
  const [bebeDetectado, setBebeDetectado] = useState(false);
  const [tendencia, setTendencia]         = useState('estable');
  const [termicoConectado, setTermicoConectado] = useState(false);

  // ── Estado ambiente ──────────────────────────────────────────────────
  const [temperatura, setTemperatura]     = useState(null);
  const [humedad, setHumedad]             = useState(null);
  const [ambienteConectado, setAmbienteConectado] = useState(false);

  // ── Historial acumulado en memoria ───────────────────────────────────
  // Cada entrada: { ts: Date, tempBebe, temperatura, humedad, bebeDetectado }
  const [historial, setHistorial] = useState([]);

  // Para calcular tendencia (igual que en Monitor)
  const historialTempRef = useRef([]);

  useEffect(() => {
    // ── Escuchar /termico ────────────────────────────────────────────
    const termicoRef = ref(db, '/termico');
    const unsubTermico = onValue(termicoRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) { setTermicoConectado(false); return; }
      setTermicoConectado(true);

      const nuevaTempBebe = data.promCaliente ? parseFloat(data.promCaliente.toFixed(1)) : null;
      const nuevoBebe     = data.bebeDetectado || false;

      setTempBebe(nuevaTempBebe);
      setBebeDetectado(nuevoBebe);

      // Calcular tendencia (misma lógica que Monitor)
      if (data.max && nuevoBebe) {
        historialTempRef.current = [...historialTempRef.current, data.max].slice(-20);
        const arr = historialTempRef.current;
        if (arr.length >= 20) {
          const mitad      = Math.floor(arr.length / 2);
          const promRec    = arr.slice(mitad).reduce((a, b) => a + b, 0) / mitad;
          const promAnt    = arr.slice(0, mitad).reduce((a, b) => a + b, 0) / mitad;
          const diff       = promRec - promAnt;
          setTendencia(diff > 1.5 ? 'subiendo' : diff < -1.5 ? 'bajando' : 'estable');
        }
      } else if (!nuevoBebe) {
        historialTempRef.current = [];
        setTendencia('estable');
      }

      // Guardar en historial acumulado
      setHistorial(prev => {
        const entrada = {
          ts:           new Date(),
          tempBebe:     nuevaTempBebe,
          bebeDetectado: nuevoBebe,
          temperatura:  null, // se llenará con el último valor de ambiente
          humedad:      null,
        };
        return [...prev, entrada].slice(-MAX_HISTORIAL);
      });
    });

    // ── Escuchar /ambiente ───────────────────────────────────────────
    const ambienteRef = ref(db, '/ambiente');
    const unsubAmbiente = onValue(ambienteRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) { setAmbienteConectado(false); return; }
      setAmbienteConectado(true);
      setTemperatura(data.temperatura);
      setHumedad(data.humedad);

      // Actualizar última entrada del historial con datos de ambiente
      setHistorial(prev => {
        if (prev.length === 0) return prev;
        const ultima = { ...prev[prev.length - 1], temperatura: data.temperatura, humedad: data.humedad };
        return [...prev.slice(0, -1), ultima];
      });
    });

    return () => { unsubTermico(); unsubAmbiente(); };
  }, []);

  // ── Estadísticas calculadas para Historial ───────────────────────────

  // Filtra entradas por rango de horas hacia atrás
  const entriasPorRango = (horas) => {
    const desde = new Date(Date.now() - horas * 60 * 60 * 1000);
    return historial.filter(e => e.ts >= desde);
  };

  // Calcula stats de un array de entradas
  const calcStats = (entradas) => {
    if (entradas.length === 0) return null;

    const conBebe     = entradas.filter(e => e.bebeDetectado);
    const sinBebe     = entradas.filter(e => !e.bebeDetectado);
    const tempsValidas = entradas.map(e => e.tempBebe).filter(Boolean);
    const ambiValidas  = entradas.map(e => e.temperatura).filter(Boolean);
    const humValidas   = entradas.map(e => e.humedad).filter(Boolean);

    // Tiempo dormido = entradas con bebé detectado × intervalo aprox (5 seg polling)
    const minsDormido = conBebe.length * (5 / 60);
    const h = Math.floor(minsDormido / 60);
    const m = Math.round(minsDormido % 60);
    const sueno = h > 0 ? `${h}h ${m}m` : `${m}m`;

    const tempProm = tempsValidas.length
      ? (tempsValidas.reduce((a, b) => a + b, 0) / tempsValidas.length).toFixed(1)
      : null;
    const tempMax = tempsValidas.length ? Math.max(...tempsValidas).toFixed(1) : null;
    const tempMaxAlta = tempMax ? parseFloat(tempMax) > 37.2 : false;

    const ambProm = ambiValidas.length
      ? (ambiValidas.reduce((a, b) => a + b, 0) / ambiValidas.length).toFixed(1)
      : null;
    const humProm = humValidas.length
      ? (humValidas.reduce((a, b) => a + b, 0) / humValidas.length).toFixed(1)
      : null;

    // Puntos para la gráfica de temperatura (máx 9 puntos distribuidos)
    const paso   = Math.max(1, Math.floor(entradas.length / 9));
    const puntos = entradas
      .filter((_, i) => i % paso === 0)
      .slice(0, 9)
      .map((e, i) => ({ h: i, t: e.tempBebe ?? parseFloat(tempProm ?? '36.5') }));

    return { sueno, tempProm: tempProm ? `${tempProm}°` : '--', tempMax: tempMax ? `${tempMax}°` : '--', tempMaxAlta, ambProm, humProm, puntos };
  };

  const statsHoy    = calcStats(entriasPorRango(24));
  const statsSemana = calcStats(entriasPorRango(24 * 7));
  const statsMes    = calcStats(entriasPorRango(24 * 30));

  // ── Valor del contexto ────────────────────────────────────────────────
  const value = {
    // Datos en tiempo real (para Monitor)
    tempBebe,
    bebeDetectado,
    tendencia,
    termicoConectado,
    temperatura,
    humedad,
    ambienteConectado,

    // Historial crudo y stats calculadas (para Historial)
    historial,
    statsHoy,
    statsSemana,
    statsMes,
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
