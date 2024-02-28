import {router, Stack} from 'expo-router';
import {View, Text, StyleSheet, Button, TextInput, Keyboard, Alert} from 'react-native';
import React, {useEffect, useState} from "react";
import {
    API_URL, APP_API_TOKEN,
    clearSettings,
    CORPORATE_EMAIL_DOMAIN, Faculty,
    getSetting, Group,
    registerForPushNotificationsAsync,
    setSetting,
    showErrorMessage,
    showSuccessMessage
} from "../helpers";
import {Dropdown} from "react-native-element-dropdown";
import Slider from '@react-native-community/slider';
import {i18n} from "../i18n";
import * as Localization from "expo-localization";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import Toast from "react-native-root-toast";

interface StudentSettings {
    expoPushToken: string;
    year: number;
    email: string;
    facultyId: number;
    groupId: number;
    locale: string;
    deviceLocale: string | null;
}

interface StudentSettingsDB extends StudentSettings {
    id: number;
}

interface StudentSettingsResponse {
    student: StudentSettingsDB;
}

interface ApiError {
    message: string | string[];
}

export default function SettingsPage() {
    const [studentId, setStudentId] = useState<number | null>(null);
    const [faculty, setFaculty] = useState<Faculty | null>(null);
    const [faculties, setFaculties] = useState<Faculty[]>([]);
    const [year, setYear] = useState<number | null>(1);
    const [groups, setGroups] = useState<Group[]>([]);
    const [group, setGroup] = useState<Group | null>(null);
    const [email, setEmail] = useState<string | null>('');
    const [expoPushToken, setExpoPushToken] = useState<string | undefined>('');
    const [tapsCount, setTapsCount] = useState<number>(0);

    const [lastTapTime, setLastTapTime] = useState(0);

    const isValid = (typeof email === 'string' && email?.length > 0)
      && faculty?.id
      && (typeof year === 'number' && year > 0)
      && group?.id;

    useEffect(() => {
        async function fetchData() {
            fetch(`${API_URL}/faculties`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${APP_API_TOKEN}`,
                },
            })
                .then(response => response.json())
                .then(setFaculties)
                .catch(error => {
                    showErrorMessage(error.message);
                });

            fetch(`${API_URL}/groups`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${APP_API_TOKEN}`,
                },
            })
                .then(response => response.json())
                .then(setGroups)
                .catch(error => {
                    showErrorMessage(error.message);
                });

            const savedEmail = await getSetting<string>('email');
            setEmail(savedEmail);

            const savedFaculty = await getSetting<Faculty>('faculty', null);
            setFaculty(savedFaculty);

            const savedYear = await getSetting<number>('year', 1);
            setYear(savedYear);

            const savedGroup = await getSetting<Group>('group');
            if (savedGroup) {
                setGroups([savedGroup]);
            }
            setGroup(savedGroup);

            const savedStudentId = await getSetting<number>('studentId');
            setStudentId(savedStudentId);
        }

        fetchData();
    }, []);

    return (
        <View
            style={styles.container}
            onLayout={async () => {
                try {
                    const token = await Notifications.getExpoPushTokenAsync({
                        projectId: Constants.expoConfig?.extra?.eas?.projectId,
                    });

                    setExpoPushToken(token.data);
                } catch (e) {
                    Alert.alert(i18n.t('push_notifications_permission.title'), i18n.t('push_notifications_permission.message'), [
                        {
                            text: i18n.t('push_notifications_permission.cancel'),
                            style: 'cancel',
                            onPress: () => {
                                showErrorMessage(i18n.t('push_notifications_permission.denied'));
                            }
                        },
                        {
                            text: i18n.t('push_notifications_permission.allow'),
                            isPreferred: true,
                            onPress: () => {
                                registerForPushNotificationsAsync()
                                    .then(setExpoPushToken);
                            },
                        },
                    ]);
                }
            }}
            onTouchStart={(e) => {
                Keyboard.dismiss()
                const now = Date.now();

                // If the tap was within 2 seconds of the last tap
                if (now - lastTapTime < 2000) {
                    // If tapped on view
                    // noinspection JSUnresolvedReference
                    // @ts-ignore
                    if (e.target?.viewConfig?.uiViewClassName === 'RCTView') {
                        setTapsCount(tapsCount + 1);

                        if (tapsCount >= 4) {
                            Alert.alert(i18n.t('reset_settings_warning.title'), i18n.t('reset_settings_warning.message'), [
                                {
                                    text: i18n.t('reset_settings_warning.cancel'),
                                    style: 'cancel',
                                },
                                {
                                    text: i18n.t('reset_settings_warning.confirm'),
                                    style: 'destructive',
                                    onPress: async () => {
                                        setTapsCount(0);
                                        await clearSettings();

                                        showSuccessMessage(i18n.t('reset_settings_warning.confirmed'));

                                        router.back();
                                    },
                                },
                            ]);
                        }
                    }
                } else {
                    setTapsCount(1);
                }

                setLastTapTime(now);
            }}>
            <Stack.Screen
                options={{
                    title: i18n.t('settings'),
                }}
            />
            <View>
                <Text style={styles.label}>
                    {i18n.t('your_email')}
                </Text>
                <TextInput
                    style={styles.input}
                    placeholder={i18n.t('enter_your_email')}
                    value={email || undefined}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                />

                <Text style={styles.label}>
                    {i18n.t('your_faculty')}
                </Text>
                <Dropdown
                    style={styles.dropdown}
                    placeholderStyle={styles.placeholderStyle}
                    selectedTextStyle={styles.selectedTextStyle}
                    inputSearchStyle={styles.inputSearchStyle}
                    iconStyle={styles.iconStyle}
                    search
                    autoScroll
                    data={faculties}
                    labelField="name"
                    valueField="id"
                    value={faculty}
                    onChange={setFaculty}
                    placeholder={i18n.t('select_a_faculty')}
                    renderLeftIcon={() => (
                        <Text style={styles.icon}>🏫</Text>
                    )}
                />

                <Text style={styles.label}>
                    {i18n.t('your_year', {year})}
                </Text>
                <Slider
                    minimumValue={1}
                    maximumValue={5}
                    step={1}
                    value={year || undefined}
                    onValueChange={setYear}
                    minimumTrackTintColor="#A41A34"
                    maximumTrackTintColor="#000000"
                />

                <Text style={styles.label}>
                    {i18n.t('your_group')}
                </Text>
                <Dropdown
                    style={styles.dropdown}
                    placeholderStyle={styles.placeholderStyle}
                    selectedTextStyle={styles.selectedTextStyle}
                    inputSearchStyle={styles.inputSearchStyle}
                    iconStyle={styles.iconStyle}
                    search
                    autoScroll
                    data={groups}
                    labelField="name"
                    valueField="id"
                    value={group}
                    onChange={setGroup}
                    searchField="name"
                    placeholder={i18n.t('select_a_group')}
                    renderLeftIcon={() => (
                        <Text style={styles.icon}>👥</Text>
                    )}
                />
            </View>

            <Button
                title={i18n.t('save_settings')}
                disabled={!isValid}
                onPress={async () => {
                    /* Validate email, if invalid, show error message */

                    //  1. The Email should have CORPORATE_EMAIL_DOMAIN as domain
                    if (!email?.endsWith(`@${CORPORATE_EMAIL_DOMAIN}`)) {
                        showErrorMessage(i18n.t('invalid_corporate_email', {corporate_domain: CORPORATE_EMAIL_DOMAIN}));
                        return;
                    }

                    // 2. The Email should have a valid format
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                        showErrorMessage(i18n.t('invalid_email'));
                        return;
                    }

                    await setSetting('faculty', faculty);
                    await setSetting('year', year || 0);
                    await setSetting('group', group);
                    await setSetting('isFirstRun', false);
                    await setSetting('email', email);

                    const payload: StudentSettings | StudentSettingsDB = {
                        expoPushToken: expoPushToken || "",
                        year: year || 1,
                        email: email,
                        facultyId: faculty?.id || 0,
                        groupId: group?.id || 0,
                        locale: i18n.locale,
                        deviceLocale: Localization.getLocales()[0].languageCode,
                    }

                    if (studentId) {
                        (payload as StudentSettingsDB).id = studentId;
                    }

                    try {
                        const student = await fetch(`${API_URL}/students`, {
                            method: studentId ? 'PUT' : 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${APP_API_TOKEN}`,
                            },
                            body: JSON.stringify(payload),
                        })
                            .then(response => response.json() as Promise<StudentSettingsResponse | ApiError>)
                            .then(response => {
                                if ('message' in response) {
                                    const message = Array.isArray(response.message) ? response.message : [response.message];
                                    throw new Error(message.join('\n'));
                                }

                                return response?.student;
                            })

                        await setSetting('studentId', student.id);

                        showSuccessMessage(i18n.t('settings_saved'));

                        if (router.canGoBack()) {
                            router.back();
                        } else {
                            router.replace('/');
                        }
                    } catch (e: any) {
                        showErrorMessage(e.message);
                    }
                }}
            />
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 10,
        paddingBottom: 40,
        paddingHorizontal: 30,
        justifyContent: 'space-between',
    },
    input: {
        height: 40,
        borderColor: 'gray',
        borderWidth: 0.5,
        borderRadius: 8,
        paddingHorizontal: 8,
    },
    dropdown: {
        height: 50,
        borderColor: 'gray',
        borderWidth: 0.5,
        borderRadius: 8,
        paddingHorizontal: 8,
    },
    icon: {
        marginRight: 5,
    },
    label: {
        marginHorizontal: 8,
        marginTop: 20,
        marginBottom: 8,
        fontSize: 16,
    },
    placeholderStyle: {
        fontSize: 16,
    },
    selectedTextStyle: {
        fontSize: 16,
    },
    iconStyle: {
        width: 20,
        height: 20,
    },
    inputSearchStyle: {
        height: 40,
        fontSize: 16,
    },
    button: {
        marginTop: "auto",
    }
});
