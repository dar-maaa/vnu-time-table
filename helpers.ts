import * as Notifications from 'expo-notifications';
import {Platform} from "react-native";
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from "react-native-root-toast";
import {i18n} from "./i18n";
import { Moment } from "moment";

export interface Faculty {
    createdAt: string;
    id: number;
    name: string;
    refKey: string;
}

export interface Group {
    createdAt: string;
    id: number;
    name: string;
    refKey: string;
}

export interface Timetable {
    number: string;
    time: string;
    subject: string;
}

export const APP_API_TOKEN = 'y8WlGioq7br6pxrlafCepb0y2DYJDZt1E3cs3QbuHL2F3b7FQ40j3RuUIgh9HR5xUfmQv30p5AiCyUysisE05lHw4ZLwSKVf6Pa0';

// export const API_URL = 'http://192.168.1.11:3000/api/v1';

export const API_URL = 'https://vnu-time-table.digitalidea.ua/api/v1';
// export const API_URL = process.env.EXPO_PUBLIC_API_URL;
// console.log('API_URL', API_URL);

export const CORPORATE_EMAIL_DOMAIN = 'vnu.edu.ua';

export async function schedulePushNotification() {
    await Notifications.scheduleNotificationAsync({
        content: {
            title: "You've got mail! 📬",
            body: 'Here is the notification body',
            data: {data: 'goes here'},
        },
        trigger: {seconds: 2},
    });
}

export async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    if (Device.isDevice) {
        const {status: existingStatus} = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const {status} = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            showErrorMessage(i18n.t('push_notifications_permission.disabled'));
            return;
        }
        // Learn more about projectId:
        // https://docs.expo.dev/push-notifications/push-notifications-setup/#configure-projectid
        token = await Notifications.getExpoPushTokenAsync({
            projectId: Constants.expoConfig?.extra?.eas?.projectId,
        });
        console.log(token.data);
    } else {
        alert('Must use physical device for Push Notifications');
    }

    return token?.data;
}

export async function getSetting<T>(key: string, defaultValue: T | null = null): Promise<T | null> {
    let value = null;

    try {
        value = await AsyncStorage.getItem(key);
    } catch (e) {
    }

    if (value === null) {
        return value
    }

    try {
        value = JSON.parse(value);
    } catch (e) {
    }

    value = value === null ? defaultValue : value;

    return value;
}

export async function setSetting<T>(key: string, value: T) {
    const serializedValue = JSON.stringify(value);

    if (value === null || value === undefined) {
        return AsyncStorage.removeItem(key);
    }

    return AsyncStorage.setItem(key, serializedValue);
}

export async function clearSettings() {
    return AsyncStorage.clear();
}

/**
 * Fetch timetable for a group
 *
 * @param {number} groupId
 * @param {string} date
 * @return {Promise<string[][]>}
 */
export async function fetchTimetable(groupId: number, date: Moment): Promise<string[][]> {
    return fetch(`${API_URL}/timetables`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${APP_API_TOKEN}`,
        },
        body: JSON.stringify({
            groupId,
            startDate: date,
            endDate: date,
        }),
    })
        .then(response => response.json())
        .then(response => {
            if (response.message) {
                if (response.message === 'ERR_NOT_FOUND') {
                    return [];
                }

                throw new Error(response.message);
            }
            return Object.values<Timetable>(response).map(v => [v.number, v.time, v.subject || ''])
        })
        .catch(e => {
            showErrorMessage(e.message);
            return [];
        });
}

export function showErrorMessage(message: string) {
    Toast.show(message, {
        duration: Toast.durations.LONG * 2,
        position: Toast.positions.BOTTOM,
        keyboardAvoiding: true,
        textStyle: {color: 'white'},
        backgroundColor: '#A41A34',
    });
}

export function showSuccessMessage(message: string) {
    Toast.show(message, {
        duration: Toast.durations.LONG,
        keyboardAvoiding: true,
    });
}
