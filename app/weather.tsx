import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
    mixpanel,
    fetchWeather,
    getVisibilityColor,
    getWindColor,
    showErrorMessage,
    DayOfMonthForecasts,
    WeatherForecast, hPaToMmhg,
} from "../lib/helpers";
import PagerView from "react-native-pager-view";
import moment from 'moment/min/moment-with-locales';
import { i18n } from "../lib/i18n";
import { Image } from "expo-image";
import {
    getCurrentPositionAsync,
    requestForegroundPermissionsAsync,
    reverseGeocodeAsync,
    LocationGeocodedAddress,
} from "expo-location";
import * as Haptics from "expo-haptics";

const REFRESH_INTERVAL = 1000 * 60 * 60; // 1 hour

// noinspection JSUnusedGlobalSymbols
export default function WeatherPage() {
    const [loading, setLoading] = useState<boolean>(true);
    const [sixDayForecast, setSixDayForecast] = useState<DayOfMonthForecasts>();
    const [region, setRegion] = useState<LocationGeocodedAddress[]>();
    const [currentWeather, setCurrentWeather] = useState<WeatherForecast>();
    // const [weatherImage, setWeatherImage] = useState<string>('');

    moment.locale(i18n.locale);

    async function prepare() {
        setLoading(true);

        const {status} = await requestForegroundPermissionsAsync();

        if (status !== 'granted') {
            showErrorMessage('Permission to access location was denied');
            return;
        }

        const location = await getCurrentPositionAsync({});

        await reverseGeocodeAsync({
            latitude : location.coords.latitude,
            longitude: location.coords.longitude,
        }).then(setRegion);

        const forecast = await fetchWeather(location.coords.latitude, location.coords.longitude);

        setSixDayForecast(forecast.daily);
        setCurrentWeather(forecast.current);

        // const student = await getSetting<StudentSettingsDB>('student');
        // getWeatherImage(location.coords.latitude, location.coords.longitude, student?.id || 0)
        //     .then(s => setWeatherImage(s))
        //     .catch((e: any) => {
        //         setWeatherImage('');
        //         console.error(e);
        //         Sentry.captureException(e);
        //         mixpanel.track('Weather image fetch failed', {
        //             error: e,
        //             lat  : location.coords.latitude,
        //             long : location.coords.longitude,
        //         });
        //     });

        setLoading(false);
    }

    if (!loading) {
        setTimeout(prepare, REFRESH_INTERVAL);
    }

    useEffect(() => {
        prepare();
    }, []);

    if (region?.length) {
        mixpanel.people_set({
            city   : region[0].city,
            country: region[0].country,
        });
        mixpanel.track('Weather page viewed');
    }

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: i18n.t('weather.page_title'),
                }}
            />
            {loading ?
                <ActivityIndicator size="large" color="#A41A34" style={{marginTop: 122}}/>
                :
                <View style={styles.contentContainer}>
                    <Text style={styles.location}>
                        {region && region[0].city}, {region && region[0].country}
                    </Text>
                    {sixDayForecast && currentWeather && (
                        <PagerView style={styles.viewPager} initialPage={0} onPageSelected={({nativeEvent}) => {
                            Haptics.selectionAsync();
                            mixpanel.track('Weather page swiped', {
                                date: moment(sixDayForecast[nativeEvent.position][0].dt, 'X').format('YYYY-MM-DD'),
                            });
                        }}>
                            {sixDayForecast.filter(f => f.length).map((day, index) => (
                                <View key={index}>
                                    <Text style={styles.forecastDate}>
                                        {moment(day[0]?.dt, 'X').format('dddd, D MMMM')}
                                    </Text>
                                    {!index && <View style={styles.forecastCurrentWeather}>
                                        <View style={styles.forecastCurrentDetails}>
                                            <Text style={styles.forecastCurrentTemp}>
                                                {Math.round(currentWeather?.main.temp)}°C
                                            </Text>
                                            <Text style={styles.forecastCurrentDetail}>
                                                {i18n.t('weather.feels_like')}: {Math.round(currentWeather?.main.feels_like)}°C
                                            </Text>
                                        </View>
                                        <View style={styles.forecastCurrentDetails}>
                                            <Image
                                                style={{width: 90, height: 60}}
                                                source={{uri: `https://openweathermap.org/img/wn/${currentWeather?.weather[0].icon}@2x.png`}}
                                            />
                                            <Text style={{...styles.forecastCurrentDetail, textAlign: 'center'}}>
                                                {currentWeather?.weather[0].description}
                                            </Text>
                                        </View>
                                        <View style={{...styles.forecastCurrentDetails, gap: 5, marginTop: 23}}>
                                            <Text style={styles.forecastCurrentDetail}>
                                                {i18n.t('weather.humidity')}: {currentWeather?.main.humidity}%
                                            </Text>
                                            <Text style={{...styles.forecastCurrentDetail, color: getWindColor(currentWeather?.wind.speed)}}>
                                                {i18n.t('weather.wind')}: <Text style={{color: getWindColor(currentWeather?.wind.speed)}}>{currentWeather?.wind.speed} м/с</Text>
                                            </Text>
                                            <Text style={{...styles.forecastCurrentDetail, color: getVisibilityColor(currentWeather?.visibility)}}>
                                                {i18n.t('weather.visibility')}: <Text
                                                style={{color: getVisibilityColor(currentWeather?.visibility)}}>{currentWeather?.visibility} м</Text>
                                            </Text>
                                            <Text style={styles.forecastCurrentDetail}>
                                                {i18n.t('weather.pressure')}: {hPaToMmhg(currentWeather?.main.pressure)} {i18n.t('weather.pressure_mmhg')}
                                            </Text>
                                        </View>
                                    </View>}
                                    {/*{weatherImage ? <View>*/}
                                    {/*    <Text>{weatherImage}</Text>*/}
                                    {/*    <Image*/}
                                    {/*        style={styles.weatherImage}*/}
                                    {/*        source={{uri: weatherImage}}*/}
                                    {/*    />*/}
                                    {/*</View>: null}*/}
                                    <ScrollView>
                                        <View style={{...styles.forecastItems, marginTop: index ? 40 : 20}}>
                                            {day.map((item, index) => (
                                                <View style={styles.forecastItem} key={index}>
                                                    <View style={styles.forecastDateWrapper}>
                                                        <Text style={styles.forecastItemTime}>
                                                            {moment(item.dt, 'X').format('HH:mm')}
                                                        </Text>
                                                        <Text style={{...styles.forecastCurrentDetail, fontSize: 26}}>
                                                            {Math.round(item.main.temp)}°C
                                                        </Text>
                                                    </View>
                                                    <View style={styles.forecastItemIcon}>
                                                        <Image
                                                            style={{width: 80, height: 40}}
                                                            source={{uri: `https://openweathermap.org/img/wn/${item.weather[0].icon}@2x.png`}}
                                                        />
                                                        <Text style={styles.forecastItemIconLabel}>
                                                            {item.weather[0].description}
                                                        </Text>
                                                    </View>

                                                    <View style={styles.forecastItemWeather}>
                                                        <Text style={styles.forecastCurrentDetail}>
                                                            {i18n.t('weather.feels_like')}: {Math.round(item.main.feels_like)}°C
                                                        </Text>
                                                        <Text style={styles.forecastCurrentDetail}>
                                                            {i18n.t('weather.humidity')}: {item.main.humidity}%
                                                        </Text>
                                                        <Text style={styles.forecastCurrentDetail}>
                                                            {i18n.t('weather.wind')}: <Text style={{color: getWindColor(item.wind.speed)}}>{item.wind.speed} м/с</Text>
                                                        </Text>
                                                        <Text style={styles.forecastCurrentDetail}>
                                                            {i18n.t('weather.visibility')}: <Text
                                                            style={{color: getVisibilityColor(item.visibility || 0)}}>{item.visibility || 0} м</Text>
                                                        </Text>
                                                        <Text style={styles.forecastCurrentDetail}>
                                                            {i18n.t('weather.pressure')}: {hPaToMmhg(item?.main.pressure)} {i18n.t('weather.pressure_mmhg')}
                                                        </Text>
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    </ScrollView>
                                </View>
                            ))}
                        </PagerView>
                    )}
                </View>
            }
        </View>
    );
}

const styles = StyleSheet.create({
    container             : {
        flex: 1,
    },
    contentContainer      : {
        flex           : 1,
        backgroundColor: '#12142c',
    },
    location              : {
        color        : '#eee',
        fontSize     : 22,
        fontWeight   : 'bold',
        textAlign    : 'center',
        width        : '100%',
        marginTop    : 20,
        textTransform: 'uppercase',
    },
    viewPager             : {
        flex: 1,
    },
    forecastDateWrapper   : {
        alignItems    : 'center',
        justifyContent: 'center',
        gap           : 5,
    },
    forecastDate          : {
        color        : '#a6a6a6',
        fontSize     : 18,
        textAlign    : 'center',
        width        : '100%',
        marginTop    : 10,
        textTransform: 'capitalize',
    },
    forecastCurrentWeather: {
        flexDirection : 'row',
        gap           : 15,
        justifyContent: 'center',
        alignItems    : 'center',
        marginVertical: 20,
    },
    forecastCurrentTemp   : {
        fontSize     : 42,
        marginTop    : 10,
        color        : '#eee',
        textTransform: 'uppercase',
        textAlign    : 'center',
    },
    forecastCurrentDetails: {
        marginTop: 10,
        gap      : 2,
    },
    forecastCurrentDetail : {
        fontSize     : 10,
        color        : '#cfcfcf',
        textTransform: 'uppercase',
    },
    weatherImage: {
        marginVertical: 10,
        marginHorizontal: '10%',
        width: 'auto',
        height: 300,
    },
    forecastItems         : {
        marginBottom    : 40,
        marginHorizontal: 30,
        gap             : 7,
    },
    forecastItem          : {
        backgroundColor: 'rgba(200,200,200,0.1)',
        borderRadius   : 5,
        flexDirection  : 'row',
        padding        : 10,
    },
    forecastItemTime      : {
        alignSelf        : 'center',
        paddingHorizontal: 10,
        width            : 100,
        color            : '#999',
        fontWeight       : 'bold',
        fontSize         : 14,
        textAlign        : 'center',
    },
    forecastItemIcon      : {
        alignItems    : 'center',
        justifyContent: 'center',
        width         : 120,
        gap           : 7,
    },
    forecastItemIconLabel : {
        color        : '#cfcfcf',
        fontSize     : 8,
        textTransform: 'uppercase',
    },
    forecastItemWeather   : {
        justifyContent: 'center',
        gap           : 5,
    }
})
