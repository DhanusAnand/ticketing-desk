import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { user, loading, isLoggingOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Don't navigate while auth is still loading
    if (loading) {
      console.log('Index: Auth still loading, waiting...');
      return;
    }

    // Handle navigation based on auth state
    const handleNavigation = () => {
      if (user) {
        console.log('Index: User authenticated, navigating to dashboard');
        router.replace('/dashboard');
      } else {
        console.log('Index: No user, navigating to login');
        router.replace('/login');
      }
    };

    // If we're logging out, wait a bit for the process to complete
    if (isLoggingOut) {
      console.log('Index: Logout in progress, waiting for completion...');
      const logoutTimer = setTimeout(() => {
        console.log('Index: Logout timeout reached, forcing navigation to login');
        router.replace('/login');
      }, 2000); // 2 second timeout

      return () => clearTimeout(logoutTimer);
    }

    // Navigate immediately if not logging out
    const timer = setTimeout(handleNavigation, 100);
    return () => clearTimeout(timer);
    
  }, [user, loading, isLoggingOut, router]);

  // Show loading spinner while determining auth state
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#3B4C80" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
});