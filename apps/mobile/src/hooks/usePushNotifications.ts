/**
 * Push Notifications Hook
 *
 * Handles push notification registration, permissions, and handling.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, Alert, AppState, type AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { useRouter } from 'expo-router';
import { useAuth } from './useAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// =============================================================================
// Types
// =============================================================================

export interface NotificationData {
  type: string;
  [key: string]: unknown;
}

export interface PushNotificationState {
  token: string | null;
  permission: 'granted' | 'denied' | 'undetermined';
  loading: boolean;
  error: string | null;
}

// =============================================================================
// Configuration
// =============================================================================

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Storage key for push token
const PUSH_TOKEN_KEY = '@kairos/push_token';

// API base URL - should come from config
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// =============================================================================
// Hook Implementation
// =============================================================================

export function usePushNotifications() {
  const router = useRouter();
  const { user, token: authToken } = useAuth();

  const [state, setState] = useState<PushNotificationState>({
    token: null,
    permission: 'undetermined',
    loading: true,
    error: null,
  });

  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  /**
   * Register for push notifications
   */
  const registerForPushNotifications = useCallback(async (): Promise<string | null> => {
    try {
      // Must be a physical device
      if (!Device.isDevice) {
        console.log('Push notifications require a physical device');
        return null;
      }

      // Check existing permission
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permission if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        setState((prev) => ({
          ...prev,
          permission: 'denied',
          loading: false,
        }));
        return null;
      }

      // Get the push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
      });

      const pushToken = tokenData.data;

      // Configure for Android
      if (Platform.OS === 'android') {
        await configureAndroidChannels();
      }

      setState((prev) => ({
        ...prev,
        token: pushToken,
        permission: 'granted',
        loading: false,
      }));

      // Save token locally
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, pushToken);

      return pushToken;
    } catch (error) {
      console.error('Failed to register for push notifications:', error);
      setState((prev) => ({
        ...prev,
        error: (error as Error).message,
        loading: false,
      }));
      return null;
    }
  }, []);

  /**
   * Configure Android notification channels
   */
  const configureAndroidChannels = async () => {
    // Reminders channel
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      description: 'Daily study reminders and streak notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366f1',
    });

    // Achievements channel
    await Notifications.setNotificationChannelAsync('achievements', {
      name: 'Achievements',
      description: 'Achievement unlocks and level ups',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 500],
      lightColor: '#f59e0b',
    });

    // Social channel
    await Notifications.setNotificationChannelAsync('social', {
      name: 'Social',
      description: 'Friend activity and study group updates',
      importance: Notifications.AndroidImportance.DEFAULT,
    });

    // Updates channel
    await Notifications.setNotificationChannelAsync('updates', {
      name: 'Updates',
      description: 'New content and weekly summaries',
      importance: Notifications.AndroidImportance.LOW,
    });

    // Default channel
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General',
      description: 'General notifications',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  };

  /**
   * Register push token with the server
   */
  const registerTokenWithServer = useCallback(
    async (pushToken: string) => {
      if (!authToken || !user?.id) {
        console.log('No auth token or user, skipping server registration');
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/user/push-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            token: pushToken,
            platform: Platform.OS,
            deviceId: Device.deviceName,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to register push token with server');
        }

        console.log('Push token registered with server');
      } catch (error) {
        console.error('Failed to register push token with server:', error);
      }
    },
    [authToken, user?.id]
  );

  /**
   * Handle notification tap
   */
  const handleNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as NotificationData;

      console.log('Notification tapped:', data);

      // Route based on notification type
      switch (data.type) {
        case 'streak_reminder':
        case 'review_due':
          router.push('/review');
          break;

        case 'achievement_earned':
          router.push('/achievements');
          break;

        case 'goal_completed':
        case 'level_up':
          router.push('/progress');
          break;

        case 'study_group_activity':
          router.push('/leaderboard');
          break;

        case 'new_content':
          router.push('/(tabs)/discover');
          break;

        case 'weekly_summary':
          router.push('/progress');
          break;

        default:
          // Default to home
          router.push('/(tabs)');
      }
    },
    [router]
  );

  /**
   * Clear notification badge
   */
  const clearBadge = useCallback(async () => {
    await Notifications.setBadgeCountAsync(0);
  }, []);

  /**
   * Request permission manually
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    const { status } = await Notifications.requestPermissionsAsync();

    if (status === 'granted') {
      const token = await registerForPushNotifications();
      if (token) {
        await registerTokenWithServer(token);
      }
      return true;
    }

    return false;
  }, [registerForPushNotifications, registerTokenWithServer]);

  /**
   * Open settings to enable notifications
   */
  const openSettings = useCallback(() => {
    Alert.alert(
      'Enable Notifications',
      'To receive reminders and updates, please enable notifications in your device settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            // This would open device settings
            // Linking.openSettings();
          },
        },
      ]
    );
  }, []);

  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      // Get stored token
      const storedToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);

      // Check permission status
      const { status } = await Notifications.getPermissionsAsync();

      setState((prev) => ({
        ...prev,
        token: storedToken,
        permission: status as 'granted' | 'denied' | 'undetermined',
        loading: false,
      }));

      // If permission granted and user logged in, register
      if (status === 'granted' && user?.id) {
        const token = await registerForPushNotifications();
        if (token) {
          await registerTokenWithServer(token);
        }
      }
    };

    initialize();
  }, [user?.id, registerForPushNotifications, registerTokenWithServer]);

  // Set up notification listeners
  useEffect(() => {
    // Handle notifications received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received:', notification);
      }
    );

    // Handle notification taps
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [handleNotificationResponse]);

  // Clear badge when app becomes active
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        clearBadge();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [clearBadge]);

  return {
    ...state,
    requestPermission,
    openSettings,
    clearBadge,
    isEnabled: state.permission === 'granted',
  };
}

/**
 * Schedule a local notification (for testing or offline reminders)
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  trigger: Notifications.NotificationTriggerInput,
  data?: Record<string, unknown>
): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger,
  });
}

/**
 * Schedule daily streak reminder
 */
export async function scheduleStreakReminder(hour: number, minute: number): Promise<string> {
  // Cancel any existing streak reminder
  await Notifications.cancelScheduledNotificationAsync('streak-reminder');

  return Notifications.scheduleNotificationAsync({
    identifier: 'streak-reminder',
    content: {
      title: "Don't forget to study!",
      body: 'Keep your streak going by reviewing some cards today.',
      data: { type: 'streak_reminder' },
      sound: true,
    },
    trigger: {
      hour,
      minute,
      repeats: true,
    },
  });
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export default usePushNotifications;
