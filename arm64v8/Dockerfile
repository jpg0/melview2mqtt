FROM arm64v8/node:19-alpine

ENV MQTT_SERVER=mqtt://127.0.0.1:1883

WORKDIR /app

COPY ./* ./

RUN npm install

RUN chmod a+rw run_melview2mqtt.sh

RUN adduser --gecos "" --disabled-password mqtt
USER mqtt

ENTRYPOINT ["sh", "./run_melview2mqtt.sh"]
