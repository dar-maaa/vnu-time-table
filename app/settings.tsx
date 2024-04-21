import { router, Stack } from 'expo-router';
import { View, Text, StyleSheet, Button, TextInput, Keyboard, Alert } from 'react-native';
import React, { useEffect, useState } from "react";
import {
    API_URL,
    APP_API_TOKEN,
    CORPORATE_EMAIL_DOMAIN,
    Faculty,
    Group,
    clearSettings,
    getSetting,
    registerForPushNotificationsAsync,
    setSetting,
    showErrorMessage,
    showSuccessMessage,
    normalizeEmail,
} from "../helpers";
import { Dropdown } from "react-native-element-dropdown";
import Slider from '@react-native-community/slider';
import { i18n } from "../i18n";
import * as Localization from "expo-localization";
import { Checkbox } from "expo-checkbox";
import Entypo from "@expo/vector-icons/Entypo";
import { Tooltip } from "@rneui/themed";

interface StudentSettings {
    expoPushToken: string;
    year: number;
    email: string;
    facultyId: number;
    groupId: number;
    locale: string;
    deviceLocale: string | null;
    enableNotifications: boolean;
}

interface StudentSettingsDB extends StudentSettings {
    id: number;
    emailConfirmed: boolean;
}

interface StudentSettingsResponse {
    student: StudentSettingsDB;
}

export default function SettingsPage() {
    const [studentId, setStudentId] = useState<number | null>(null);
    const [faculty, setFaculty] = useState<Faculty | null>(null);
    const [faculties, setFaculties] = useState<Faculty[]>([]);
    const [year, setYear] = useState<number>(1);
    const [groups, setGroups] = useState<Group[]>([]);
    const [group, setGroup] = useState<Group | null>(null);
    const [email, setEmail] = useState<string>('');
    const [prevEmail, setPrevEmail] = useState<string>('');
    const [emailFocused, setEmailFocused] = useState<boolean>(false);
    const [emailConfirmed, setEmailConfirmed] = useState<boolean | null>(false);
    const [expoPushToken, setExpoPushToken] = useState<string | undefined>('');
    const [tapsCount, setTapsCount] = useState<number>(0);
    const [enableNotifications, setEnableNotifications] = useState<boolean>(false);
    const [lastTapTime, setLastTapTime] = useState(0);
    const [emailTooltipVisible, setEmailTooltipVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [student, setStudent] = useState<StudentSettingsDB | null>(null);

    const isEmailValid = email?.length > 0
        && !email.includes('@')
        && email.match(/^[a-z0-9._%+-]+$/);

    const isValid = isEmailValid
        && faculty?.id
        && year > 0
        && group?.id;

    const saveIsDisabled = !isValid || isLoading;
    const isEmailConfirmed = emailConfirmed && email === prevEmail;

    useEffect(() => {
        if (enableNotifications) {
            setIsLoading(true);

            registerForPushNotificationsAsync()
                .then(async token => {
                    setExpoPushToken(token);
                    await setSetting('expoPushToken', token);
                })
                .then(() => {
                    setIsLoading(false);
                })
                .catch(error => {
                    showErrorMessage(error.message);
                })
        }
    }, [enableNotifications]);

    useEffect(() => {
        setIsLoading(true);

        async function fetchData() {
            // await setSetting('emailConfirmed', false); // TODO: remove this line

            fetch(`${API_URL}/faculties`, {
                headers: {
                    'Content-Type' : 'application/json',
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
                    'Content-Type' : 'application/json',
                    'Authorization': `Bearer ${APP_API_TOKEN}`,
                },
            })
                .then(response => response.json())
                .then(setGroups)
                .catch(error => {
                    showErrorMessage(error.message);
                });

            if (studentId) {
                await fetch(`${API_URL}/students/${studentId}`, {
                    headers: {
                        'Content-Type' : 'application/json',
                        'Authorization': `Bearer ${APP_API_TOKEN}`,
                    },
                })
                    .then(response => response.json())
                    .then((s: StudentSettingsResponse) => {
                        setStudent(s.student);
                    })
                    .catch(error => {
                        showErrorMessage(error.message);
                    });

                if (!student) {
                    setIsLoading(false);
                    return;
                }

                await setSetting('student', student);

                const emailWithoutDomain = student.email.split('@')[0];

                setEmail(emailWithoutDomain);
                setPrevEmail(emailWithoutDomain);
                await setSetting('email', emailWithoutDomain);

                setYear(student.year);
                await setSetting('year', student.year);

                setExpoPushToken(student.expoPushToken);
                await setSetting('expoPushToken', student.expoPushToken);

                setEnableNotifications(student.enableNotifications);
                await setSetting('enableNotifications', student.enableNotifications);

                setEmailConfirmed(student.emailConfirmed);
                await setSetting('emailConfirmed', student.emailConfirmed);

                const foundFaculty = faculties.find(f => f.id === student.facultyId);

                if (foundFaculty) {
                    setFaculty(foundFaculty);
                    await setSetting('faculty', foundFaculty);
                }

                const foundGroup = groups.find(g => g.id === student.groupId);

                if (foundGroup) {
                    setGroup(foundGroup);
                    await setSetting('group', foundGroup);
                }

            } else {
                const savedEmail = await getSetting<string>('email');

                if (savedEmail) {
                    setEmail(savedEmail);
                    setPrevEmail(savedEmail);
                }

                const savedFaculty = await getSetting<Faculty>('faculty', null);
                setFaculty(savedFaculty);

                const savedYear = await getSetting<number>('year', 1);

                if (savedYear) {
                    setYear(savedYear);
                }

                const savedGroup = await getSetting<Group>('group');
                if (savedGroup) {
                    setGroups([savedGroup]);
                }
                setGroup(savedGroup);

                const savedStudentId = await getSetting<number>('studentId');
                setStudentId(savedStudentId);

                const expoPushToken = await getSetting<string>('expoPushToken');

                if (expoPushToken) {
                    setExpoPushToken(expoPushToken);
                }

                const savedEnableNotifications = await getSetting<boolean>('enableNotifications', true);

                if ((savedEnableNotifications !== null) && expoPushToken) {
                    setEnableNotifications(savedEnableNotifications);
                }

                const emailConfirmed = await getSetting<boolean>('emailConfirmed', false);
                setEmailConfirmed(emailConfirmed);
            }

            setIsLoading(false);
        }

        fetchData();
    }, []);

    return (
        <View
            style={styles.container}
            onTouchStart={() => {
                Keyboard.dismiss()
                const now = Date.now();

                // If the tap was within 2 seconds of the last tap
                if (now - lastTapTime < 2000) {
                    setTapsCount(tapsCount + 1);

                    if (tapsCount >= 6 && email.includes('destroy')) {
                        Alert.alert(i18n.t('reset_settings_warning.title'), i18n.t('reset_settings_warning.message'), [
                            {
                                text : i18n.t('reset_settings_warning.cancel'),
                                style: 'cancel',
                            },
                            {
                                text   : i18n.t('reset_settings_warning.confirm'),
                                style  : 'destructive',
                                onPress: async () => {
                                    setTapsCount(0);
                                    await clearSettings();

                                    showSuccessMessage(i18n.t('reset_settings_warning.confirmed'));

                                    if (router.canGoBack()) {
                                        router.back();
                                    } else {
                                        router.replace('/');
                                    }
                                },
                            },
                        ]);
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
                <View style={{
                    flexDirection: 'row',
                    alignItems   : 'center',
                }}>
                    <TextInput
                        style={{
                            ...styles.input,
                            flex: 4,
                            textAlign: emailFocused ? 'right' : 'left',
                            borderColor: isEmailValid ? 'gray' : 'red',
                        }}
                        placeholder={i18n.t('enter_your_email')}
                        onFocus={() => {
                            setEmailFocused(true);
                        }}
                        onBlur={() => {
                            setEmailFocused(false);
                        }}
                        value={email || undefined}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                    />
                    <Text style={{...styles.label, marginTop: 8, color: 'grey', fontWeight: '600'}}>
                        @{CORPORATE_EMAIL_DOMAIN}
                    </Text>
                    <View>
                        <Tooltip
                            backgroundColor="#fff"
                            popover={
                                <Text>{
                                    isEmailConfirmed ?
                                        i18n.t('your_email_is_confirmed') :
                                        i18n.t('your_email_is_not_confirmed_yet')
                                }</Text>
                            }
                            containerStyle={{
                                height      : 60,
                                borderRadius: 7,
                                borderColor : isEmailConfirmed ? 'green' : 'orange',
                                borderWidth : 1,
                                marginTop   : 10,
                            }}
                            visible={emailTooltipVisible}
                            withPointer={false}
                        >
                            <View onTouchStart={() => {
                                setEmailTooltipVisible(true);
                                setTimeout(() => setEmailTooltipVisible(false), 2000);
                            }}>
                                <Entypo name={isEmailConfirmed ? 'check' : 'warning'} size={18} color={isEmailConfirmed ? 'green' : 'orange'}/>
                            </View>
                        </Tooltip>
                    </View>
                </View>
                {isEmailValid ?
                    null :
                    <Text style={{color: 'red', fontSize: 12, marginHorizontal: 8}}>{i18n.t('invalid_email')}</Text>}
                <Text style={{...styles.description, marginTop: 8}}>
                    {i18n.t('email_description')}
                </Text>

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
                <View style={styles.checkboxContainer} onTouchStart={() => {
                    setEnableNotifications(!enableNotifications);
                }}>
                    <Checkbox
                        value={enableNotifications}
                        style={styles.checkbox}
                    />
                    <Text style={styles.label}>
                        {i18n.t('receive_notifications')}
                    </Text>
                </View>
                <Text style={styles.description}>
                    {i18n.t('receive_notifications_description')}
                </Text>
            </View>

            <Button
                title={i18n.t('save_settings')}
                disabled={saveIsDisabled}
                onPress={async () => {
                    await setSetting('faculty', faculty);
                    await setSetting('year', year || 0);
                    await setSetting('group', group);
                    await setSetting('email', email);
                    await setSetting('enableNotifications', enableNotifications);

                    setPrevEmail(email);

                    const normalizedEmail = normalizeEmail(email);

                    const payload: StudentSettings | StudentSettingsDB = {
                        expoPushToken: expoPushToken || "",
                        year         : year || 1,
                        email        : normalizedEmail,
                        facultyId    : faculty?.id || 0,
                        groupId      : group?.id || 0,
                        locale       : i18n.locale,
                        deviceLocale : Localization.getLocales()[0].languageCode,
                        enableNotifications,
                    }

                    if (studentId) {
                        (payload as StudentSettingsDB).id = studentId;
                    }

                    try {
                        const student = await fetch(`${API_URL}/students`, {
                            method : studentId ? 'PUT' : 'POST',
                            headers: {
                                'Content-Type' : 'application/json',
                                'Authorization': `Bearer ${APP_API_TOKEN}`,
                            },
                            body   : JSON.stringify(payload),
                        })
                            .then(response => response.json() as Promise<StudentSettingsResponse>)
                            .then(response => {
                                if ('message' in response) {
                                    const message = Array.isArray(response.message) ? response.message : [response.message];
                                    throw new Error(message.join('\n'));
                                }

                                return response?.student;
                            })

                        setEmailConfirmed(student.emailConfirmed);

                        await setSetting('emailConfirmed', student.emailConfirmed);
                        await setSetting('studentId', student.id);
                        await setSetting('student', student);

                        showSuccessMessage(i18n.t('settings_saved'));

                        if (!student.emailConfirmed) {
                            router.push({
                                pathname: '/email-confirmation',
                                params: {
                                    email: normalizedEmail,
                                },
                            });
                        } else if (router.canGoBack()) {
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
    container        : {
        flex             : 1,
        paddingTop       : 10,
        paddingBottom    : 40,
        paddingHorizontal: 30,
        justifyContent   : 'space-between',
    },
    input            : {
        height           : 40,
        borderColor      : 'gray',
        borderWidth      : 0.5,
        borderRadius     : 8,
        paddingHorizontal: 8,
    },
    dropdown         : {
        height           : 50,
        borderColor      : 'gray',
        borderWidth      : 0.5,
        borderRadius     : 8,
        paddingHorizontal: 8,
    },
    icon             : {
        marginRight: 5,
    },
    label            : {
        marginHorizontal: 8,
        marginTop       : 20,
        marginBottom    : 8,
        fontSize        : 16,
    },
    description      : {
        marginHorizontal: 8,
        marginBottom    : 8,
        fontSize        : 12,
        color           : 'gray',
    },
    placeholderStyle : {
        fontSize: 16,
    },
    selectedTextStyle: {
        fontSize: 16,
    },
    iconStyle        : {
        width : 20,
        height: 20,
    },
    inputSearchStyle : {
        height  : 40,
        fontSize: 16,
    },
    button           : {
        marginTop: "auto",
    },
    checkboxContainer: {
        flexDirection    : "row",
        paddingHorizontal: 8,
    },
    checkbox         : {
        marginTop: 20,
    }
});
