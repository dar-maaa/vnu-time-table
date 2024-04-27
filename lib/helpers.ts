import {Platform} from "react-native";
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from "react-native-root-toast";
import {i18n} from "./i18n";
import { Moment } from "moment";
import { create } from 'zustand';
import ExpoMixpanelAnalytics from "./ExpoMixpanelAnalytics";
import {
    AndroidImportance,
    getExpoPushTokenAsync,
    getPermissionsAsync,
    requestPermissionsAsync,
    scheduleNotificationAsync,
    setBadgeCountAsync,
    setNotificationChannelAsync
} from "expo-notifications";
import { getLocales } from "expo-localization";
import { captureException } from "@sentry/react-native";
import { isDevice } from "expo-device";
import * as Haptics from "expo-haptics";

export const DEV_EMAILS = ['serhii_dev', 'serhii', 'serhii_mac', 'dasha'];
export const DEV_EMAIL_WITH_DOMAIN = '@matrunchyk.com';
export const DEV_NAME = 'Dariia Matrunchyk';

export const APP_API_TOKEN = 'y8WlGioq7br6pxrlafCepb0y2DYJDZt1E3cs3QbuHL2F3b7FQ40j3RuUIgh9HR5xUfmQv30p5AiCyUysisE05lHw4ZLwSKVf6Pa0';
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://vnu-time-table.digitalidea.ua/api/v1';
export const CORPORATE_EMAIL_DOMAIN = 'vnu.edu.ua';

const MIXPANEL_API_KEY = '65a607fc427135da618c28b9346900a0';

export enum NotificationType {
    MOTIVATION = 'MOTIVATION',
    TIMETABLE = 'TIMETABLE',
}

export interface ReceivedNotification {
    message: string;
    type: NotificationType;
}

type GrowToSize<T, N extends number, A extends T[]> =
    A['length'] extends N ? A : GrowToSize<T, N, [...A, T]>;

export type FixedArray<T, N extends number> = GrowToSize<T, N, []>;

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

export interface HttpResponse {
    message?: string | string[];
    code: number;
}

export interface Motivation {
    id: number;
    text: string;
    createdAt: string;
}

export interface StudentSettings {
    expoPushToken: string;
    year: number;
    email: string;
    facultyId: number;
    groupId: number;
    locale: string;
    deviceLocale: string | null;
    enableNotifications: boolean;
}

export interface StudentSettingsDB extends StudentSettings {
    id: number;
    emailConfirmed: boolean;
    createdAt: string;
    faculty: Faculty;
    group: Group;
}

// Interfaces for the weather data structure
interface MainDetails {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    sea_level: number;
    grnd_level: number;
    humidity: number;
    temp_kf: number;
}

interface WeatherCondition {
    id: number;
    main: string;
    description: string;
    icon: string;
}

interface Clouds {
    all: number;
}

interface Wind {
    speed: number;
    deg: number;
    gust: number;
}

interface Precipitation {
    '3h'?: number;
}

interface SystemDetails {
    pod: string;
}

export interface WeatherForecast {
    dt: number;
    main: MainDetails;
    weather: WeatherCondition[];
    clouds: Clouds;
    wind: Wind;
    visibility: number;
    pop: number;
    rain?: Precipitation;
    snow?: Precipitation;
    sys: SystemDetails;
    dt_txt: string;
}


// Type for organizing forecasts by the day of the month with a maximum of 8 forecasts per day
export type DayOfMonthForecasts = FixedArray<FixedArray<WeatherForecast, 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8>, 6>;

export interface WeatherResponse {
    current: WeatherForecast;
    daily: DayOfMonthForecasts;
}

interface UserState {
    emailConfirmed: boolean;
    hasNewMotivations: boolean;
    setEmailConfirmed: (flag: boolean) => void;
    setHasNewMotivations: (flag: boolean) => void;
}

export const mixpanel = new ExpoMixpanelAnalytics(MIXPANEL_API_KEY);

export const useUserStore = create<UserState>(set => ({
    emailConfirmed: false,
    hasNewMotivations: false,
    setEmailConfirmed: (flag: boolean) => set({ emailConfirmed: flag }),
    setHasNewMotivations: (flag: boolean) => set({ hasNewMotivations: flag }),
}));

export async function schedulePushNotification() {
    await scheduleNotificationAsync({
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
        await setNotificationChannelAsync('default', {
            name: 'default',
            importance: AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    if (isDevice) {
        const {status: existingStatus} = await getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const {status} = await requestPermissionsAsync({
                ios: {
                    allowAlert: true,
                    allowBadge: true,
                    allowSound: true,
                    allowDisplayInCarPlay: true,
                    provideAppNotificationSettings: true,
                    allowProvisional: true,
                },
            });
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            showErrorMessage(i18n.t('push_notifications_permission.disabled'));
            return;
        }
        // Learn more about projectId:
        // https://docs.expo.dev/push-notifications/push-notifications-setup/#configure-projectid
        token = await getExpoPushTokenAsync({
            projectId: Constants.expoConfig?.extra?.eas?.projectId,
        });

        await setBadgeCountAsync(0);
    } else {
        alert('Must use physical device for Push Notifications');
    }

    return token?.data;
}

export async function getSetting<T, S extends T = T>(key: string, defaultValue: S): Promise<T | S>
export async function getSetting<T>(key: string): Promise<T | null>
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
 * @param {boolean} forceRefresh
 * @return {Promise<string[][]>}
 */
export async function fetchTimetable(groupId: number, date: Moment, forceRefresh: boolean): Promise<string[][]> {
    const url = forceRefresh ? `${API_URL}/timetables?force=1` : `${API_URL}/timetables`;

    return fetch(url, {
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
            captureException(e);
            showErrorMessage(e.message);
            return [];
        });
}

/**
 * Retrieves the student's motivations
 *
 * @param studentId
 */
export async function fetchStudentMotivations(studentId: number): Promise<Motivation[]> {
    return fetch(`${API_URL}/students/${studentId}/motivations`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${APP_API_TOKEN}`,
        },
    })
        .then(response => response.json())
        .then(response => {
            if (response.message) {
                showErrorMessage(i18n.t(`errors.${response.message}`));
            }

            return response;
        });
}

/**
 * Show an error message
 *
 * @param message
 */
export function showErrorMessage(message: string) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Toast.show(message, {
        duration: Toast.durations.LONG * 2,
        position: Toast.positions.BOTTOM,
        keyboardAvoiding: true,
        textStyle: {color: 'white'},
        backgroundColor: '#A41A34',
    });

    mixpanel.track('Error', {message});
}

/**
 * Show a success message
 *
 * @param message
 */
export function showSuccessMessage(message: string) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Toast.show(message, {
        duration: Toast.durations.LONG,
        keyboardAvoiding: true,
    });
}

/**
 * Normalize the email address
 *
 * @param email
 */
export function normalizeEmail(email: string | null): string {
    if (!email) {
        return '';
    }

    let normalizedEmail = `${email.toLowerCase().trim()}@${CORPORATE_EMAIL_DOMAIN}`;

    if (DEV_EMAILS.includes(email)) {
        normalizedEmail = `${email}${DEV_EMAIL_WITH_DOMAIN}`;
    }

    return normalizedEmail;
}

/**
 * Get the color for the wind speed
 *
 * @param speed Meter per second
 */
export function getWindColor(speed: number): string {
    if (speed < 10) {
        return '#cfcfcf';
    }

    if (speed < 15) {
        return '#FFA500';
    }

    return '#af2222';
}

export function getVisibilityColor(visibility: number): string {
    if (visibility > 1000) {
        return '#cfcfcf';
    }

    if (visibility > 300) {
        return '#FFA500';
    }

    return '#af2222';
}

export async function fetchWeather(lat: number, long: number): Promise<WeatherResponse> {
    const lang = getLocales()[0].languageCode;
    const url = `${API_URL}/weather/forecast?lat=${lat}&long=${long}&lang=${lang}`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${APP_API_TOKEN}`,
        },
    });

    return await response.json() as Promise<WeatherResponse>;
}

export async function getWeatherImage(lat: number, long: number, studentId: number): Promise<string> {
    const lang = getLocales()[0].languageCode;
    const url = `${API_URL}/weather/image?lat=${lat}&long=${long}&lang=${lang}&studentId=${studentId}1`;

    return fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${APP_API_TOKEN}`,
        },
    }).then(response => response.text())

}

export function hPaToMmhg(hPa: number): number {
    return Math.round(hPa * 0.75006375541921);
}
