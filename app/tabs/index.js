import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '../constants/colors';

export default function Inicio() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.appName}>
          capullo<Text style={styles.dot}>.</Text>
        </Text>
        <Text style={styles.sub}>pantalla de inicio</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', paddingBottom: 72 },
  appName:   { fontSize: 28, fontWeight: '500', color: Colors.brown, marginBottom: 8 },
  dot:       { color: Colors.brownLight },
  sub:       { fontSize: 13, color: Colors.textSecondary },
});