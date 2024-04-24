import { Button, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from "react-native";
import { i18n } from "../lib/i18n";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { createRef, useEffect, useRef, useState } from "react";
import { API_URL, APP_API_TOKEN, HttpResponse, mixpanel, setSetting, showErrorMessage, showSuccessMessage, useUserStore } from "../lib/helpers";

const CONFIRMATION_CODE_DIGITS = 6;

// noinspection JSUnusedGlobalSymbols
export default function EmailConfirmationPage() {
    const {email, onConfirmSuccess} = useLocalSearchParams<{ email: string, onConfirmSuccess: any }>();
    const [error, setError] = useState<boolean>(false);
    const [code, setCode] = useState('');
    const { setEmailConfirmed } = useUserStore();
    const refs = useRef([
        createRef<TextInput>(),
        createRef<TextInput>(),
        createRef<TextInput>(),
        createRef<TextInput>(),
        createRef<TextInput>(),
        createRef<TextInput>(),
    ]);

    useEffect(() => {
        refs.current = refs.current
            .slice(0, CONFIRMATION_CODE_DIGITS)
            .map((_, index) => refs.current[index] || createRef());
    }, []);

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <Stack.Screen
                options={{
                    title: i18n.t('email_confirmation'),
                }}
            />
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.contentContainer}>
                    <View style={styles.contentContainer}>
                        <Text style={styles.label}>
                            {i18n.t('we_have_sent_you_an_email_with_a_confirmation_code')}
                        </Text>
                        <TextInput
                            style={styles.hiddenInput}
                            autoFocus={true}
                            keyboardType={'number-pad'}
                            textContentType={'oneTimeCode'}
                            onChangeText={(text) => {
                                // In case of pasting the code,
                                if (text.length === CONFIRMATION_CODE_DIGITS) {
                                    setCode(text);
                                    refs.current[CONFIRMATION_CODE_DIGITS - 1].current?.focus();

                                    return;
                                }

                                setCode(text);
                                refs.current[1].current?.focus();
                            }}
                        />
                        <View style={styles.inputContainer}>
                            {[...Array(CONFIRMATION_CODE_DIGITS)].map((_, index) => (
                                <TextInput
                                    ref={refs.current[index]}
                                    key={index}
                                    style={{
                                        ...styles.input,
                                        borderColor: (code[index] ?
                                                'green' :
                                                (
                                                    error ?
                                                        'red' :
                                                        'gray'
                                                )
                                        ),
                                    }}
                                    value={code[index]}
                                    keyboardType="number-pad"
                                    maxLength={1}
                                    placeholder={i18n.t('x')}
                                    placeholderTextColor="#ccc"
                                    returnKeyType="next"
                                    caretHidden={true}
                                    onChangeText={(text) => {
                                        setError(false);

                                        setCode((prev) => {
                                            const newCode = prev.split('');
                                            newCode[index] = text;
                                            return newCode.join('');
                                        });

                                        if (text) {
                                            if (index < CONFIRMATION_CODE_DIGITS - 1) {
                                                refs.current[index + 1].current?.focus();
                                            } else {
                                                Keyboard.dismiss();
                                            }
                                        }
                                    }}
                                    onKeyPress={({nativeEvent}) => {
                                        if (nativeEvent.key === 'Backspace' && !code[index]) {
                                            if (index > 0) {
                                                refs.current[index - 1].current?.focus();

                                                setCode((prev) => {
                                                    const newCode = prev.split('');
                                                    newCode[index - 1] = '';
                                                    return newCode.join('');
                                                });
                                            }
                                        }
                                    }}
                                />
                            ))}
                        </View>
                        <Button
                            title={i18n.t('confirm_email_code')}
                            disabled={code.length < CONFIRMATION_CODE_DIGITS}
                            onPress={async () => {
                                const payload = {
                                    email,
                                    code,
                                };

                                try {
                                    await fetch(`${API_URL}/students/confirm-email`, {
                                        method : 'POST',
                                        headers: {
                                            'Content-Type' : 'application/json',
                                            'Authorization': `Bearer ${APP_API_TOKEN}`,
                                        },
                                        body   : JSON.stringify(payload),
                                    })
                                        .then(response => response.json() as Promise<HttpResponse>)
                                        .then(response => {
                                            if ('message' in response) {
                                                const message = Array.isArray(response.message) ?
                                                    response.message.map((message: string) => i18n.t(`errors.${message}`)) :
                                                    [i18n.t(`errors.${response.message}`)];
                                                throw new Error(message.join('\n'));
                                            }
                                        });

                                    await setSetting('emailConfirmed', true);

                                    showSuccessMessage(i18n.t('email_confirmed_successfully'));

                                    setEmailConfirmed(true);

                                    mixpanel.track('Email Confirmed');

                                    if (router.canGoBack()) {
                                        router.back();
                                    } else {
                                        router.replace('/');
                                    }
                                } catch (e: any) {
                                    setCode('');
                                    refs.current[0].current?.focus();
                                    setError(true);
                                    showErrorMessage(e.message);
                                }
                            }}
                        />
                    </View>
                </View>
            </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container       : {
        flex: 1,
    },
    contentContainer: {
        flex          : 1,
        justifyContent: 'center',
        alignItems    : 'center',
    },
    hiddenInput    : {
        position: 'absolute',
        backgroundColor: 'transparent',
        top     : -100,
        left    : -100,
        fontSize: 1,
        padding : 0,
        margin  : 0,
    },
    inputContainer  : {
        flexDirection : 'row',
        gap           : 8,
        marginVertical: 20,
    },
    input           : {
        height           : 50,
        width            : 50,
        textAlign        : 'center',
        fontSize         : 28,
        borderColor      : 'gray',
        borderWidth      : 1,
        borderRadius     : 3,
        paddingHorizontal: 8,
    },
    label           : {
        marginHorizontal: 8,
        marginTop       : 20,
        marginBottom    : 8,
        fontSize        : 16,
    },
})
