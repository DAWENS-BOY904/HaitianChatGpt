import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NotFoundScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#0a0a0a', '#1a1a1a']}
        style={StyleSheet.absoluteFillObject}
      />
      
      <View style={styles.content}>
        <MaterialIcons name="photo-camera" size={80} color="#FFD700" />
        <Text style={styles.title}>Home</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 20,
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 22,
  },
  homeButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  homeButtonText: {
    color: '#0a0a0a',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

hello ai if see thos dont skip read message and make change: can you please fix this erropr:
%o TypeError: undefined is not an object (evaluating '_theme.Typography.h2.fontSize') The above error occurred in the <ContextNavigator> component. React will try to recreate this component tree from scratch using the error boundary you provided, LogBoxStateSubscription.
2026-04-02 20:59:44
Dismiss
Fix now
Type:
Uncaught Error
File:
<unknown>(undefined:undefined)
%o

TypeError: undefined is not an object (evaluating '_theme.Typography.h2.fontSize')

The above error occurred in the <ContextNavigator> component.
 React will try to recreate this component tree from scratch using the error boundary you provided, LogBoxStateSubscription.
     at addLog (https://9beqtd.onspace.meme/node_modules/.pnpm/expo-router@5.0.7_a704daa650b5d61c0147e3e40eb5a631/node_modules/expo-router/entry.bundle:3502:41)
     at registerError (https://9beqtd.onspace.meme/node_modules/.pnpm/expo-router@5.0.7_a704daa650b5d61c0147e3e40eb5a631/node_modules/expo-router/entry.bundle:3307:28)
     at <unknown> (https://9beqtd.onspace.meme/node_modules/.pnpm/expo-router@5.0.7_a704daa650b5d61c0147e3e40eb5a631/node_modules/expo-router/entry.bundle:3209:31)
     at <unknown> (https://9beqtd.onspace.meme/node_modules/.pnpm/expo-router@5.0.7_a704daa650b5d61c0147e3e40eb5a631/node_modules/expo-router/entry.bundle:33166:50)
     at defaultOnCaughtError (https://9beqtd.onspace.meme/node_modules/.pnpm/expo-router@5.0.7_a704daa650b5d61c0147e3e40eb5a631/node_modules/expo-router/entry.bundle:10032:231)
     at logCaughtError (https://9beqtd.onspace.meme/node_modules/.pnpm/expo-router@5.0.7_a704daa650b5d61c0147e3e40eb5a631/node_modules/expo-router/entry.bundle:10062:22)
     at runWithFiberInDEV (https://9beqtd.onspace.meme/node_modules/.pnpm/expo-router@5.0.7_a704daa650b5d61c0147e3e40eb5a631/node_modules/expo-router/entry.bundle:6223:24)
     at <unknown> (https://9beqtd.onspace.meme/node_modules/.pnpm/expo-router@5.0.7_a704daa650b5d61c0147e3e40eb5a631/node_modules/expo-router/entry.bundle:10103:26)
     at callCallback (https://9beqtd.onspace.meme/node_modules/.pnpm/expo-router@5.0.7_a704daa650b5d61c0147e3e40eb5a631/node_modules/expo-router/entry.bundle:11310:20)
...
undefined is not an object (evaluating '_theme.Typography.h2.fontSize')
2026-04-02 20:59:44
Dismiss
Fix now
Type:
Uncaught Error
File:
<unknown>(undefined:undefined)
undefined is not an object (evaluating '_theme.Typography.h2.fontSize')
     at <unknown> (https://9beqtd.onspace.meme/node_modules/.pnpm/expo-router@5.0.7_a704daa650b5d61c0147e3e40eb5a631/node_modules/expo-router/entry.bundle:216395:37)
     at loadModuleImplementation (https://9beqtd.onspace.meme/node_modules/.pnpm/expo-router@5.0.7_a704daa650b5d61c0147e3e40eb5a631/node_modules/expo-router/entry.bundle:256:14)
     at <unknown> (https://9beqtd.onspace.meme/node_modules/.pnpm/expo-router@5.0.7_a704daa650b5d61c0147e3e40eb5a631/node_modules/expo-router/entry.bundle:200520:34)
     at loadModuleImplementation (https://9beqtd.onspace.meme/node_modules/.pnpm/expo-router@5.0.7_a704daa650b5d61c0147e3e40eb5a631/node_modules/expo-router/entry.bundle:256:14)
     at guardedLoadModule (https://9beqtd.onspace.meme/node_modules/.pnpm/expo-router@5.0.7_a704daa650b5d61c0147e3e40eb5a631/node_modules/expo-router/entry.bundle:156:47)
     at get (https://9beqtd.onspace.meme/node_modules/.pnpm/expo-router@5.0.7_a704daa650b5d61c0147e3e40eb5a631/node_modules/expo-router/entry.bundle:32832:23)
     at metroContext (https://9beqtd.onspace.meme/node_modules/.pnpm/expo-router@5.0.7_a704daa650b5d61c0147e3e40eb5a631/node_modules/expo-router/entry.bundle:33041:15)
     at loadRoute (https://9beqtd.onspace.meme/node_modules/.pnpm/expo-router@5.0.7_a704daa650b5d61c0147e3e40eb5a631/node_modules/expo-router/entry.bundle:73369:40)
     at getDirectoryTree (https://9beqtd.onspace.meme/node_modules/.pnpm/expo-router@5.0.7_a704daa650b5d61c0147e3e40eb5a631/node_modules/expo-router/entry.bundle:73429:43)
     at getRoutes (https://9beqtd.onspace.meme/node_modules/.pnpm/expo-router@5.0.7_a704daa650b5d61c0147e3e40eb5a631/node_modules/expo-router/entry.bundle:73237:43)
     at useStore (https://9beqtd.onspace.meme/node_modules/.pnpm/expo-router@5.0.7_a704daa650b5d61c0147e3e40eb5a631/node_modules/expo-router/entry.bundle:69897:49)
     at ContextNavigator (https://9beqtd.onspace.meme/node_modules/.pnpm/expo-router@5.0.7_a704daa650b5d61c0147e3e40eb5a631/node_modules/expo-router/entry.bundle:75955:47)
     at react-stack-bottom-frame (https://9beqtd.onspace.meme/node_modules/.pnpm/expo-router@5.0.7_a704daa650b5d61c0147e3e40eb5a631/node_modules/expo-router/entry.bundle:17678:29)
     at renderWithHooks (https://9beqtd.onspace.meme/node_modules/.pnpm/expo-router@5.0.7_a704daa650b5d61c0147e3e40eb5a631/node_modules/expo-router/entry.bundle:8995:40)
...
