import React, { useEffect, useRef, useState } from 'react';
import Entypo from '@expo/vector-icons/Entypo';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { router, Stack, useNavigationContainerRef } from "expo-router";
import {useFonts, FiraSans_400Regular, FiraSans_600SemiBold} from '@expo-google-fonts/fira-sans';
import * as Notifications from "expo-notifications";
import {RootSiblingParent} from 'react-native-root-siblings';
import * as Sentry from "@sentry/react-native";
import * as Updates from 'expo-updates';
import { NotificationType } from "../helpers";
import { Subscription } from "expo-notifications";
import { useRouteInfo } from "expo-router/build/hooks";

const routingInstrumentation = new Sentry.ReactNavigationInstrumentation();
const manifest = Updates.manifest;
const metadata = 'metadata' in manifest ? manifest.metadata : undefined;
const extra = 'extra' in manifest ? manifest.extra : undefined;
const updateGroup = metadata && 'updateGroup' in metadata ? metadata.updateGroup : undefined;

Sentry.init({
    // debug: true,
    dsn: 'https://7e10351f65f9a2942d85ca8923cb59ac@o1078061.ingest.sentry.io/4506823558430720',
    integrations: [
        new Sentry.ReactNativeTracing({
            routingInstrumentation,
        }),
    ],
});

Sentry.configureScope(scope => {
    scope.setTag('expo-update-id', Updates.updateId);
    scope.setTag('expo-is-embedded-update', Updates.isEmbeddedLaunch);

    if (typeof updateGroup === 'string') {
        scope.setTag('expo-update-group-id', updateGroup);

        const owner = extra?.expoClient?.owner ?? '[account]';
        const slug = extra?.expoClient?.slug ?? '[project]';
        scope.setTag(
            'expo-update-debug-url',
            `https://expo.dev/accounts/${owner}/projects/${slug}/updates/${updateGroup}`
        );
    } else if (Updates.isEmbeddedLaunch) {
        // This will be `true` if the update is the one embedded in the build, and not one downloaded from the updates server.
        scope.setTag('expo-update-debug-url', 'not applicable for embedded updates');
    }
});

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function Layout() {
    // Capture the NavigationContainer ref and register it with the instrumentation.
    const ref = useNavigationContainerRef();
    const [appIsReady, setAppIsReady] = useState(false);
    const responseListener = useRef<Subscription>();
    const route = useRouteInfo();

    let [fontsLoaded, fontError] = useFonts({
        FiraSans_400Regular,
        FiraSans_600SemiBold,
    });

    useEffect(() => {
        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            console.log('Received motivation notification, navigating back to the home screen');
            console.log('Current route:', route.pathname)
            console.log('Notification data:', response.notification.request.content.data)
            if (response.notification.request.content.data.type === NotificationType.MOTIVATION && route.pathname !== '/') {
                if (router.canGoBack()) {
                    router.back();
                } else {
                    router.replace('/');
                }
                return;
            }
        });

        return () => {
            if (!responseListener.current) {
                return;
            }
            Notifications.removeNotificationSubscription(responseListener.current);
        };
    }, []);

    useEffect(() => {
        if (ref) {
            routingInstrumentation.registerNavigationContainer(ref);
        }
    }, [ref]);

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

// Wrap the Root Layout route component with `Sentry.wrap` to capture gesture info and profiling data.
export default Sentry.wrap(Layout);
