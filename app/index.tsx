import { Redirect, Stack, router } from 'expo-router';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { i18n } from "../i18n";
import { JSXElementConstructor, ReactElement, ReactNode, ReactPortal, useEffect, useState } from "react";
import { fetchStudentMotivations, fetchTimetable, getSetting, Group, Motivation } from "../helpers";
import Entypo from "@expo/vector-icons/Entypo";
import Material from "@expo/vector-icons/MaterialIcons";
import CalendarStrip from 'react-native-calendar-strip';
import moment from 'moment/min/moment-with-locales';
import { Table, Row } from 'react-native-reanimated-table';

function HeaderTitle(props: {
    children: string | number | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | null | undefined;
}) {
    return <View style={styles.headerTitle}>
        <Material name="wb-sunny" size={20} style={styles.headerIcon} onPress={() => router.push('weather')}/>
        <Text style={styles.headerLabel}>{props.children}</Text>
        <Entypo name="cog" size={20} style={styles.headerIcon} onPress={() => router.push('settings')}/>
    </View>;
}

export default function IndexPage() {
    const [appIsReady, setAppIsReady] = useState<boolean>(false);
    const [selectedDate, setSelectedDate] = useState<moment.Moment>(moment());
    const [table, setTable] = useState<string[][]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [userGroupId, setUserGroupId] = useState<number | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [motivations, setMotivations] = useState<Motivation[]>();
    const [motivation, setMotivation] = useState<Motivation>();

    async function fetchData(groupId: number, forceRefresh = false) {
        setLoading(true);

        const data = await fetchTimetable(groupId, selectedDate, forceRefresh);

        setTable(data);
    }

    useEffect(() => {
        async function prepare() {
            const group = await getSetting<Group>('group');

            if (group?.id) {
                setUserGroupId(group.id);
                await fetchData(group.id);
            }

            const studentId = await getSetting<number>('studentId');

            if (studentId) {
                await fetchStudentMotivations(studentId).then((r) => {
                    setMotivations(r);

                    if (r.length) {
                        setMotivation(r[0]);
                    }
                });
            }

            setLoading(false);
            setAppIsReady(true);
        }

        prepare();
    }, []);

    useEffect(() => {
        if (!userGroupId) {
            return;
        }

        fetchData(userGroupId).then(() => {
            setLoading(false);
        });
    }, [selectedDate, userGroupId]);

    // if (!appIsReady) {
    //     return null;
    // }

    moment.locale(i18n.locale);

    const minDate = moment().subtract(1, 'month');
    const maxDate = moment().add(1, 'month');

    const datesWhitelist = [{
        start: minDate,
        end  : maxDate,
    }];


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
                            {motivation && (
                                <View style={styles.motivationCard}>
                                    {motivation.text && (
                                        <>
                                            <Text style={styles.motivationQuote}>“</Text>
                                            <Text style={styles.motivationText}>{motivation.text}</Text>
                                        </>
                                    )}
                                </View>
                            )}
                            <View style={styles.quickButtonsContainer}>
                                <TouchableOpacity onPress={() => {
                                    setSelectedDate(moment());
                                }}>
                                    <Text style={styles.quickButtons}>{i18n.t('today')}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={() => {
                                    setSelectedDate(moment().add(1, 'day'));
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
                                    onDateSelected={setSelectedDate}
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

                                                    if (userGroupId) {
                                                        await fetchData(userGroupId, true);
                                                    }

                                                    setRefreshing(false);
                                                }}/>
                                        }
                                    >
                                        <Table borderStyle={styles.table}>
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
    headerIcon           : {
        color: 'white',
        // position: 'absolute',
        // right   : 45,
    },
    motivationCard       : {
        paddingHorizontal: 15,
        paddingVertical  : 10,
        backgroundColor  : '#eee898',
        borderRadius     : 10,
        margin           : 15,
        minHeight        : 100,
        flexDirection    : 'row',
        alignItems       : 'center',
    },
    motivationQuote      : {
        color     : '#cdccbe',
        fontWeight: '600',
        fontSize  : 50,
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
    table                : {
        borderWidth: 0.5,
        borderColor: '#afabac',
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
