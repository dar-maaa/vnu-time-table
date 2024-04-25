import { Redirect, Stack, router } from 'expo-router';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { i18n } from "../lib/i18n";
import { JSXElementConstructor, ReactElement, ReactNode, ReactPortal, useEffect, useState } from "react";
import { fetchStudentMotivations, fetchTimetable, getSetting, Group, mixpanel, Motivation, useUserStore } from "../lib/helpers";
import Entypo from "@expo/vector-icons/Entypo";
import Material from "@expo/vector-icons/MaterialIcons";
import CalendarStrip from 'react-native-calendar-strip';
import moment from 'moment/min/moment-with-locales';
import { Table, Row } from 'react-native-reanimated-table';
import PagerView from "react-native-pager-view";
import { captureException, setUser } from "@sentry/react-native";
import * as Haptics from 'expo-haptics';

function HeaderTitle(props: {
    children: string | number | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | null | undefined;
}) {
    return <View style={styles.headerTitle}>
        <TouchableOpacity onPress={() => router.push('weather')} style={styles.headerIconWrapper}>
            <Material name="wb-sunny" size={20} style={styles.headerIcon}/>
        </TouchableOpacity>
        <Text style={styles.headerLabel}>{props.children}</Text>
        <TouchableOpacity onPress={() => router.push('settings')} style={styles.headerIconWrapper}>
            <Entypo name="cog" size={20} style={styles.headerIcon}/>
        </TouchableOpacity>
    </View>;
}

export default function IndexPage() {
    const [appIsReady, setAppIsReady] = useState<boolean>(false);
    const [selectedDate, setSelectedDate] = useState<moment.Moment>(moment());
    const [table, setTable] = useState<string[][]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [userGroupId, setUserGroupId] = useState<number | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [motivations, setMotivations] = useState<Motivation[]>([]);
    const [motivationPagerHeight, setMotivationPagerHeight] = useState(0);
    const [motivationPagerHeights, setMotivationPagerHeights] = useState<Map<number, number>>(new Map());
    const [studentId, setStudentId] = useState<number | null>(null);
    const {hasNewMotivations, setHasNewMotivations} = useUserStore();

    async function fetchData(groupId: number, forceRefresh = false) {
        setLoading(true);

        const data = await fetchTimetable(groupId, selectedDate, forceRefresh);

        setTable(data);
    }

    async function fetchMotivations(id: number) {
        try {
            await fetchStudentMotivations(id).then((r) => {
                if (Array.isArray(r)) {
                    setMotivations(r.reverse());
                    mixpanel.track('Motivations fetched', {count: r.length});
                }
                setHasNewMotivations(false);
            });
        } catch (e) {
            captureException(e);
            mixpanel.track('Motivations fetch failed');
        }
    }

    useEffect(() => {
        async function prepare() {
            const group = await getSetting<Group>('group');

            if (group?.id) {
                setUserGroupId(group.id);
                await fetchData(group.id);
            }

            const studentId = await getSetting<number>('studentId');

            setUser({id: studentId?.toString()});

            if (studentId) {
                setStudentId(studentId);
                mixpanel.identify(String(studentId));
                await fetchMotivations(studentId);
            }

            setLoading(false);
            setAppIsReady(true);
        }

        prepare();
    }, []);

    useEffect(() => {
        if (hasNewMotivations && studentId) {
            fetchMotivations(studentId);
        }
    }, [hasNewMotivations]);

    useEffect(() => {
        if (!userGroupId) {
            return;
        }

        fetchData(userGroupId).then(() => {
            setLoading(false);
        });
    }, [selectedDate, userGroupId]);

    moment.locale(i18n.locale);

    const minDate = moment().subtract(1, 'month');
    const maxDate = moment().add(1, 'month');

    const datesWhitelist = [{
        start: minDate,
        end  : maxDate,
    }];

    // If user group is set and app is ready, track the event
    if (userGroupId && appIsReady) {
        mixpanel.track('Timetable viewed', {date: selectedDate.format('YYYY-MM-DD')});
    }


    return (
        !userGroupId && appIsReady ? <Redirect href="settings"/> :
            <>
                <Stack.Screen
                    options={{
                        // https://reactnavigation.org/docs/headers#setting-the-header-title
                        title: i18n.t('calendar'),
                        // https://reactnavigation.org/docs/headers#adjusting-header-styles
                        headerStyle     : {
                            backgroundColor: '#A41A34',
                        },
                        headerTintColor : '#fff',
                        headerTitleStyle: {
                            fontWeight: 'bold',
                        },
                        // https://reactnavigation.org/docs/headers#replacing-the-title-with-a-custom-component
                        headerTitle: props => <HeaderTitle {...props} />,
                    }}
                />
                {
                    appIsReady ?
                        <>
                            {motivations.length ? (
                                <View style={styles.motivationPagerClone}>
                                    {motivations.map((motivation, index) => (
                                        <View
                                            key={index}
                                            onLayout={(e) => {
                                                const maxHeight = Math.max(motivationPagerHeight, e.nativeEvent.layout.height + 30);
                                                setMotivationPagerHeights((prev) => new Map(prev.set(index, maxHeight)));
                                            }}
                                            style={{
                                                ...styles.motivationCard,
                                                position: 'absolute',
                                                width   : '90%',
                                            }}>
                                            {motivation.text ? (
                                                <>
                                                    <Text style={styles.motivationQuote}>“</Text>
                                                    <Text style={styles.motivationText}>{motivation.text}</Text>
                                                </>
                                            ) : null}
                                        </View>
                                    ))}
                                </View>
                            ) : null}
                            {motivations.length ? (
                                <PagerView
                                    style={{...styles.motivationPager, height: motivationPagerHeight}}
                                    initialPage={motivations?.length - 1}
                                    onPageSelected={(e) => {
                                        Haptics.selectionAsync();
                                        const height = motivationPagerHeights.get(e.nativeEvent.position);

                                        if (height) {
                                            setMotivationPagerHeight(height);
                                        }
                                        mixpanel.track('Motivation viewed', {text: motivations[e.nativeEvent.position].text});
                                    }}
                                >
                                    {motivations.map((motivation, index) => (
                                        <View key={index}>
                                            <View
                                                style={styles.motivationCard}>
                                                {motivation.text && (
                                                    <>
                                                        <Text style={styles.motivationQuote}>“</Text>
                                                        <Text style={styles.motivationText}>{motivation.text}</Text>
                                                    </>
                                                )}
                                            </View>
                                        </View>
                                    ))}
                                </PagerView>
                            ) : null}
                            <View style={styles.quickButtonsContainer}>
                                <TouchableOpacity onPress={() => {
                                    setSelectedDate(moment());
                                    mixpanel.track('Quick date selected', {date: 'today'});
                                }}>
                                    <Text style={styles.quickButtons}>{i18n.t('today')}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={() => {
                                    setSelectedDate(moment().add(1, 'day'));
                                    mixpanel.track('Quick date selected', {date: 'tomorrow'});
                                }}>
                                    <Text style={styles.quickButtons}>{i18n.t('tomorrow')}</Text>
                                </TouchableOpacity>
                            </View>
                            <View>
                                <CalendarStrip
                                    minDate={minDate}
                                    maxDate={maxDate}
                                    scrollable
                                    startingDate={moment()}
                                    selectedDate={selectedDate}
                                    onDateSelected={(date: moment.Moment) => {
                                        setSelectedDate(date);
                                        mixpanel.track('Date selected', {date: date.format('YYYY-MM-DD')});
                                    }}
                                    onWeekChanged={() => Haptics.selectionAsync()}
                                    style={styles.calendar}
                                    dateNumberStyle={{color: '#000'}}
                                    dateNameStyle={{color: '#000'}}
                                    highlightDateNumberStyle={{color: '#A41A34'}}
                                    highlightDateNameStyle={{color: '#A41A34'}}
                                    disabledDateNameStyle={{color: 'grey'}}
                                    disabledDateNumberStyle={{color: 'grey'}}
                                    datesWhitelist={datesWhitelist}
                                />
                            </View>
                            {
                                table.length ?
                                    <ScrollView
                                        style={styles.tableContainer}
                                        refreshControl={
                                            <RefreshControl
                                                refreshing={refreshing}
                                                progressViewOffset={0}
                                                onRefresh={async () => {
                                                    setRefreshing(true);

                                                    mixpanel.track('Timetable refreshed', {date: selectedDate.format('YYYY-MM-DD')});
                                                    if (userGroupId) {
                                                        await fetchData(userGroupId, true);
                                                    }

                                                    setRefreshing(false);
                                                }}/>
                                        }
                                    >
                                        <Table borderStyle={styles.tableBorder} style={styles.table}>
                                            {
                                                table.map((rowData, index) => {
                                                    const rowStyle = {backgroundColor: '#f2f2f2'};

                                                    if (rowData[2].toUpperCase().includes('(ЛАБ)')) {
                                                        rowStyle.backgroundColor = '#fcd9d8';
                                                    }

                                                    if (rowData[2].toUpperCase().includes('(ПР)')) {
                                                        rowStyle.backgroundColor = '#cef6fc';
                                                    }

                                                    if (rowData[2].toUpperCase().includes('(Л)')) {
                                                        rowStyle.backgroundColor = '#fefefe';
                                                    }

                                                    return (
                                                        <Row
                                                            key={index}
                                                            data={rowData}
                                                            style={rowStyle}
                                                            flexArr={[1, 3, 9]}
                                                            textStyle={{...styles.rowText, color: rowData[2].trim() === '' ? '#ccc' : '#333'}}
                                                        />
                                                    )
                                                })
                                            }
                                        </Table>
                                    </ScrollView> :
                                    loading ?
                                        <ActivityIndicator size="large" color="#A41A34" style={{marginTop: 122}}/> :
                                        <Text style={{textAlign: 'center', fontSize: 16, marginTop: 122}}>{i18n.t('no_data')}</Text>
                            }
                        </> : <ActivityIndicator size="large" color="#A41A34" style={{marginTop: 122}}/>
                }
            </>
    );
}

const styles = StyleSheet.create({
    headerTitle          : {
        // backgroundColor: '#fff',
        display       : 'flex',
        flexDirection : 'row',
        width         : '100%',
        alignItems    : 'center',
        justifyContent: 'space-between',
        marginLeft    : -20,
    },
    headerLabel          : {
        fontSize  : 20,
        fontWeight: 'bold',
        color     : 'white',
    },
    headerIconWrapper    : {
        alignItems  : 'center',
        justifyContent: 'center',
        padding    : 4,
    },
    headerIcon           : {
        color: 'white',
    },
    motivationPager      : {},
    motivationPagerClone : {
        position: 'absolute',
        top     : -1000,
        width   : '100%',
    },
    motivationCard       : {
        paddingHorizontal: 15,
        paddingVertical  : 10,
        backgroundColor  : '#eee898',
        borderRadius     : 10,
        margin           : 15,
        // minHeight        : 10,
        flexDirection: 'row',
        alignItems   : 'center',
        paddingRight : 35,
    },
    motivationQuote      : {
        color      : '#cdccbe',
        fontWeight : '600',
        fontSize   : 50,
        marginRight: 10,
    },
    motivationText       : {
        color     : '#373d3e',
        fontWeight: '500',
        fontSize  : 16,
        textAlign : 'center',
    },
    quickButtons         : {
        color        : '#A41A34',
        marginTop    : 15,
        fontWeight   : '600',
        textTransform: 'uppercase',
    },
    quickButtonsContainer: {
        paddingHorizontal: 15,
        flexDirection    : 'row',
        flexWrap         : 'wrap',
        justifyContent   : 'space-between',
    },
    calendar             : {
        height           : 150,
        paddingTop       : 20,
        paddingBottom    : 10,
        paddingHorizontal: 5,
    },
    tableContainer       : {
        paddingHorizontal: 15,
        flex             : 1,
    },
    tableBorder          : {
        borderWidth: 0.5,
        borderColor: '#afabac',

    },
    table                : {
        marginBottom: 40,
    },
    tableWrapper         : {
        flexDirection: 'row',
    },
    rowText              : {
        textAlign      : 'center',
        padding        : 6,
        backgroundColor: 'transparent',
    },
});
