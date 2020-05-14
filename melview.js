const superagent = require('superagent');
const debug = require('debug')('melview');
const moment = require('moment');
const { Enum } = require('./enum');

const API_ROOT = 'https://api.melview.net/api';

class Melview {
    constructor(username, password) {
        this.username = username;
        this.password = password;
    }

    static hasCookieExpired(cookieString) {
        let expiryStr = Object.fromEntries(cookieString.split(';').map(s => s.trim().split('=')))['expires'];
        return moment(expiryStr.replace(/-/g,' ')).isBefore();
    } 

    async _cookie() {

        if(this.cookie && !Melview.hasCookieExpired(this.cookie)) {
            debug(`returning cached cookie as it's not yet expired`)
            return this.cookie;
        }

        let res = await superagent.post(`${API_ROOT}/login.aspx`).send({
            "user": this.username,
            "pass": this.password,
            "appversion": "3.0.539"
        });
        debug(`Fetched cookie`);
    
        if(res.ok) {
            debug(`Cookie=${res.header['set-cookie']}`)
            let cookie = res.header['set-cookie'][0];

            if(!cookie || Melview.hasCookieExpired(cookie)) {
                throw `Failed to retreive cookie. Login failed (for user ${this.username})?`
            }

            this.cookie = cookie;
            return cookie;
        } else {
            throw `Cookie request failed: ` + res.body
        }
    }

    async _req(resource, data) {
        let res = await superagent
            .post(`${API_ROOT}/${resource}.aspx`)
            .set('Cookie', await this._cookie())
            .send(data)

        if(res.ok) {
            return res.body;
        } else {
            throw `Request failed: ` + res.body
        }
    }

    async _sendCommand(unitId, command) {
        return await this._req("unitcommand", {
            unitid: unitId,
            v: 2, //verbosity
            commands: command,
            lc: 1
        })
    }

    async buildings() {
        let $this = this;
        return (await this._req("rooms")).map(buildingDef => ({
            name: buildingDef.building,
            id: buildingDef.buildingid,
            rooms: buildingDef.units.map(roomDef => ({
                name: roomDef.room,
                id: roomDef.unitid,
                async setMode(mode) {
                    return await $this._sendCommand(roomDef.unitid, mode.command())
                },
                async setFanSpeed(fanSpeed) {
                    return await $this._sendCommand(roomDef.unitid, fanSpeed.command())
                },
                async setPower(power) {
                    return await $this._sendCommand(roomDef.unitid, power.command())
                },
                async setTemperature(tempFloat) {
                    return await $this._sendCommand(roomDef.unitid, `TS${tempFloat}`)
                },
                ambientTemperature: roomDef.temp,
                targetTemperature: roomDef.settemp,
                mode: Mode.enumById(roomDef.mode),
                power: Power.enumById(roomDef.power),
                /*"room": "ROOM2",
				"unitid": "456",
				"power": "q",
				"wifi": "3",
				"mode": "3",
				"temp": "18",
				"settemp": "19",
				"status": "",
                "schedule1": 0*/
                async capabilities() {
                    return await $this._req('unitcapabilities', {
                        unitid: roomDef.unitid
                    })
                }
            }))
        }))
    }

}

class Mode extends Enum {
    constructor(id) {
        super();
        this.id = id;
    }

    command() {
        return `MD${this.id}`;
    }

    static HEAT = new Mode(1);
    static DRY = new Mode(2);
    static COOL = new Mode(3);
    static FAN = new Mode(7);
    static AUTO = new Mode(8);
}

class FanSpeed extends Enum {
    constructor(id) {
        super();
        this.id = id;
    }

    command() {
        return `FS${this.id}`;
    }

    static LOW = new FanSpeed(2);
    static MID = new FanSpeed(3);
    static HIGH = new FanSpeed(5);
    static AUTO = new FanSpeed(0);
}

class Power extends Enum {
    constructor(id) {
        super();
        this.id = id;
    }

    command() {
        return `PW${this.id}`;
    }

    static ON = new Power('on');
    static OFF = new Power('q');
}

module.exports = {
    Melview,
    Mode,
    FanSpeed,
    Power
}