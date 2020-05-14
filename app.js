'use strict'

const winston = require('winston');
const mqtt = require('mqtt')
const { Melview } = require('./melview');

const MQTT_TOPIC = "/hvac/melview"
const MQTT_STATE_TOPIC = "/stat" + MQTT_TOPIC
const MQTT_COMMAND_TOPIC = "/cmnd" + MQTT_TOPIC

const argv = require('yargs')
    .env()
    .option('mqtt', {
        alias: 'm',
        type: 'string',
        description: 'MQTT URL'
    })
    .option('email', {
        alias: 'e',
        type: 'string',
        description: 'Username (email address) to connect to melview API'
    })
    .option('password', {
        alias: 'p',
        type: 'string',
        description: 'Password to connect to melview API'
    })
    .option('polltime', {
        alias: 't',
        type: 'number',
        description: 'Time in seconds between each poll for status'
    })
    .option('logLevel', {
        alias: 'l',
        type: 'string',
        description: 'Logging level (debug/info/warn/error)'
    })
    .default('logLevel', 'info')
    .default('polltime', '300')
    .demandOption(['mqtt', 'email', 'password'])
    .argv;


const pollTime = argv.polltime * 1000;

let melview = new Melview(argv.email, argv.password);

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.splat(),
        winston.format.simple()
    ),
    transports: [
        new winston.transports.Console()
    ]
});


//todo detect connection failures
let mqttClient = mqtt.connect(argv.mqtt)
mqttClient.on('error', function (error) {
    logger.error("Error from mqtt broker: %v", error)
});
mqttClient.on('connect', function (connack) {
    logger.info("Connected to mqtt broker")
});

let writeStatusToMqtt = () => {
    melview.buildings().then(buildings => buildings.forEach(building => {
        building.rooms.forEach(room => {
            room.dump();
            ["mode", "power", "ambientTemperature", "targetTemperature"].forEach(prop => {
                mqttClient.publish(`${MQTT_STATE_TOPIC}/building/${building.id}/room/${room.id}/${prop}`, room[prop].toString());
            })
        })
    })).catch(logger.error)

    setTimeout(writeStatusToMqtt, pollTime);
}

let runMqtt2Melview = () => {
    mqttClient.subscribe(MQTT_COMMAND_TOPIC + "/#")

    mqttClient.on('message', function (topic, message) {
        let [,,buildingId,,roomId,feature] = topic.slice(MQTT_COMMAND_TOPIC.length).split('/');

        melview.buildings()
            .then(buildings => {
                let room = buildings.filter(building => building.id == buildingId)
                .rooms().filter(room => room.id == roomId)

                switch(feature) {
                    case 'POWER':
                        return room.setPower(Power.enumValueOf(message));
                    case 'MODE':
                        return room.setMode(Mode.enumValueOf(message));
                    case 'FANSP':
                        return room.setFanSpeed(FanSpeed.enumValueOf(message));
                    case 'TEMP':
                        return room.setTemperature(message);
                    default:
                        throw `Unknown operation ${feature}`

            }})
            .catch(logger.error)
    })
}

writeStatusToMqtt();
runMqtt2Melview();