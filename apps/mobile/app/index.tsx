import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/auth-context';
import { colors } from '@/theme/tokens';

export default function Index() {
  const { booting, user } = useAuth();
  if (booting) return <View style={styles.center}><ActivityIndicator color={colors.accent} /><Text style={styles.text}>SECURE SESSION</Text></View>;
  if (!user) return <Redirect href="/auth" />;
  if (user.staffRole) return <Redirect href="/staff" />;
  return <Redirect href="/(tabs)" />;
}
const styles = StyleSheet.create({ center:{flex:1,backgroundColor:colors.background,alignItems:'center',justifyContent:'center',gap:12}, text:{color:colors.muted,fontSize:10,fontWeight:'900',letterSpacing:1.4} });
