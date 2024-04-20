import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { buildForecastUrl, DayOfMonthForecasts, getVisibilityColor, getWindColor, partitionForecastsByDay, showErrorMessage, WeatherForecast, WeatherResponse } from "../helpers";
import PagerView from "react-native-pager-view";
import moment from 'moment/min/moment-with-locales';
import { i18n } from "../i18n";
import { Image } from "expo-image";
import * as Location from 'expo-location';

const REFRESH_INTERVAL = 1000 * 60 * 60; // 1 hour

// noinspection JSUnusedGlobalSymbols
export default function WeatherPage() {
    const [sixDayForecast, setSixDayForecast] = useState<DayOfMonthForecasts>();
    const [region, setRegion] = useState<Location.LocationGeocodedAddress[]>();
    const [currentWeather, setCurrentWeather] = useState<WeatherForecast>();

    moment.locale(i18n.locale);

    useEffect(() => {
        async function prepare() {
            const {status} = await Location.requestForegroundPermissionsAsync();

            if (status !== 'granted') {
                showErrorMessage('Permission to access location was denied');
                return;
            }

            const location = await Location.getCurrentPositionAsync({});

            await Location.reverseGeocodeAsync({
                latitude : location.coords.latitude,
                longitude: location.coords.longitude,
            }).then(setRegion);

            const forecastUrl = buildForecastUrl(location.coords.latitude, location.coords.longitude);
            const forecast = await fetch(forecastUrl).then(response => response.json()) as WeatherResponse;
            const dailyForecast = partitionForecastsByDay(forecast);

            setSixDayForecast(dailyForecast);
            setCurrentWeather(dailyForecast[0][0]);
            console.log(JSON.stringify(forecast, null, 2));
        }

        prepare();

        setTimeout(prepare, REFRESH_INTERVAL);

    }, []);

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: i18n.t('weather.page_title'),
                }}
            />
            <View style={styles.contentContainer}>
                <Text style={styles.location}>
                    {region && region[0].city}, {region && region[0].country}
                </Text>
                {sixDayForecast && currentWeather && (
                    <PagerView style={styles.viewPager} initialPage={0}>
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
                                    <View style={{...styles.forecastCurrentDetails, gap: 5, marginTop: 38}}>
                                        <Text style={styles.forecastCurrentDetail}>
                                            {i18n.t('weather.humidity')}: {currentWeather?.main.humidity}%
                                        </Text>
                                        <Text style={{...styles.forecastCurrentDetail, color: getWindColor(currentWeather?.wind.speed)}}>
                                            {i18n.t('weather.wind')}: <Text style={{color: getWindColor(currentWeather?.wind.speed)}}>{currentWeather?.wind.speed} м/с</Text>
                                        </Text>
                                        <Text style={{...styles.forecastCurrentDetail, color: getVisibilityColor(currentWeather?.visibility)}}>
                                            {i18n.t('weather.visibility')}: <Text style={{color: getVisibilityColor(currentWeather?.visibility)}}>{currentWeather?.visibility} м</Text>
                                        </Text>
                                    </View>
                                </View>}
                                <ScrollView>
                                    <View style={{...styles.forecastItems, marginTop: index ? 40 : 20}}>
                                        {day.map((item, index) => (
                                            <View style={styles.forecastItem} key={index}>
                                                <Text style={styles.forecastItemTime}>
                                                    {moment(item.dt, 'X').format('HH:mm')}
                                                </Text>
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
                                                        {i18n.t('weather.humidity')}: {item.main.humidity}%
                                                    </Text>
                                                    <Text style={styles.forecastCurrentDetail}>
                                                        {i18n.t('weather.wind')}: <Text style={{color: getWindColor(item.wind.speed)}}>{item.wind.speed} м/с</Text>
                                                    </Text>
                                                    <Text style={styles.forecastCurrentDetail}>
                                                        {i18n.t('weather.visibility')}: <Text style={{color: getVisibilityColor(item.visibility)}}>{item.visibility} м</Text>
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
        </View>
    );
}

const styles = StyleSheet.create({
    container             : {
        flex: 1,
    },
    contentContainer      : {
        flex: 1,
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
        fontSize         : 20,
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
