import {Redirect, Stack, router} from 'expo-router';
import {Button, StyleSheet, Text, View, ActivityIndicator} from 'react-native';
import {i18n} from "../i18n";
import {JSXElementConstructor, ReactElement, ReactNode, ReactPortal, useEffect, useState } from "react";
import { fetchTimetable, getSetting, Group } from "../helpers";
import Entypo from "@expo/vector-icons/Entypo";
import CalendarStrip from 'react-native-calendar-strip';
import moment from 'moment/min/moment-with-locales';
import { Table, Rows } from 'react-native-reanimated-table';

function HeaderTitle(props: { children: string | number | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | null | undefined; }) {
    return <View style={styles.headerTitle}>
        <Text style={styles.headerLabel}>{props.children}</Text>
        <Entypo name="cog" size={20} style={styles.headerIcon} onPress={() => router.push('settings')}/>
    </View>;
}

export default function IndexPage() {
    const [isFirstRun, setIsFirstRun] = useState<boolean>(true);
    const [appIsReady, setAppIsReady] = useState<boolean>(false);
    const [selectedDate, setSelectedDate] = useState<moment.Moment>(moment());
    const [table, setTable] = useState<string[][]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [userGroupId, setUserGroupId] = useState<number | null>(null);

    async function fetchData(groupId: number) {
        setLoading(true);

        console.log('fetchData', groupId, selectedDate);
        const data = await fetchTimetable(groupId, selectedDate);

        setTable(data);
        setLoading(false);
    }

    useEffect(() => {
        async function prepare() {
            const group = await getSetting<Group>('group');
            const isFirstRun = await getSetting<boolean>('isFirstRun', !group?.id) || true;

            console.log('isFirstRun', isFirstRun);
            console.log('group', group);

            setIsFirstRun(isFirstRun);

            if (!isFirstRun && group?.id) {
                setUserGroupId(group.id);
                await fetchData(group.id);
            }

            setAppIsReady(true);
        }

        prepare();
    }, []);

    useEffect(() => {
        if (!userGroupId) {
            return;
        }

        fetchData(userGroupId);
    }, [selectedDate, userGroupId]);

    if (!appIsReady) {
        return null;
    }

    moment.locale(i18n.locale);

    const minDate = moment().subtract(1, 'month');
    const maxDate = moment().add(1, 'month');

    const datesWhitelist = [{
        start: minDate,
        end: maxDate,
    }];

    return (
        isFirstRun ? <Redirect href="settings"/> :
            <View>
                <Stack.Screen
                    options={{
                        // https://reactnavigation.org/docs/headers#setting-the-header-title
                        title: i18n.t('calendar'),
                        // https://reactnavigation.org/docs/headers#adjusting-header-styles
                        headerStyle: {backgroundColor: '#A41A34'},
                        headerTintColor: '#fff',
                        headerTitleStyle: {
                            fontWeight: 'bold',
                        },
                        // https://reactnavigation.org/docs/headers#replacing-the-title-with-a-custom-component
                        headerTitle: props => <HeaderTitle {...props} />,
                    }}
                />
                <View style={styles.quickButtonsContainer}>
                    <Button
                        title={i18n.t('today')}
                        color={'#A41A34'}
                        onPress={() => {
                            setSelectedDate(moment());
                        }}
                    />
                    <Button
                        title={i18n.t('tomorrow')}
                        color={'#A41A34'}
                        onPress={() => {
                            setSelectedDate(moment().add(1, 'day'));
                        }}
                    />
                </View>
                <View>
                    <CalendarStrip
                        minDate={minDate}
                        maxDate={maxDate}
                        scrollable
                        startingDate={moment()}
                        selectedDate={selectedDate}
                        onDateSelected={setSelectedDate}
                        style={styles.calendar}
                        dateNumberStyle={{color: '#000'}}
                        dateNameStyle={{color: '#000'}}
                        highlightDateNumberStyle={{color: '#A41A34'}}
                        highlightDateNameStyle={{color: '#A41A34'}}
                        disabledDateNameStyle={{color: 'grey'}}
                        disabledDateNumberStyle={{color: 'grey'}}
                        datesWhitelist={datesWhitelist}
                        // calendarAnimation={{
                        //     type: 'sequence',
                        //     duration: 30,
                        // }}
                        // daySelectionAnimation={{
                        //     type: 'border',
                        //     duration: 300,
                        //     borderHighlightColor: '#A41A34',
                        //     borderWidth: 2,
                        //     animType: 'spring',
                        //     animUpdateType: 'scale',
                        //     animProperty: 'opacity',
                        // }}
                    />
                </View>
                {
                    table.length ?
                        <View style={styles.contentContainer}>
                            <Table borderStyle={{borderWidth: 1, borderColor: '#A41A34'}}>
                                <Rows data={table} textStyle={styles.text} widthArr={[30, 70, 300]}/>
                            </Table>
                        </View> :
                        loading ?
                            <ActivityIndicator size="large" color="#A41A34" style={{marginTop: 122}}/> :
                            <Text style={{textAlign: 'center', fontSize: 16, marginTop: 122}}>{i18n.t('no_data')}</Text>
                }
            </View>
    );
}

const styles = StyleSheet.create({
    headerTitle: {
        display: 'flex',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerLabel: {
        fontSize: 20,
        fontWeight: 'bold',
        color: 'white',
    },
    headerIcon: {
        color: 'white',
        position: 'absolute',
        right: 45,
    },
    quickButtonsContainer: {
        paddingHorizontal: 15,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    calendar: {
        height: 120,
        paddingTop: 20,
        paddingBottom: 10,
        paddingHorizontal: 5,
    },
    contentContainer: {
        paddingHorizontal: 15,
    },
    text: {
        margin: 6,
        textAlign: 'center',
    }
});
