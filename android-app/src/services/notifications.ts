import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Platform, Vibration } from 'react-native';

const REST_CHANNEL_ID = 'gymlog-rest-timer';
let activeNotificationId: string | null = null;
let initialized = false;

export async function initRestNotifications(): Promise<void> {
  if (initialized) return;
  initialized = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(REST_CHANNEL_ID, {
      name: 'Rest Timer Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 150, 80, 150],
      lightColor: '#22C55E',
      sound: 'default',
    });
  }

  const perms = await Notifications.getPermissionsAsync();
  if (perms.status !== 'granted') {
    await Notifications.requestPermissionsAsync();
  }
}

export async function scheduleRestFinishedNotification(
  seconds: number,
  exerciseName: string
): Promise<void> {
  await cancelRestFinishedNotification();
  if (seconds <= 0) return;

  try {
    await initRestNotifications();
    activeNotificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Rest complete — next set',
        body: exerciseName ? `Ready for your next set of ${exerciseName}` : 'Time to lift!',
        sound: 'default',
        vibrate: [0, 150, 80, 150],
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.ceil(seconds)),
        channelId: REST_CHANNEL_ID,
      },
    });
  } catch {
    // Notification permission may be denied on device; in-app timer & vibration still work.
  }
}

export async function cancelRestFinishedNotification(): Promise<void> {
  if (!activeNotificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(activeNotificationId);
  } catch {
    // Ignore if already delivered or cancelled
  } finally {
    activeNotificationId = null;
  }
}

export function triggerSetCheckHaptic(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function triggerRestDoneAlert(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  Vibration.vibrate([120, 80, 120]);
}
