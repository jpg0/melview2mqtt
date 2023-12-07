#!/bin/sh

echo "Using server ${MQTT_SERVER}"

ARGS=""

if ! [ "${EMAIL}" = "" ]
then
    ARGS="${ARGS} --email ${EMAIL}"
    echo "Login email is ${EMAIL}"
else
    echo "No login email specified."
fi

if ! [ "${PASSWORD}" = "" ]
then
    ARGS="${ARGS} --password ${PASSWORD}"
    echo "Login password accepted."
else
    echo "No login password specified."
fi

if ! [ "${POLLTIME}" = "" ]
then
    ARGS="${ARGS} --polltime ${POLLTIME}"
    echo "Poll time spevified as ${POLLTIME}"
else
    echo "Using default Poll time."
fi

ARGS="${ARGS} --mqtt ${MQTT_SERVER}"

if ! [ "${MQTT_USER}" = "" ]
then
    ARGS="${ARGS} --mqttuser ${MQTT_USER}"
fi
if ! [ "${MQTT_PASS}" = "" ]
then
    ARGS="${ARGS} --mqttpass ${MQTT_PASS}"
fi

while node app.js $ARGS; do
    echo "MELVIEW2MQTT failed, restarting..."
done
