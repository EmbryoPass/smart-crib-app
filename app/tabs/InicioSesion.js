// app/tabs/InicioSesion.js — Capullo App
// Flujo de autenticación conectado a Firebase Auth

import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, Image, ActivityIndicator,
} from 'react-native';
import {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from '../constants/firebase';

// ─── Paleta ────────────────────────────────────────────────────────────────
const C = {
  crema:    '#F5F0E8',
  arena:    '#EDE4D0',
  trigo:    '#C9A96E',
  cacao:    '#3E2010',
  textP:    '#2C1A0A',
  textS:    '#7A6248',
  textM:    '#B0937A',
  border:   '#E0D5C0',
  card:     '#FFFFFF',
  amarillo: '#E8C94A',
  placeholder: '#C8B49A',
  error:    '#C05050',
  errorBg:  '#FCEAEA',
};

// ─── Mascota ───────────────────────────────────────────────────────────────
const Mascota = ({ size = 100 }) => (
  <Image
    source={require('../../assets/mascota.png')}
    style={{ width: size, height: size }}
    resizeMode="contain"
  />
);

// ─── Input reutilizable ────────────────────────────────────────────────────
const Input = ({ label, placeholder, value, onChangeText, secureTextEntry, keyboardType, error }) => (
  <View style={inputS.wrapper}>
    {label && <Text style={inputS.label}>{label}</Text>}
    <TextInput
      style={[inputS.input, error && { borderColor: C.error }]}
      placeholder={placeholder}
      placeholderTextColor={C.placeholder}
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize="none"
      autoCorrect={false}
    />
    {error ? <Text style={inputS.error}>{error}</Text> : null}
  </View>
);

const inputS = StyleSheet.create({
  wrapper: { gap: 6 },
  label:   { fontSize: 13, color: C.textS, fontWeight: '500' },
  input: {
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: C.textP,
  },
  error: { fontSize: 11, color: C.error, marginTop: 2 },
});

// ─── Traduce errores de Firebase a español ─────────────────────────────────
const traducirError = (code) => {
  const errores = {
    'auth/email-already-in-use':    'Este email ya está registrado.',
    'auth/invalid-email':           'El email no es válido.',
    'auth/weak-password':           'La contraseña debe tener al menos 6 caracteres.',
    'auth/user-not-found':          'No encontramos una cuenta con ese email.',
    'auth/wrong-password':          'Contraseña incorrecta.',
    'auth/invalid-credential':      'Email o contraseña incorrectos.',
    'auth/too-many-requests':       'Demasiados intentos. Espera un momento.',
    'auth/network-request-failed':  'Sin conexión. Revisa tu internet.',
  };
  return errores[code] ?? 'Algo salió mal. Intenta de nuevo.';
};

// ═══════════════════════════════════════════════════════════════════════════
// PANTALLA 1: BIENVENIDA
// ═══════════════════════════════════════════════════════════════════════════

const BienvenidaScreen = ({ onCrearCuenta, onTengoCuenta }) => (
  <SafeAreaView style={[s.safe, { backgroundColor: C.crema }]}>
    <View style={s.bienvenidaContainer}>

      <View style={s.sparkles}>
        <Text style={[s.sparkle, { top: 0,  left: 30 }]}>✦</Text>
        <Text style={[s.sparkle, { top: 20, right: 40, fontSize: 10 }]}>✦</Text>
        <Text style={[s.sparkle, { top: 50, left: 60, fontSize: 8  }]}>✦</Text>
      </View>

      <Mascota size={110} />

      <View style={s.bienvenidaTexts}>
        <Text style={s.appName}>capullo<Text style={{ color: C.trigo }}>.</Text></Text>
        <Text style={s.tagline}>tu cuna inteligente,{'\n'}tu bebé siempre seguro</Text>
      </View>

      <View style={s.bienvenidaBtns}>
        <TouchableOpacity style={s.btnPrimary} onPress={onCrearCuenta} activeOpacity={0.85}>
          <Text style={s.btnPrimaryLabel}>crear cuenta</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btnSecondary} onPress={onTengoCuenta} activeOpacity={0.85}>
          <Text style={s.btnSecondaryLabel}>ya tengo cuenta</Text>
        </TouchableOpacity>
      </View>

    </View>
  </SafeAreaView>
);

// ═══════════════════════════════════════════════════════════════════════════
// PANTALLA 2: CREAR CUENTA
// ═══════════════════════════════════════════════════════════════════════════

const CrearCuentaScreen = ({ onExito, onIniciarSesion }) => {
  const [nombre, setNombre] = useState('');
  const [email,  setEmail]  = useState('');
  const [pass,   setPass]   = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validar = () => {
    const e = {};
    if (!nombre.trim())       e.nombre = 'Ingresa tu nombre.';
    if (!email.includes('@')) e.email  = 'Email inválido.';
    if (pass.length < 6)      e.pass   = 'Mínimo 6 caracteres.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCrear = async () => {
    if (!validar()) return;
    setLoading(true);
    setErrors({});
    try {
      // 1. Crear usuario en Firebase Auth
      const credencial = await createUserWithEmailAndPassword(auth, email, pass);
      // 2. Guardar el nombre en el perfil
      await updateProfile(credencial.user, { displayName: nombre.trim() });
      // 3. Pasar datos a App.js
      onExito({ nombre: nombre.trim(), email, uid: credencial.user.uid });
    } catch (err) {
      setErrors({ general: traducirError(err.code) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.crema }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.formContainer} keyboardShouldPersistTaps="handled">

          <Mascota size={72} />

          <View style={s.formHeader}>
            <Text style={s.formTitle}>hola, ¿cómo te llamas?</Text>
            <Text style={s.formSubtitle}>crea tu cuenta para empezar</Text>
          </View>

          {/* Error general de Firebase */}
          {errors.general ? (
            <View style={[s.errorBox, { backgroundColor: C.errorBg }]}>
              <Text style={[s.errorBoxText, { color: C.error }]}>{errors.general}</Text>
            </View>
          ) : null}

          <View style={s.fields}>
            <Input label="tu nombre"   placeholder="Sofía"           value={nombre} onChangeText={setNombre} error={errors.nombre} />
            <Input label="email"       placeholder="sofia@gmail.com"  value={email}  onChangeText={setEmail}  keyboardType="email-address" error={errors.email} />
            <Input label="contraseña"  placeholder="••••••••"         value={pass}   onChangeText={setPass}   secureTextEntry error={errors.pass} />
          </View>

          <TouchableOpacity
            style={[s.btnAmarillo, loading && { opacity: 0.7 }]}
            onPress={handleCrear}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={C.cacao} />
              : <Text style={s.btnAmarilloLabel}>continuar →</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={onIniciarSesion} style={{ marginTop: 4 }}>
            <Text style={s.linkText}>¿Ya tienes cuenta? Inicia sesión</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// PANTALLA 3: INICIAR SESIÓN
// ═══════════════════════════════════════════════════════════════════════════

const LoginScreen = ({ onExito, onRegistrate }) => {
  const [email,  setEmail]  = useState('');
  const [pass,   setPass]   = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validar = () => {
    const e = {};
    if (!email.includes('@')) e.email = 'Email inválido.';
    if (pass.length < 6)      e.pass  = 'Mínimo 6 caracteres.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleEntrar = async () => {
    if (!validar()) return;
    setLoading(true);
    setErrors({});
    try {
      const credencial = await signInWithEmailAndPassword(auth, email, pass);
      onExito({
        nombre: credencial.user.displayName ?? email,
        email:  credencial.user.email,
        uid:    credencial.user.uid,
      });
    } catch (err) {
      setErrors({ general: traducirError(err.code) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.crema }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.formContainer} keyboardShouldPersistTaps="handled">

          <Mascota size={72} />

          <View style={s.formHeader}>
            <Text style={s.formTitle}>¡bienvenida de vuelta!</Text>
            <Text style={s.formSubtitle}>tu bebé te ha estado esperando</Text>
          </View>

          {errors.general ? (
            <View style={[s.errorBox, { backgroundColor: C.errorBg }]}>
              <Text style={[s.errorBoxText, { color: C.error }]}>{errors.general}</Text>
            </View>
          ) : null}

          <View style={s.fields}>
            <Input label="email"      placeholder="sofia@gmail.com" value={email} onChangeText={setEmail} keyboardType="email-address" error={errors.email} />
            <Input label="contraseña" placeholder="••••••••"        value={pass}  onChangeText={setPass}  secureTextEntry error={errors.pass} />
          </View>

          <TouchableOpacity style={{ alignSelf: 'flex-end', marginTop: -6 }}>
            <Text style={s.forgotText}>¿olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.btnPrimary, loading && { opacity: 0.7 }]}
            onPress={handleEntrar}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={C.crema} />
              : <Text style={s.btnPrimaryLabel}>entrar</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={onRegistrate} style={{ marginTop: 4 }}>
            <Text style={s.linkText}>¿No tienes cuenta? Regístrate</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CONTENEDOR PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function InicioSesion({ onAuthSuccess }) {
  const [paso, setPaso] = useState('bienvenida');

  if (paso === 'bienvenida') return (
    <BienvenidaScreen
      onCrearCuenta={() => setPaso('registro')}
      onTengoCuenta={() => setPaso('login')}
    />
  );

  if (paso === 'registro') return (
    <CrearCuentaScreen
      onExito={onAuthSuccess}
      onIniciarSesion={() => setPaso('login')}
    />
  );

  if (paso === 'login') return (
    <LoginScreen
      onExito={onAuthSuccess}
      onRegistrate={() => setPaso('registro')}
    />
  );

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// ESTILOS
// ═══════════════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  safe: { flex: 1 },

  bienvenidaContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 28 },
  sparkles:   { position: 'absolute', top: 60, width: '100%', height: 80 },
  sparkle:    { position: 'absolute', fontSize: 14, color: C.trigo, opacity: 0.7 },

  bienvenidaTexts: { alignItems: 'center', gap: 8 },
  appName:  { fontSize: 36, fontWeight: '700', color: C.cacao, letterSpacing: -1 },
  tagline:  { fontSize: 15, color: C.textS, textAlign: 'center', lineHeight: 22 },

  bienvenidaBtns: { width: '100%', gap: 12 },

  formContainer: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 28, paddingTop: 40, paddingBottom: 40, gap: 20 },
  formHeader:    { alignItems: 'center', gap: 6 },
  formTitle:     { fontSize: 22, fontWeight: '700', color: C.textP, textAlign: 'center', letterSpacing: -0.5 },
  formSubtitle:  { fontSize: 14, color: C.textM, textAlign: 'center' },
  fields:        { width: '100%', gap: 14 },

  errorBox:     { width: '100%', borderRadius: 10, padding: 12 },
  errorBoxText: { fontSize: 13, textAlign: 'center' },

  forgotText: { fontSize: 13, color: C.textM },

  btnPrimary:      { width: '100%', backgroundColor: C.cacao, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryLabel: { color: C.crema, fontSize: 16, fontWeight: '600', letterSpacing: 0.2 },
  btnSecondary:    { width: '100%', backgroundColor: 'transparent', borderRadius: 14, borderWidth: 1.5, borderColor: C.cacao, paddingVertical: 16, alignItems: 'center' },
  btnSecondaryLabel: { color: C.cacao, fontSize: 16, fontWeight: '600' },
  btnAmarillo:      { width: '100%', backgroundColor: C.amarillo, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnAmarilloLabel: { color: C.cacao, fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  linkText: { fontSize: 13, color: C.textS, textDecorationLine: 'underline' },
});