import { View, Image, TouchableOpacity, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Video } from 'expo-av';

export default function Preview() {
  const { uri, type } = useLocalSearchParams();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {type === 'video' ? (
        <Video
          source={{ uri: uri as string }}
          style={{ flex: 1 }}
          useNativeControls
          resizeMode="contain"
        />
      ) : (
        <Image
          source={{ uri: uri as string }}
          style={{ flex: 1 }}
          resizeMode="contain"
        />
      )}

      <TouchableOpacity
        onPress={() => router.back()}
        style={{
          position: 'absolute',
          bottom: 40,
          alignSelf: 'center',
          padding: 16,
          backgroundColor: '#fff',
          borderRadius: 30,
        }}
      >
        <Text>Send</Text>
      </TouchableOpacity>
    </View>
  );
}
