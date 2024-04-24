import { Platform, Dimensions } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getItemAsync, setItemAsync } from "expo-secure-store";
import Constants from "expo-constants";
import { brand, modelName } from "expo-device";
import { runtimeVersion } from 'expo-updates';
import { getAndroidId, getIosIdForVendorAsync } from "expo-application";
import { Buffer } from "buffer";
import uuid from "uuid";

const MIXPANEL_API_URL = "https://api.mixpanel.com";

enum READY_STEP {
    DEVICE_ID = 1,
    USER_AGENT = 2,
    SUPER_PROPS = 3
}

export type UserProps = {
    [key: string]: any;
    $token: string;
    $distinct_id: string;
}

export type MixpanelProps = {
    [key: string]: any;
}

export type MixpanelEvent = {
    name: string;
    props?: MixpanelProps;
    sent?: boolean;
}

/**
 * @class ExpoMixpanelAnalytics
 * @description Mixpanel analytics for Expo apps
 * @example
 * const mixpanel = new ExpoMixpanelAnalytics("YOUR_MIXPAENL_TOKEN");
 * mixpanel.identify("13793");
 * // super props sent on every request and persisted in AsyncStorage
 * mixpanel.register({
 *  email: "bob@bob.com",
 * });
 * mixpanel.track("Signed Up", {
 *   "Referred By": "Friend",
 * });
 * mixpanel.people_set({
 *   "$first_name": "Joe",
 *   "$last_name": "Doe",
 *   "$email": "joe.doe@example.com",
 *   "$created": "2013-04-01T13:20:00",
 *   "$phone": "4805551212",
 *   "Address": "1313 Mockingbird Lane",
 *   "Birthday": "1948-01-01",
 * });
 * mixpanel.people_set_once({
 *   "First login date": "2013-04-01T13:20:00",
 * });
 * mixpanel.people_unset([
 *   "Days Overdue",
 * ]);
 * mixpanel.people_increment({
 *   "Coins Gathered": 12,
 * });
 * mixpanel.people_append({
 *   "Power Ups": "Bubble Lead",
 * });
 * mixpanel.people_union({
 *   "Items purchased": [
 *     "socks",
 *     "shirts"
 *   ],
 * });
 * mixpanel.people_delete_user();
 * mixpanel.reset();
 *
 */
export class ExpoMixpanelAnalytics {
    private readonly platform = Platform.OS;

    private readonly model = modelName || undefined;

    private readonly osVersion = Platform.Version;

    private readonly appName = Constants.expoConfig?.name;

    private readonly appId = Constants.expoConfig?.slug;

    private readonly appVersion = runtimeVersion || Constants.expoConfig?.version || undefined;

    private readonly appBuildNumber = runtimeVersion ?? undefined;

    private readonly deviceName = Constants.deviceName;

    private readonly expoAppOwnership = Constants.appOwnership ?? undefined;

    private readonly brand = brand || undefined;

    private readySteps = new Set<READY_STEP>();

    private userId?: string | null = null;

    private clientId?: string;

    private userAgent?: string | null;

    private queue: MixpanelEvent[] = [];

    private superProps: any = {};

    private screenSize?: string;

    private screenWidth?: number;

    private screenHeight?: number;

    constructor(private readonly token: string, private readonly storageKey = "mixpanel:super:props") {
        this.deviceName = Constants.deviceName;

        this.getDeviceId().then(deviceId => {
            this.clientId = Constants.deviceId || deviceId;
            this.identify(this.clientId);
            this.setReadyStep(READY_STEP.DEVICE_ID);
        });

        Constants.getWebViewUserAgentAsync().then(userAgent => {
            const {width, height} = Dimensions.get("window");

            this.userAgent = userAgent;
            this.screenSize = `${width}x${height}`;
            this.screenWidth = width;
            this.screenHeight = height;

            this.setReadyStep(READY_STEP.USER_AGENT);
        });

        AsyncStorage.getItem(this.storageKey, (_, result) => {
            if (result) {
                try {
                    this.superProps = JSON.parse(result) || {};
                } catch {
                }
            }

            this.setReadyStep(READY_STEP.SUPER_PROPS);
            this._flush();
        });
    }

    private setReadyStep(step: READY_STEP) {
        this.readySteps.add(step);

        this._flush();
    }

    private async getDeviceId() {
        const newUniqueId = Platform.OS === 'android'
            ? getAndroidId() ?? uuid.v4().toString()
            : await getIosIdForVendorAsync() ?? uuid.v4().toString();

        let uniqueId = null;

        try {
            uniqueId = await getItemAsync('uniqueId');
        } catch (error) {
            console.warn('Error getting uniqueId from SecureStore', error);
        }

        try {
            if (!uniqueId) {
                uniqueId = newUniqueId;
                await setItemAsync('uniqueId', uniqueId);
            }
        } catch (error) {
            uniqueId = newUniqueId;
            console.warn('Error saving uniqueId to SecureStore', error);
        }

        return uniqueId;
    }

    public register(props: MixpanelProps) {
        this.superProps = props;
        try {
            AsyncStorage.setItem(this.storageKey, JSON.stringify(props));
        } catch {
        }
    }

    public track(name: string, props?: MixpanelProps) {
        this.queue.push({
            name,
            props
        });
        this._flush();
    }

    public identify(userId?: string) {
        this.userId = userId;
    }

    public reset() {
        this.identify(this.clientId);
        try {
            AsyncStorage.setItem(this.storageKey, JSON.stringify({}));
        } catch {
        }
    }

    public people_set(props: MixpanelProps) {
        this._people("set", props);
    }

    public people_set_once(props: MixpanelProps) {
        this._people("set_once", props);
    }

    public people_unset(props: MixpanelProps) {
        this._people("unset", props);
    }

    public people_increment(props: MixpanelProps) {
        this._people("add", props);
    }

    public people_append(props: MixpanelProps) {
        this._people("append", props);
    }

    public people_union(props: MixpanelProps) {
        this._people("union", props);
    }

    public people_delete_user() {
        this._people("delete", null);
    }

    // ===========================================================================================

    private _flush() {
        if (this.readySteps.size === 3) {
            while (this.queue.length) {
                const event = this.queue.pop();

                if (event && !event?.sent) {
                    this._pushEvent(event).then(() => (event.sent = true));
                }
            }
        }
    }

    private _people(operation: string, props: MixpanelProps | null) {
        if (this.userId) {
            const data = {
                $token      : this.token,
                $distinct_id: this.userId
            } as UserProps;

            data[`$${operation}`] = props || "";

            this._pushProfile(data);
        }
    }

    private _pushEvent(event: MixpanelEvent) {
        let data = {
            event     : event.name,
            properties: {
                ...(event.props || {}),
                ...this.superProps,
                token           : this.token,
                user_agent      : this.userAgent,
                app_name        : this.appName,
                app_id          : this.appId,
                app_version     : this.appVersion,
                screen_size     : this.screenSize,
                client_id       : this.clientId,
                device_name     : this.deviceName,
                os_version      : this.osVersion,
                brand           : this.brand,
                app_ownership   : this.expoAppOwnership,
                app_build_number: this.appBuildNumber,
                screen_width    : this.screenWidth,
                screen_height   : this.screenHeight,
            }
        };

        if (this.userId) {
            data.properties.distinct_id = this.userId;
        }

        if (this.platform) {
            data.properties.platform = this.platform;
        }

        if (this.model) {
            data.properties.model = this.model;
        }

        const buffer = new Buffer(JSON.stringify(data)).toString("base64");

        return fetch(`${MIXPANEL_API_URL}/track/?data=${buffer}`);
    }

    _pushProfile(props: UserProps) {
        const data = Buffer.from(JSON.stringify(props)).toString("base64");

        return fetch(`${MIXPANEL_API_URL}/engage/?data=${data}`);
    }
}

export default ExpoMixpanelAnalytics;
