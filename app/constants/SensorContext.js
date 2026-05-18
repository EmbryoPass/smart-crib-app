import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { db, ref, onValue, push } from './firebase';

const SensorContext = createContext(null);
const MAX_HISTORIAL = 288;

// ─── Utilidades de fecha ────────────────────────────────────────────────────
const isoHoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

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
const escribirEvento = ({ tipo, detalle, ts = Date.now(), alertaLabel = null }) => {
  // Siempre al diario del día
  push(ref(db, `eventos/${isoHoy()}`), { tipo, detalle, ts });

  // Categoría para /alertas
  // normalizacion_temp y normalizacion_hum NO van a /alertas (son positivas)
  let cat = null;
  if (tipo === 'llanto')                               cat = 'llanto';
  else if (tipo === 'temp. elevada')                   cat = 'temperatura';
  else if (tipo === 'tendencia_alcista' || alertaLabel) cat = 'ambiente';
  if (!cat) return;

  const tipoAlerta = tipo === 'llanto'        ? 'llanto detectado'
                   : tipo === 'temp. elevada' ? 'temperatura elevada'
                   : alertaLabel              ? alertaLabel
                   : tipo;

  push(ref(db, 'alertas'), { tipo: tipoAlerta, detalle, cat, ts });
};

// ═══════════════════════════════════════════════════════════════════════════
// ─── Sistema de alertas de ambiente ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

const AMB_HIST_SIZE = 15; // ~30 segundos a lecturas cada 2s

// ── Clasificadores de zona ─────────────────────────────────────────────────
const getZonaTemp = (t) => {
  if (t > 26)  return 'critico_calor';
  if (t >= 24) return 'alerta_calor';
  if (t >= 22) return 'precaucion';
  if (t >= 18) return 'ideal';
  if (t >= 15) return 'frio';
  return 'frio_critico';
};

const getZonaHum = (h) => {
  if (h < 30)  return 'muy_seco';
  if (h < 40)  return 'seco';
  if (h <= 60) return 'ideal';
  if (h <= 70) return 'humedo';
  return 'muy_humedo';
};

// ── Debounce y cooldown (ms) ───────────────────────────────────────────────
const DEBOUNCE_TEMP = {
  critico_calor: 0,
  alerta_calor:  3 * 60000,
  precaucion:    5 * 60000,
  frio:          5 * 60000,
  frio_critico:  0,
};

const COOLDOWN_TEMP = {
  critico_calor: 5  * 60000,
  alerta_calor:  15 * 60000,
  precaucion:    30 * 60000,
  frio:          30 * 60000,
  frio_critico:  10 * 60000,
};

const DEBOUNCE_HUM = {
  muy_seco:   0,
  seco:       10 * 60000,
  humedo:     10 * 60000,
  muy_humedo:  5 * 60000,
};

const COOLDOWN_HUM = {
  muy_seco:   10 * 60000,
  seco:       30 * 60000,
  humedo:     30 * 60000,
  muy_humedo: 20 * 60000,
};

// Zonas que disparan notificación de normalización cuando regresan a ideal
const ZONAS_NORM_TEMP = new Set(['alerta_calor', 'critico_calor', 'frio', 'frio_critico']);
const ZONAS_NORM_HUM  = new Set(['muy_seco', 'muy_humedo']);

// ── Configuraciones de alertas ─────────────────────────────────────────────

const getSoloTempConfig = (zonaT, t, minutos) => {
  const T = t.toFixed(1);
  const configs = {
    frio_critico: {
      titulo: 'El cuarto está muy frío',
      cuerpo: `Está a ${T}°C — caliéntalo de inmediato. Abriga al bebé sin cubrirle la cara.`,
    },
    frio: {
      titulo: 'El cuarto está frío',
      cuerpo: `Lleva ${minutos} min a ${T}°C — el bebé puede tener frío. Cierra ventanas o ponle una cobija ligera.`,
    },
    precaucion: {
      titulo: 'El cuarto está un poco caliente',
      cuerpo: `${T}°C — si el bebé está muy abrigado considera quitarle una capa y abrir una ventana.`,
    },
    alerta_calor: {
      titulo: 'El cuarto está demasiado caliente',
      cuerpo: `Lleva ${minutos} min a ${T}°C — ventila el cuarto. Si el bebé tiene mucha ropa, quítale una capa.`,
    },
    critico_calor: {
      titulo: '¡El cuarto está muy caliente!',
      cuerpo: `${T}°C — ventila de inmediato. No le pongas más ropa ni cobijas, el calor excesivo es peligroso para el bebé.`,
    },
  };
  return configs[zonaT] || null;
};

const getSoloHumConfig = (zonaH, h) => {
  const H = Math.round(h);
  const configs = {
    muy_seco: {
      titulo: 'El cuarto está muy seco',
      cuerpo: `Humedad al ${H}% — puede resecar la nariz y garganta del bebé. Pon un humidificador.`,
    },
    seco: {
      titulo: 'El cuarto está algo seco',
      cuerpo: `${H}% de humedad — considera un humidificador o poner un vaso de agua cerca.`,
    },
    humedo: {
      titulo: 'El cuarto está algo húmedo',
      cuerpo: `${H}% de humedad — abre una ventana un rato para que circule el aire.`,
    },
    muy_humedo: {
      titulo: 'El cuarto está muy húmedo',
      cuerpo: `${H}% de humedad — ventila bien el cuarto, la humedad alta dificulta la respiración.`,
    },
  };
  return configs[zonaH] || null;
};

// Devuelve la config de alerta combinada o null si no aplica
const getComboConfig = (zonaT, zonaH, t, h) => {
  const T = t.toFixed(1);
  const H = Math.round(h);

  const esCalor  = ['precaucion', 'alerta_calor', 'critico_calor'].includes(zonaT);
  const esFrio   = ['frio', 'frio_critico'].includes(zonaT);
  const esHumedo = ['humedo', 'muy_humedo'].includes(zonaH);
  const esSeco   = ['seco', 'muy_seco'].includes(zonaH);

  // ── Caliente + Húmedo ───────────────────────────────────────────────────
  if (esCalor && esHumedo) {
    const critico  = zonaT === 'critico_calor' || (zonaT === 'alerta_calor' && zonaH === 'muy_humedo');
    const moderado = (zonaT === 'precaucion' && zonaH === 'muy_humedo') ||
                     (zonaT === 'alerta_calor' && zonaH === 'humedo');
    if (critico) return {
      severity: 'critico',
      titulo:   '¡El cuarto está muy caliente y húmedo!',
      cuerpo:   `${T}°C y ${H}% — el bebé puede sofocarse. Ventila de inmediato y no le pongas más ropa.`,
      debounce: 0,          cooldown: 5 * 60000,
    };
    if (moderado) return {
      severity: 'moderado',
      titulo:   'El cuarto está caliente y húmedo',
      cuerpo:   `${T}°C y ${H}% — el bebé se calienta más rápido en estas condiciones. Ventila el cuarto.`,
      debounce: 3 * 60000,  cooldown: 15 * 60000,
    };
    return {
      severity: 'leve',
      titulo:   'El cuarto está tibio y algo húmedo',
      cuerpo:   `${T}°C y ${H}% — abre una ventana para que circule el aire.`,
      debounce: 5 * 60000,  cooldown: 30 * 60000,
    };
  }

  // ── Caliente + Seco ─────────────────────────────────────────────────────
  if (esCalor && esSeco) {
    const critico  = zonaT === 'critico_calor' || (zonaT === 'alerta_calor' && zonaH === 'muy_seco');
    const moderado = (zonaT === 'precaucion' && zonaH === 'muy_seco') ||
                     (zonaT === 'alerta_calor' && zonaH === 'seco');
    if (critico) return {
      severity: 'critico',
      titulo:   '¡El cuarto está muy caliente y seco!',
      cuerpo:   `${T}°C y ${H}% — ventila de inmediato y pon un humidificador. El bebé puede deshidratarse muy rápido en estas condiciones.`,
      debounce: 0,          cooldown: 5 * 60000,
    };
    if (moderado) return {
      severity: 'moderado',
      titulo:   'El cuarto está caliente y seco',
      cuerpo:   `${T}°C y ${H}% — el bebé puede deshidratarse más rápido. Ventila y añade algo de humedad al cuarto.`,
      debounce: 3 * 60000,  cooldown: 15 * 60000,
    };
    return {
      severity: 'leve',
      titulo:   'El cuarto está tibio y algo seco',
      cuerpo:   `${T}°C y ${H}% — ventila un poco y considera un humidificador.`,
      debounce: 5 * 60000,  cooldown: 30 * 60000,
    };
  }

  // ── Frío + Húmedo ───────────────────────────────────────────────────────
  if (esFrio && esHumedo) {
    const critico  = zonaT === 'frio_critico';
    const moderado = zonaT === 'frio' && zonaH === 'muy_humedo';
    if (critico) return {
      severity: 'critico',
      titulo:   '¡El cuarto está muy frío y húmedo!',
      cuerpo:   `${T}°C y ${H}% — caliéntalo de inmediato. Abriga al bebé y calienta el cuarto.`,
      debounce: 0,          cooldown: 10 * 60000,
    };
    if (moderado) return {
      severity: 'moderado',
      titulo:   'El cuarto está frío y húmedo',
      cuerpo:   `${T}°C y ${H}% — el bebé pierde calor más rápido en estas condiciones. Calienta el cuarto.`,
      debounce: 5 * 60000,  cooldown: 20 * 60000,
    };
    return {
      severity: 'leve',
      titulo:   'El cuarto está frío y algo húmedo',
      cuerpo:   `${T}°C y ${H}% — el frío se siente más cuando hay humedad. Abriga bien al bebé.`,
      debounce: 10 * 60000, cooldown: 30 * 60000,
    };
  }

  // ── Frío + Seco ─────────────────────────────────────────────────────────
  if (esFrio && esSeco) {
    const critico  = zonaT === 'frio_critico';
    const moderado = zonaT === 'frio' && zonaH === 'muy_seco';
    if (critico) return {
      severity: 'critico',
      titulo:   '¡El cuarto está muy frío!',
      cuerpo:   `${T}°C y ${H}% de humedad — caliéntalo de inmediato. Abriga al bebé sin cubrirle la cara.`,
      debounce: 0,          cooldown: 10 * 60000,
    };
    if (moderado) return {
      severity: 'moderado',
      titulo:   'El cuarto está frío y muy seco',
      cuerpo:   `${T}°C y ${H}% — puede irritar la nariz y garganta del bebé. Calienta el cuarto y añade humedad.`,
      debounce: 5 * 60000,  cooldown: 20 * 60000,
    };
    return {
      severity: 'leve',
      titulo:   'El cuarto está frío y algo seco',
      cuerpo:   `${T}°C y ${H}% — puede resecar la nariz del bebé. Calienta el cuarto y pon un humidificador.`,
      debounce: 10 * 60000, cooldown: 30 * 60000,
    };
  }

  return null;
};

// ═══════════════════════════════════════════════════════════════════════════
export function SensorProvider({ children }) {

  // ── Estado térmico ─────────────────────────────────────────────────────
  const [tempBebe, setTempBebe]                 = useState(null);
  const [bebeDetectado, setBebeDetectado]       = useState(false);
  const [tendencia, setTendencia]               = useState('estable');
  const [termicoConectado, setTermicoConectado] = useState(false);

  // ── Estado ambiente ────────────────────────────────────────────────────
  const [temperatura, setTemperatura]             = useState(null);
  const [humedad, setHumedad]                     = useState(null);
  const [ambienteConectado, setAmbienteConectado] = useState(false);

  // ── Estado llanto ──────────────────────────────────────────────────────
  const [llantoActivo, setLlantoActivo]   = useState(false);
  const [ultimoLlanto, setUltimoLlanto]   = useState(null);
  const [llantoHoy, setLlantoHoy]         = useState(0);
  const llantoInicioRef                    = useRef(null);
  const llantoActivoRef                    = useRef(false);

  // ── Alerta de ambiente (banner en app) ────────────────────────────────
  const [alertaAmbiente, setAlertaAmbiente] = useState(null);

  // ── Historial ──────────────────────────────────────────────────────────
  const [historial, setHistorial] = useState([]);
  const historialTempRef           = useRef([]);

  // ── Ref para detección de temp. elevada del bebé ───────────────────────
  const tempAltaRef = useRef(false);

  // ══════════════════════════════════════════════════════════════════════
  // ── Refs del sistema de alertas de ambiente ────────────────────────────
  // ══════════════════════════════════════════════════════════════════════

  const ambTempHistRef     = useRef([]);
  const tempStateRef       = useRef({ zona: 'ideal', since: null, lastAlert: null });
  const humStateRef        = useRef({ zona: 'ideal', since: null, lastAlert: null });
  const comboStateRef      = useRef({ lastAlert: null });
  const alcistaCooldownRef = useRef(null);

  // ══════════════════════════════════════════════════════════════════════
  // ── Lógica principal de alertas de ambiente ────────────────────────────
  // ══════════════════════════════════════════════════════════════════════
  const checkAmbiente = useCallback((t, h) => {
    const now = Date.now();

    // ── 1. Actualizar historial de temperatura ───────────────────────────
    ambTempHistRef.current = [...ambTempHistRef.current, t].slice(-AMB_HIST_SIZE);

    // ── 2. Clasificar zonas actuales ─────────────────────────────────────
    const zonaT = getZonaTemp(t);
    const zonaH = getZonaHum(h);

    // ── 3. Detectar tendencia alcista ─────────────────────────────────────
    const hist    = ambTempHistRef.current;
    const alcista = hist.length >= AMB_HIST_SIZE &&
                    (hist[hist.length - 1] - hist[0]) >= 1.5;

    // ── 4. Manejar cambio de zona temperatura ─────────────────────────────
    const prevZonaT = tempStateRef.current.zona;
    if (zonaT !== prevZonaT) {
      if (zonaT === 'ideal' && ZONAS_NORM_TEMP.has(prevZonaT)) {
        setAlertaAmbiente({
          titulo: 'El cuarto ya está bien ✓',
          cuerpo: `La temperatura volvió al rango ideal (${t.toFixed(1)}°C).`,
          tipo:   'normalizacion_temp',
          ts:      now,
        });
        escribirEvento({ tipo: 'normalizacion_temp', detalle: `${t.toFixed(1)}°C`, ts: now });
      }
      tempStateRef.current = {
        zona:      zonaT,
        since:     zonaT === 'ideal' ? null : now,
        lastAlert: tempStateRef.current.lastAlert,
      };
    }

    // ── 5. Manejar cambio de zona humedad ─────────────────────────────────
    const prevZonaH = humStateRef.current.zona;
    if (zonaH !== prevZonaH) {
      if (zonaH === 'ideal' && ZONAS_NORM_HUM.has(prevZonaH)) {
        setAlertaAmbiente({
          titulo: 'La humedad ya está bien ✓',
          cuerpo: `Humedad al ${Math.round(h)}% — dentro del rango ideal.`,
          tipo:   'normalizacion_hum',
          ts:      now,
        });
        escribirEvento({ tipo: 'normalizacion_hum', detalle: `${Math.round(h)}%`, ts: now });
      }
      humStateRef.current = {
        zona:      zonaH,
        since:     zonaH === 'ideal' ? null : now,
        lastAlert: humStateRef.current.lastAlert,
      };
    }

    // ── 6. Si ambas ideales, no hay más que hacer ─────────────────────────
    if (zonaT === 'ideal' && zonaH === 'ideal') return;

    // ── 7. Intentar alerta COMBINADA (prioridad sobre individuales) ────────
    if (zonaT !== 'ideal' && zonaH !== 'ideal') {
      const combo = getComboConfig(zonaT, zonaH, t, h);
      if (combo) {
        const effectiveDebounce = alcista ? combo.debounce / 2 : combo.debounce;
        const sinceT  = tempStateRef.current.since ?? now;
        const sinceH  = humStateRef.current.since  ?? now;
        const since   = Math.min(sinceT, sinceH);
        const elapsed = now - since;
        const lastCombo  = comboStateRef.current.lastAlert;
        const cooldownOk = !lastCombo || (now - lastCombo.ts) >= combo.cooldown;

        if (elapsed >= effectiveDebounce && cooldownOk) {
          setAlertaAmbiente({ ...combo, tipo: 'combo', ts: now });
          escribirEvento({
            tipo:        combo.titulo,                       // ← título legible
            detalle:     `${t.toFixed(1)}°C · ${Math.round(h)}%`,
            alertaLabel: combo.titulo,
            ts:          now,
          });
          comboStateRef.current.lastAlert = { severity: combo.severity, ts: now };
        }
        return;
      }
    }

    // ── 8. Tendencia alcista (notificación independiente) ─────────────────
    if (alcista && ['precaucion', 'alerta_calor'].includes(zonaT)) {
      const ALCISTA_COOLDOWN  = 15 * 60000;
      const alcistaCooldownOk = !alcistaCooldownRef.current ||
                                (now - alcistaCooldownRef.current) >= ALCISTA_COOLDOWN;
      const zonaNoAlertoAun   = !tempStateRef.current.lastAlert ||
                                tempStateRef.current.lastAlert.zona !== zonaT;

      if (alcistaCooldownOk && zonaNoAlertoAun) {
        setAlertaAmbiente({
          titulo: 'La temperatura está subiendo rápido',
          cuerpo: `Ya va por ${t.toFixed(1)}°C y sigue subiendo — ventila antes de que llegue a zona de riesgo.`,
          tipo:   'tendencia_alcista',
          ts:      now,
        });
        escribirEvento({
          tipo:        'tendencia_alcista',
          detalle:     `${t.toFixed(1)}°C`,
          alertaLabel: 'temperatura en aumento',
          ts:          now,
        });
        alcistaCooldownRef.current = now;
      }
    }

    // ── 9. Alerta solo TEMPERATURA ─────────────────────────────────────────
    if (zonaT !== 'ideal') {
      const since = tempStateRef.current.since;
      if (!since) return;

      const elapsed           = now - since;
      const minutos           = Math.max(1, Math.round(elapsed / 60000));
      const baseDebounce      = DEBOUNCE_TEMP[zonaT] ?? 0;
      const effectiveDebounce = alcista ? baseDebounce / 2 : baseDebounce;
      const lastAlert         = tempStateRef.current.lastAlert;
      const cooldown          = COOLDOWN_TEMP[zonaT] ?? 0;
      const cooldownOk        = !lastAlert || (now - lastAlert.ts) >= cooldown;

      if (elapsed >= effectiveDebounce && cooldownOk) {
        const cfg = getSoloTempConfig(zonaT, t, minutos);
        if (cfg) {
          setAlertaAmbiente({ ...cfg, tipo: 'temp', ts: now });
          escribirEvento({
            tipo:        cfg.titulo,                         // ← título legible
            detalle:     `${t.toFixed(1)}°C`,
            alertaLabel: cfg.titulo,
            ts:          now,
          });
          tempStateRef.current = {
            ...tempStateRef.current,
            lastAlert: { zona: zonaT, ts: now },
          };
        }
      }
    }

    // ── 10. Alerta solo HUMEDAD ────────────────────────────────────────────
    if (zonaH !== 'ideal') {
      const since = humStateRef.current.since;
      if (!since) return;

      const elapsed      = now - since;
      const baseDebounce = DEBOUNCE_HUM[zonaH] ?? 0;
      const lastAlert    = humStateRef.current.lastAlert;
      const cooldown     = COOLDOWN_HUM[zonaH] ?? 0;
      const cooldownOk   = !lastAlert || (now - lastAlert.ts) >= cooldown;

      if (elapsed >= baseDebounce && cooldownOk) {
        const cfg = getSoloHumConfig(zonaH, h);
        if (cfg) {
          setAlertaAmbiente({ ...cfg, tipo: 'hum', ts: now });
          escribirEvento({
            tipo:        cfg.titulo,                         // ← título legible
            detalle:     `${Math.round(h)}%`,
            alertaLabel: cfg.titulo,
            ts:          now,
          });
          humStateRef.current = {
            ...humStateRef.current,
            lastAlert: { zona: zonaH, ts: now },
          };
        }
      }
    }
  }, []);

  const dismissAlertaAmbiente = useCallback(() => setAlertaAmbiente(null), []);

  // ════════════════════════════════════════════════════════════════════════
  // ── Listeners de Firebase ─────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════
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

      if (nuevaTempBebe !== null) {
        if (nuevaTempBebe > 37.2 && !tempAltaRef.current) {
          tempAltaRef.current = true;
          escribirEvento({ tipo: 'temp. elevada', detalle: `${fmtHora()} · ${nuevaTempBebe}°C` });
        } else if (nuevaTempBebe <= 37.2 && tempAltaRef.current) {
          tempAltaRef.current = false;
        }
      }

      setHistorial(prev => {
        const entrada = {
          ts:            Date.now(),
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

      const t = data.temperatura;
      const h = data.humedad;

      setTemperatura(t);
      setHumedad(h);

      if (t != null && h != null && !isNaN(t) && !isNaN(h)) {
        checkAmbiente(t, h);
      }

      setHistorial(prev => {
        if (prev.length === 0) return prev;
        const ultima = { ...prev[prev.length - 1], temperatura: t, humedad: h };
        return [...prev.slice(0, -1), ultima];
      });
    });

    // ── /llanto ───────────────────────────────────────────────────────────
    const unsubLlanto = onValue(ref(db, '/llanto'), (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      const nuevoActivo    = data.activo || false;
      const anteriorActivo = llantoActivoRef.current;

      if (nuevoActivo && !anteriorActivo) {
        llantoInicioRef.current = Date.now();
        setLlantoActivo(true);
        setLlantoHoy(prev => prev + 1);
      }

      if (!nuevoActivo && anteriorActivo && llantoInicioRef.current) {
        const durMs   = Date.now() - llantoInicioRef.current;
        const entrada = { hora: fmtHora(), duracion: msDuracion(durMs) };
        setUltimoLlanto(entrada);
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
  }, [checkAmbiente]);

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
    const humProm     = humValidas.length  ? (humValidas.reduce((a, b) => a + b, 0)  / humValidas.length).toFixed(1)  : null;

    const paso   = Math.max(1, Math.floor(entradas.length / 9));
    const puntos = entradas
      .filter((_, i) => i % paso === 0)
      .slice(0, 9)
      .map((e, i) => ({
        h:  i,
        t:  e.tempBebe ?? parseFloat(tempProm ?? '36.5'),
        ts: e.ts,
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

  const registrarEvento = useCallback((params) => escribirEvento(params), []);

  const value = {
    // Tiempo real
    tempBebe, bebeDetectado, tendencia, termicoConectado,
    temperatura, humedad, ambienteConectado,
    // Llanto
    llantoActivo, ultimoLlanto, llantoHoy,
    // Historial
    historial, statsHoy, statsSemana, statsMes,
    // Alertas de ambiente
    alertaAmbiente,
    dismissAlertaAmbiente,
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
