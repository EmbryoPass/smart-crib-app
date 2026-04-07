import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  SafeAreaView, KeyboardAvoidingView, Platform,
  ScrollView, Animated, Dimensions,
} from 'react-native';

const { width: SW } = Dimensions.get('window');
const MASCOTA_SIZE_WELCOME = 200;
const MASCOTA_SIZE_FORM = 150;

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
import { Image } from 'react-native';

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
    {error && <Text style={inputS.error}>{error}</Text>}
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

// ═══════════════════════════════════════════════════════════════════════════
// PANTALLA 1: BIENVENIDA
// ═══════════════════════════════════════════════════════════════════════════
const BienvenidaScreen = ({ onCrearCuenta, onTengoCuenta }) => (
  <SafeAreaView style={[s.safe, { backgroundColor: C.crema }]}>
    <View style={s.bienvenidaContainer}>

      {/* Destellitos decorativos */}
      <View style={s.sparkles}>
        <Text style={[s.sparkle, { top: 0, left: 30 }]}>✦</Text>
        <Text style={[s.sparkle, { top: 20, right: 40, fontSize: 10 }]}>✦</Text>
        <Text style={[s.sparkle, { top: 50, left: 60, fontSize: 8 }]}>✦</Text>
      </View>

      {/* Mascota */}
      <Mascota size={MASCOTA_SIZE_WELCOME} />

      {/* Textos */}
      <View style={s.bienvenidaTexts}>
        <Text style={s.appName}>capullo<Text style={{ color: C.trigo }}>.</Text></Text>
        <Text style={s.tagline}>Tu cuna inteligente,{'\n'}Tu bebé siempre seguro</Text>
      </View>

      {/* Botones */}
      <View style={s.bienvenidaBtns}>
        <TouchableOpacity style={s.btnPrimary} onPress={onCrearCuenta} activeOpacity={0.85}>
          <Text style={s.btnPrimaryLabel}>Crear cuenta</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.btnSecondary} onPress={onTengoCuenta} activeOpacity={0.85}>
          <Text style={s.btnSecondaryLabel}>Ya tengo cuenta</Text>
        </TouchableOpacity>
      </View>

      {/* Link info */}
      <TouchableOpacity style={{ marginTop: 8 }}>
        <Text style={s.linkText}>¿Qué es Capullo? →</Text>
      </TouchableOpacity>

    </View>
  </SafeAreaView>
);

// ═══════════════════════════════════════════════════════════════════════════
// PANTALLA 2: CREAR CUENTA
// ═══════════════════════════════════════════════════════════════════════════
const CrearCuentaScreen = ({ onContinuar, onIniciarSesion }) => {
  const [nombre, setNombre]   = useState('');
  const [email, setEmail]     = useState('');
  const [pass, setPass]       = useState('');
  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);

  const validar = () => {
    const e = {};
    if (!nombre.trim())          e.nombre = 'Ingresa tu nombre';
    if (!email.includes('@'))    e.email  = 'Email inválido';
    if (pass.length < 6)         e.pass   = 'Mínimo 6 caracteres';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleContinuar = () => {
    if (!validar()) return;
    setLoading(true);
    // TODO: llamar a tu API de registro / Firebase Auth
    setTimeout(() => { setLoading(false); onContinuar({ nombre, email }); }, 800);
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.crema }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={s.formContainer} keyboardShouldPersistTaps="handled">

          {/* Mascota pequeña */}
          <Mascota size={MASCOTA_SIZE_FORM} />

          {/* Título */}
          <View style={s.formHeader}>
            <Text style={s.formTitle}>Hola, ¿Cómo te llamas?</Text>
            <Text style={s.formSubtitle}>Crea tu cuenta para empezar</Text>
          </View>

          {/* Campos */}
          <View style={s.fields}>
            <Input
              label="Tu nombre"
              placeholder="Sofía"
              value={nombre}
              onChangeText={setNombre}
              error={errors.nombre}
            />
            <Input
              label="Email"
              placeholder="sofia@gmail.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              error={errors.email}
            />
            <Input
              label="Contraseña"
              placeholder="••••••••"
              value={pass}
              onChangeText={setPass}
              secureTextEntry
              error={errors.pass}
            />
          </View>

          {/* Botón continuar */}
          <TouchableOpacity
            style={[s.btnAmarillo, loading && { opacity: 0.7 }]}
            onPress={handleContinuar}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={s.btnAmarilloLabel}>
              {loading ? 'creando cuenta...' : 'continuar →'}
            </Text>
          </TouchableOpacity>

          {/* Link login */}
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
const IniciarSesionScreen = ({ onEntrar, onRegistrate }) => {
  const [email, setEmail]     = useState('');
  const [pass, setPass]       = useState('');
  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);

  const validar = () => {
    const e = {};
    if (!email.includes('@')) e.email = 'Email inválido';
    if (pass.length < 6)      e.pass  = 'Mínimo 6 caracteres';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleEntrar = () => {
    if (!validar()) return;
    setLoading(true);
    // TODO: llamar a tu API de login / Firebase Auth
    setTimeout(() => { setLoading(false); onEntrar({ email }); }, 800);
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.crema }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={s.formContainer} keyboardShouldPersistTaps="handled">

          {/* Mascota pequeña */}
          <Mascota size={MASCOTA_SIZE_FORM} />

          {/* Título */}
          <View style={s.formHeader}>
            <Text style={s.formTitle}>¡bienvenida de vuelta!</Text>
            <Text style={s.formSubtitle}>tu bebé te ha estado esperando</Text>
          </View>

          {/* Campos */}
          <View style={s.fields}>
            <Input
              label="email"
              placeholder="sofia@gmail.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              error={errors.email}
            />
            <Input
              label="contraseña"
              placeholder="••••••••"
              value={pass}
              onChangeText={setPass}
              secureTextEntry
              error={errors.pass}
            />
          </View>

          {/* Olvidaste tu contraseña */}
          <TouchableOpacity style={s.forgotBtn}>
            {/* TODO: flujo de recuperación de contraseña */}
            <Text style={s.forgotText}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          {/* Botón entrar */}
          <TouchableOpacity
            style={[s.btnPrimary, loading && { opacity: 0.7 }]}
            onPress={handleEntrar}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={s.btnPrimaryLabel}>
              {loading ? 'entrando...' : 'entrar'}
            </Text>
          </TouchableOpacity>

          {/* Link registro */}
          <TouchableOpacity onPress={onRegistrate} style={{ marginTop: 4 }}>
            <Text style={s.linkText}>¿No tienes cuenta? Regístrate</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CONTENEDOR PRINCIPAL — maneja la navegación entre pantallas
// ═══════════════════════════════════════════════════════════════════════════

// Paso: 'bienvenida' | 'registro' | 'login'
const InicioSesion = ({ onAuthSuccess }) => {
  const [paso, setPaso] = useState('bienvenida');

  if (paso === 'bienvenida') {
    return (
      <BienvenidaScreen
        onCrearCuenta={() => setPaso('registro')}
        onTengoCuenta={() => setPaso('login')}
      />
    );
  }

  if (paso === 'registro') {
    return (
      <CrearCuentaScreen
        onContinuar={(datos) => {
          // TODO: guardar datos de sesión en contexto global / AsyncStorage
          onAuthSuccess(datos);
        }}
        onIniciarSesion={() => setPaso('login')}
      />
    );
  }

  if (paso === 'login') {
    return (
      <IniciarSesionScreen
        onEntrar={(datos) => {
          // TODO: guardar token / sesión
          onAuthSuccess(datos);
        }}
        onRegistrate={() => setPaso('registro')}
      />
    );
  }

  return null;
};

// ═══════════════════════════════════════════════════════════════════════════
// ESTILOS
// ═══════════════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  safe: { flex: 1 },

  // ── Bienvenida ─────────────────────────────────────────────────────────
  bienvenidaContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 28,
  },
  sparkles: { position: 'absolute', top: 60, width: '100%', height: 80 },
  sparkle:  { position: 'absolute', fontSize: 14, color: C.trigo, opacity: 0.7 },

  bienvenidaTexts: { alignItems: 'center', gap: 8 },
  appName: {
    fontSize: 36,
    fontWeight: '700',
    color: C.cacao,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 15,
    color: C.textS,
    textAlign: 'center',
    lineHeight: 22,
  },

  bienvenidaBtns: { width: '100%', gap: 12 },

  // ── Formularios ────────────────────────────────────────────────────────
  formContainer: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 40,
    gap: 20,
  },
  formHeader: { alignItems: 'center', gap: 6 },
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: C.textP,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  formSubtitle: {
    fontSize: 14,
    color: C.textM,
    textAlign: 'center',
  },
  fields: { width: '100%', gap: 14 },

  forgotBtn: { alignSelf: 'flex-end', marginTop: -6 },
  forgotText: { fontSize: 13, color: C.textM },

  // ── Botones ────────────────────────────────────────────────────────────
  btnPrimary: {
    width: '100%',
    backgroundColor: C.cacao,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnPrimaryLabel: {
    color: C.crema,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  btnSecondary: {
    width: '100%',
    backgroundColor: 'transparent',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.cacao,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnSecondaryLabel: {
    color: C.cacao,
    fontSize: 16,
    fontWeight: '600',
  },
  btnAmarillo: {
    width: '100%',
    backgroundColor: C.amarillo,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnAmarilloLabel: {
    color: C.cacao,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  linkText: {
    fontSize: 13,
    color: C.textS,
    textDecorationLine: 'underline',
  },
});

export default InicioSesion;
