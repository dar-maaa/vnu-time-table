import React, {useEffect, useState} from 'react';
import Entypo from '@expo/vector-icons/Entypo';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import {Stack} from "expo-router";
import {useFonts, FiraSans_400Regular, FiraSans_600SemiBold} from '@expo-google-fonts/fira-sans';
import * as Notifications from "expo-notifications";
import {RootSiblingParent} from 'react-native-root-siblings';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

// todo: Async storage for storing data https://react-native-async-storage.github.io/async-storage/docs/usage/

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function Layout() {
    const [appIsReady, setAppIsReady] = useState(false);

    let [fontsLoaded, fontError] = useFonts({
        FiraSans_400Regular,
        FiraSans_600SemiBold,
    });

    useEffect(() => {
        async function prepare() {
            try {
                // Preload fonts, make any API calls you need to do here
                await Font.loadAsync(Entypo.font);

                // Artificially delay for two seconds to simulate a slow loading
                // experience. Please remove this if you copy and paste the code!
                // await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (e) {
                console.warn(e);
            } finally {
                // Tell the application to render
                setAppIsReady(true);
            }
        }

        prepare();
    }, []);


    useEffect(() => {
        if ((fontsLoaded || fontError) && appIsReady) {
            // Hide the splash screen after the fonts have loaded (or an error was returned) and the UI is ready.
            SplashScreen.hideAsync();
        }
    }, [fontsLoaded, fontError, appIsReady]);

    // Prevent rendering until the font has loaded or an error was returned
    if (!fontsLoaded || fontError || !appIsReady) {
        return null;
    }

    return (
        <RootSiblingParent>
            <Stack
                // https://reactnavigation.org/docs/headers#sharing-common-options-across-screens
                screenOptions={{
                    headerStyle: {
                        backgroundColor: '#A41A34',
                    },
                    headerTintColor: '#fff',
                    headerTitleStyle: {
                        fontWeight: 'bold',
                    },
                }}
            >
                {/* Optionally configure static options outside the route. */}
                <Stack.Screen name="index" options={{}}/>
            </Stack>
        </RootSiblingParent>
    );
}
