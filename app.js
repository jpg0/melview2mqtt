'use strict'

const winston = require('winston');
const mqtt = require('mqtt')
const { Melview, Power, Mode, FanSpeed } = require('./melview');

const MQTT_TOPIC = "/hvac/melview"
const MQTT_STATE_TOPIC = "stat" + MQTT_TOPIC
const MQTT_COMMAND_TOPIC = "cmnd" + MQTT_TOPIC

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
        building.units.forEach(unit => {
            ["mode", "power", "fanSpeed", "ambientTemperature", "targetTemperature"].forEach(prop => {
                mqttClient.publish(`${MQTT_STATE_TOPIC}/building/${building.id}/unit/${unit.id}/${prop}`, unit[prop].toString());
            })
        })
    })).catch(logger.error)
}

let writeStatusToMqttLoop = () => {
    writeStatusToMqtt();
    setTimeout(writeStatusToMqttLoop, pollTime);
}

let runMqtt2Melview = () => {
    mqttClient.subscribe(MQTT_COMMAND_TOPIC + "/#")

    mqttClient.on('message', function (topic, message) {

        logger.debug("Received MQTT message on topic: " + topic);

        let [,,buildingId,,unitId,feature] = topic.slice(MQTT_COMMAND_TOPIC.length).split('/');

        melview.buildings()
            .then(buildings => {
                let building = buildings.find(building => building.id == buildingId)
                
                if(!building) {
                    throw `Building [${buildingId}] not found`
                }
                
                let unit = building.units.find(unit => unit.id == unitId);

                if(!unit) {
                    throw `Room [${unitId}] not found`
                }

                let cmd = message.toString().toUpperCase();

                switch(feature.toUpperCase()) {
                    case 'POWER':
                        return unit.setPower(Power.enumValueOf(cmd));
                    case 'MODE':
                        return unit.setMode(Mode.enumValueOf(cmd));
                    case 'FANSP':
                        return unit.setFanSpeed(FanSpeed.enumValueOf(cmd));
                    case 'TEMP':
                        return unit.setTemperature(message);
                    default:
                        throw `Unknown operation ${feature}`

            }})
            .then(writeStatusToMqtt)
            .catch(e => {
                logger.error(e);
                writeStatusToMqtt()
            })
    })
}

writeStatusToMqttLoop();
runMqtt2Melview();