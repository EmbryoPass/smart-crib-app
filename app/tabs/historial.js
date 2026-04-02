import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '../constants/colors';

export default function Historial() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.title}>historial</Text>
        <Text style={styles.sub}>stats · diario · alertas</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', paddingBottom: 72 },
  title:     { fontSize: 22, fontWeight: '500', color: Colors.brown, marginBottom: 6 },
  sub:       { fontSize: 13, color: Colors.textSecondary },
});