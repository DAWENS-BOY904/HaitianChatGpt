import { Redirect } from 'expo-router';

export default function TabsIndex() {
  return <Redirect href="/home" />;
}
please ai fix this error Cannot update a component (`ImperativeApiEmitter`) while rendering a different component (`RootScreen(./index.tsx)`). To locate the bad setState() call inside `RootScreen(./index.tsx)`, follow the stack trace as described in https://react.dev/link/setstate-in-render
app/(tabs)/_layout(6:2719)
Cannot update a component (`ImperativeApiEmitter`) while rendering a different component (`RootScreen(./index.tsx)`). To locate the bad setState() call inside `RootScreen(./index.tsx)`, follow the stack trace as described in https://react.dev/link/setstate-in-render.