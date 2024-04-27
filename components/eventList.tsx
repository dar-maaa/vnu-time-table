import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { fetchEvents, mixpanel } from "../lib/helpers";
import { useEffect, useState } from "react";
import { Event } from "../lib/helpers";
import { Image } from "expo-image";
import moment from 'moment/min/moment-with-locales';
import { i18n } from "../lib/i18n";

export default function EventList() {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);

    moment.locale(i18n.locale);

    useEffect(() => {
        mixpanel.track('EventList');

        fetchEvents().then((events) => {
            setEvents(events);
            setLoading(false);
        });
    }, []);

    const EventItem = ({event}: { event: Event }) => (
        <View style={styles.event}>
            <View>
                <Image source={{uri: event.imageUrl}} style={styles.image}/>
            </View>
            <View style={styles.info}>
                <View>
                    <Text style={styles.date}>{moment(event.date, 'DD.MM.YYYY H:mm').format('DD MMMM YYYY H:mm, ddd')}</Text>
                    <Text style={styles.name}>{event.name}</Text>
                </View>
                <View>
                    <Text>{event.city}, {event.venue}</Text>
                </View>
            </View>
        </View>
    );

    return (

        <ScrollView>
            {
                loading ?
                    <ActivityIndicator size="large" color="#464C55" style={{marginTop: 122}}/>
                    :
                    <View style={styles.container}>
                        {events.length === 0 && <Text style={styles.noEvents}>{i18n.t('no_events')}</Text>}
                        {events.map((event) => (
                            <EventItem event={event} key={event.id}/>
                        ))}
                    </View>
            }
        </ScrollView>

    );
}

const styles = StyleSheet.create({
    container: {
        width       : '100%',
        padding     : 10,
        gap         : 10,
        marginBottom: 20,
    },
    noEvents: {
        textAlign: 'center',
        fontSize : 16,
        color    : '#666',
        alignSelf : 'center',
        marginTop : 50,
    },
    event    : {
        flexDirection: 'row',
        gap          : 10,
        borderStyle  : 'solid',
        borderWidth  : 1,
        borderColor  : '#ddd',
        borderRadius : 7,
        overflow     : 'hidden',
    },
    image    : {
        minWidth   : 120,
        height     : undefined,
        width      : undefined,
        flex       : 1,
        aspectRatio: 1,
    },
    info     : {
        flex           : 1,
        justifyContent : 'space-between',
        paddingVertical: 10,
    },
    date     : {
        fontSize: 12,
        color   : '#666',
    },
    name     : {
        marginTop : 5,
        fontSize  : 16,
        fontWeight: 'bold',
    },
});

